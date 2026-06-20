import asyncio
import json
import logging
from typing import Literal

from pydantic import BaseModel, Field

from app.models.npc import NpcRow
from app.schemas.chat_item import ChatItem
from app.services.ai_provider import get_active_config, invoke_structured_output
from app.services.chat_item_npc import enrich_chat_item_with_npc_info
from app.services.chat_npc_persona import NpcPersona, build_persona_prompt_section, personas_from_npc_rows

logger = logging.getLogger(__name__)

LIVE_CHAT_ITEM_CONTINUATION_SYSTEM_PROMPT = """\
你是微信聊天 mock 数据续写器。根据会话标题、角色人设与已有聊天记录，继续生成恰好 1 条新消息。

角色映射（不可颠倒）：
- incoming：非己方（对方侧）消息，左侧气泡
- outgoing：己方发送的消息，右侧气泡

输出格式：必须是合法 JSON 对象，顶层字段 item 为 {"kind": "...", "text": "...", "npc_id": ...}。
kind 只能是 timestamp、system、incoming、outgoing 之一。
incoming/outgoing 必须填写与用户提示一致的 npc_id；timestamp/system 不要 npc_id。

续写规则：
1. 每次只生成 1 条新消息，自然承接上文，不要重复已有内容
2. 优先 incoming/outgoing 对话气泡；偶尔可插入 timestamp 或 system
3. 短句、口语化
4. text 内不要使用英文双引号；禁止 Markdown
5. 可使用微信表情别名，如 [微笑]、[捂脸]
6. 新消息必须符合对应 npc_id 的角色人设

只输出 JSON 对象，不要 markdown 代码块，不要附加解释。"""


class _GeneratedLiveChatItem(BaseModel):
    """LLM 续写阶段的聊天项。"""

    kind: Literal["timestamp", "system", "incoming", "outgoing"]
    text: str
    npc_id: int | None = None
    npc_name: str | None = None
    npc_avatar_url: str | None = None


class _LiveChatItemOutput(BaseModel):
    """LLM 结构化输出容器。"""

    item: _GeneratedLiveChatItem = Field(description="续写的单条新消息")


def _format_history_for_prompt(
    title: str,
    existing_items: list[ChatItem],
    peer_personas: list[NpcPersona],
    self_persona: NpcPersona | None,
) -> str:
    """将会话标题、人设与已有记录格式化为 LLM 用户提示。

    Args:
        title: 直播会话标题。
        existing_items: 已有聊天记录，按时间正序。
        peer_personas: 对方侧 NPC 人设列表。
        self_persona: 己方 NPC 人设。

    Returns:
        供 LLM 续写的用户提示文本。
    """
    recent_items = existing_items[-20:]
    history_json = json.dumps(
        [item.model_dump() for item in recent_items],
        ensure_ascii=False,
    )
    parts = [
        f"会话标题：{title}",
        f"已有聊天记录（最近 {len(recent_items)} 条）：{history_json}",
    ]

    persona_section = build_persona_prompt_section(peer_personas, self_persona)
    if persona_section:
        parts.extend(
            [
                "",
                "角色人设（续写时必须保持一致）：",
                persona_section,
            ]
        )

    return "\n".join(parts)


def _generate_live_chat_item_sync(
    title: str,
    existing_items: list[ChatItem],
    peer_npc_rows: list[NpcRow] | None = None,
    self_npc_row: NpcRow | None = None,
) -> ChatItem:
    """同步调用当前 AI 提供商续写单条聊天记录。

    Args:
        title: 会话标题。
        existing_items: 已有聊天记录。
        peer_npc_rows: 对方侧 NPC 行列表。
        self_npc_row: 己方 NPC 行。

    Returns:
        新生成的 ChatItem。

    Raises:
        AiConfigurationError: 配置无效。
        AiAuthenticationError: API Key 无效。
        AiConnectionError: 无法连接 AI 服务。
        AiUnavailableError: AI 服务返回错误状态。
        AiResponseError: 模型返回空结果。
        ValueError: 模型未返回有效消息。
    """
    peer_rows = peer_npc_rows or []
    peer_personas, self_persona = personas_from_npc_rows(peer_rows, self_npc_row)
    user_prompt = _format_history_for_prompt(title, existing_items, peer_personas, self_persona)
    result = invoke_structured_output(
        LIVE_CHAT_ITEM_CONTINUATION_SYSTEM_PROMPT,
        user_prompt,
        _LiveChatItemOutput,
    )

    draft_item = ChatItem.model_construct(
        kind=result.item.kind,
        text=result.item.text,
        npc_id=result.item.npc_id,
        npc_name=result.item.npc_name,
        npc_avatar_url=result.item.npc_avatar_url,
    )
    enriched = enrich_chat_item_with_npc_info(draft_item, peer_rows, self_npc_row)
    return ChatItem.model_validate(enriched.model_dump())


async def generate_live_chat_item(
    title: str,
    existing_items: list[ChatItem],
    peer_npc_rows: list[NpcRow] | None = None,
    self_npc_row: NpcRow | None = None,
) -> ChatItem:
    """根据标题、人设与已有记录异步续写单条新消息。

    Cursor SDK 的 Bridge 不能在 ``asyncio.to_thread`` 中首次初始化，
    因此 cursor_sdk 提供商在主线程同步执行。

    Args:
        title: 已去除首尾空白的会话标题。
        existing_items: 当前会话已有聊天记录。
        peer_npc_rows: 对方侧 NPC 行列表。
        self_npc_row: 己方 NPC 行。

    Returns:
        新生成的 ChatItem。

    Raises:
        AiConfigurationError: 配置无效。
        AiAuthenticationError: API Key 无效。
        AiConnectionError: 无法连接 AI 服务。
        AiUnavailableError: AI 服务返回错误状态。
        AiResponseError: 模型返回空结果。
        ValueError: 模型未返回有效消息。
    """
    if get_active_config().provider == "cursor_sdk":
        return _generate_live_chat_item_sync(title, existing_items, peer_npc_rows, self_npc_row)
    return await asyncio.to_thread(
        _generate_live_chat_item_sync,
        title,
        existing_items,
        peer_npc_rows,
        self_npc_row,
    )
