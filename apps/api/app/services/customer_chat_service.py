"""客户聊天服务：历史加载 + RAG 增强的消息发送。

不修改现有 ``invoke_chat``，而是在服务层编排
RAG 检索 → prompt 构建 → agent 调用 → 持久化 的完整链路。
"""

from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.customer_chat import CustomerChatMessageRow
from app.schemas.customer_chat import (
    CustomerChatHistoryResponse,
    CustomerChatMessage,
    CustomerChatSendResponse,
)
from app.schemas.rag import RagSource
from app.services.ai_provider import invoke_chat
from app.services.rag_service import get_rag_service

logger = logging.getLogger(__name__)

# RAG 检索返回的文档片段数量
_RAG_TOP_K = 4
# 传入 agent 的最大历史消息条数（防止 token 溢出）
_MAX_HISTORY_FOR_AGENT = 20
# AI 客服的 system prompt（不含 RAG 上下文时的基础人设）
_BASE_SYSTEM_PROMPT = (
    "你是一个专业、友善的 AI 客服助手。请基于提供的参考资料回答用户问题。"
    "如果参考资料中没有相关信息，请诚实地告知用户，不要编造答案。"
    "回答要简洁明了，语气友好自然。"
)


def _row_to_message(row: CustomerChatMessageRow) -> CustomerChatMessage:
    """将 ORM 行转为 API schema。

    Args:
        row: 数据库消息行。

    Returns:
        对外暴露的 CustomerChatMessage。
    """
    return CustomerChatMessage(
        id=row.id,
        role=row.role,
        content=row.content,
        created_at=row.created_at,
    )


async def load_history(
    db: AsyncSession,
    session_id: str,
    before_id: int | None = None,
    limit: int = 20,
) -> CustomerChatHistoryResponse:
    """按游标加载客户会话的历史消息。

    采用「向后翻页」模式：首次加载不传 ``before_id``，返回最新的 N 条；
    前端滑到顶部时携带最早一条的 ``id`` 作为 ``before_id``，继续加载更早的记录。

    Args:
        db: 异步数据库会话。
        session_id: 客户会话标识。
        before_id: 翻页游标（已有消息中最早一条的 id），``None`` 表示加载最新。
        limit: 单次加载条数，默认 20。

    Returns:
        含消息列表、是否有更多、下一页游标的历史响应。
    """
    # 多取 1 条判断 has_more
    fetch_limit = limit + 1

    stmt = (
        select(CustomerChatMessageRow)
        .where(CustomerChatMessageRow.session_id == session_id)
        .order_by(CustomerChatMessageRow.id.desc())
        .limit(fetch_limit)
    )
    if before_id is not None:
        stmt = stmt.where(CustomerChatMessageRow.id < before_id)

    result = await db.execute(stmt)
    rows = list(result.scalars().all())

    has_more = len(rows) > limit
    if has_more:
        rows = rows[:limit]

    # 反转：ORM 查询是 DESC（新→旧），前端需要升序（旧→新）
    rows.reverse()

    messages = [_row_to_message(row) for row in rows]
    next_cursor = messages[0].id if messages and has_more else None

    return CustomerChatHistoryResponse(
        messages=messages,
        has_more=has_more,
        next_cursor=next_cursor,
    )


def _format_rag_context(sources: list[RagSource]) -> str:
    """将 RAG 检索来源格式化为注入 system prompt 的文本块。

    Args:
        sources: RAG 检索到的来源片段列表。

    Returns:
        可直接拼入 system prompt 的参考资料文本；无来源时返回空串。
    """
    if not sources:
        return ""

    parts = ["以下是可供参考的资料："]
    for i, src in enumerate(sources, start=1):
        parts.append(f"[{i}] 来源：{src.filename}")
        parts.append(src.snippet.strip())
        parts.append("")
    return "\n".join(parts).strip()


async def _load_recent_messages_for_agent(
    db: AsyncSession,
    session_id: str,
    max_count: int,
) -> list[dict[str, str]]:
    """加载最近 N 条消息作为 agent 的对话上下文。

    按时间升序返回 ``{role, content}`` 列表，供 ``invoke_chat`` 使用。

    Args:
        db: 异步数据库会话。
        session_id: 客户会话标识。
        max_count: 最多加载条数。

    Returns:
        role/content 字典列表，按时间升序。
    """
    stmt = (
        select(CustomerChatMessageRow)
        .where(CustomerChatMessageRow.session_id == session_id)
        .order_by(CustomerChatMessageRow.id.desc())
        .limit(max_count)
    )
    result = await db.execute(stmt)
    rows = list(result.scalars().all())
    rows.reverse()
    return [{"role": row.role, "content": row.content} for row in rows]


async def send_message(
    db: AsyncSession,
    session_id: str,
    user_message: str,
) -> CustomerChatSendResponse:
    """发送客户消息，经 RAG + Agent 后返回 AI 客服回复。

    完整链路：
    1. RAG 检索用户消息相关的文档片段
    2. 加载近期对话历史作为上下文
    3. 将 RAG 来源注入 system prompt
    4. 调用 LangChain agent 生成回复
    5. 将用户消息和 AI 回复一同持久化

    Args:
        db: 异步数据库会话。
        session_id: 客户会话标识。
        user_message: 客户输入的消息正文。

    Returns:
        含 AI 回复消息和 RAG 参考来源的响应。

    Raises:
        AiConfigurationError: AI 配置缺失。
        AiAuthenticationError: API Key 无效。
        AiConnectionError: 连接失败。
        AiUnavailableError: 服务不可用。
        AiResponseError: AI 未返回有效内容。
    """
    # Step 1: RAG 检索
    rag_service = get_rag_service()
    nodes = rag_service.retrieve(user_message, top_k=_RAG_TOP_K)
    sources: list[RagSource] = []
    for node in nodes:
        metadata = node.node.metadata or {}
        sources.append(
            RagSource(
                document_id=int(metadata.get("document_id", 0)),
                filename=str(metadata.get("filename", "未知来源")),
                score=float(node.score) if node.score is not None else None,
                snippet=node.text[:500],  # 截断避免过长
            )
        )

    # Step 2: 加载近期对话历史（不含当前用户消息，稍后手动追加）
    history = await _load_recent_messages_for_agent(db, session_id, _MAX_HISTORY_FOR_AGENT)

    # Step 3: 构建 system prompt（RAG 上下文注入）
    rag_context = _format_rag_context(sources)
    if rag_context:
        system_prompt = f"{_BASE_SYSTEM_PROMPT}\n\n{rag_context}"
    else:
        system_prompt = _BASE_SYSTEM_PROMPT

    # Step 4: 拼装 messages 并调用 agent
    # 历史消息中不包含 system，这里统一组装
    messages_for_agent: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]
    messages_for_agent.extend(history)
    messages_for_agent.append({"role": "user", "content": user_message})

    # 同步调用 invoke_chat，FastAPI 路由层负责用 asyncio.to_thread 包裹
    assistant_reply = invoke_chat(messages_for_agent)

    # Step 5: 持久化用户消息和 AI 回复
    user_row = CustomerChatMessageRow(
        session_id=session_id,
        role="user",
        content=user_message,
    )
    assistant_row = CustomerChatMessageRow(
        session_id=session_id,
        role="assistant",
        content=assistant_reply,
    )
    db.add_all([user_row, assistant_row])
    await db.commit()
    await db.refresh(assistant_row)

    return CustomerChatSendResponse(
        message=_row_to_message(assistant_row),
        sources=sources,
    )
