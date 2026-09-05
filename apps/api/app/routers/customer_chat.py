"""客户聊天公开接口（无需登录）。

供 apps/web 的 CustomerServicePage 使用，
提供历史加载（游标分页）和消息发送（RAG + Agent）两个端点。
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.schemas.customer_chat import (
    CustomerChatHistoryResponse,
    CustomerChatSendRequest,
    CustomerChatSendResponse,
)
from app.schemas.response import ApiResponse, success_response
from app.services.ai_errors import (
    AiAuthenticationError,
    AiConfigurationError,
    AiConnectionError,
    AiResponseError,
    AiUnavailableError,
)
from app.services.ai_http import fail_from_ai_error
from app.services.customer_chat_service import load_history, send_message

logger = logging.getLogger(__name__)

router = APIRouter(tags=["customer-chat"])


@router.get("/history")
async def get_history(
    session_id: str = Query(..., min_length=1, max_length=64, description="客户会话标识"),
    before_id: int | None = Query(
        default=None,
        ge=0,
        description="翻页游标（已有消息中最早一条的 id），首次加载不传",
    ),
    limit: int = Query(default=20, ge=1, le=50, description="单次加载条数，默认 20"),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[CustomerChatHistoryResponse]:
    """加载客户聊天历史，支持游标式向上翻页。

    首次加载不传 ``before_id``，返回最新的 N 条消息；
    前端滑到顶部时携带最早一条的 ``id`` 作为 ``before_id``，继续加载更早的记录。

    Args:
        session_id: 客户会话标识。
        before_id: 翻页游标。
        limit: 单次加载条数。
        db: 异步数据库会话。

    Returns:
        统一响应包裹的历史消息列表与分页信息。
    """
    result = await load_history(db, session_id=session_id, before_id=before_id, limit=limit)
    return success_response(result)


@router.post("/send")
async def post_send(
    payload: CustomerChatSendRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[CustomerChatSendResponse | None]:
    """发送客户消息，经 RAG + Agent 后返回 AI 客服回复。

    完整链路：RAG 检索相关文档片段 → 注入 system prompt →
    LangChain agent 生成回复 → 持久化消息 → 返回 AI 回复与参考来源。

    Args:
        payload: 含 session_id 和 message 的请求体。
        response: FastAPI 响应对象，失败时写入 HTTP 状态码。
        db: 异步数据库会话。

    Returns:
        统一响应包裹的 AI 回复消息与 RAG 参考来源。
    """
    try:
        result = await send_message(db, session_id=payload.session_id, user_message=payload.message)
    except (
        AiConfigurationError,
        AiAuthenticationError,
        AiConnectionError,
        AiUnavailableError,
        AiResponseError,
        ValueError,
    ) as exc:
        return fail_from_ai_error(exc, response)

    return success_response(result)
