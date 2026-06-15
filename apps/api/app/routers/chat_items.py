from typing import Literal, cast

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.session import SessionRow
from app.schemas.chat_item import ChatItem
from app.schemas.response import ApiResponse, ok

router = APIRouter(tags=["chat-items"])

ChatItemKind = Literal["timestamp", "system", "incoming", "outgoing"]


async def _resolve_session_row(
    db: AsyncSession,
    session_id: int | None,
) -> SessionRow:
    """解析目标会话行，未指定时取最新更新的会话。

    Args:
        db: 异步数据库会话。
        session_id: 可选会话 ID。

    Returns:
        目标会话 ORM 行。

    Raises:
        HTTPException: 指定 ID 不存在或库中无会话时返回 404。
    """
    if session_id is not None:
        result = await db.execute(select(SessionRow).where(SessionRow.id == session_id))
        row = result.scalar_one_or_none()
        if row is None:
            raise HTTPException(status_code=404, detail="会话不存在")
        return row

    result = await db.execute(select(SessionRow).order_by(SessionRow.updated_at.desc()).limit(1))
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="暂无聊天会话")
    return row


@router.get("/chat-items", response_model=ApiResponse[list[ChatItem]])
async def list_chat_items(
    session_id: int | None = Query(default=None, description="会话 ID，缺省时取最新会话"),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[list[ChatItem]]:
    """返回指定会话的聊天记录，供前端渲染微信对话列表。

    Args:
        session_id: 可选会话 ID。
        db: 异步数据库会话。

    Returns:
        统一 ``ApiResponse`` 包裹的 ChatItem 列表。

    Raises:
        HTTPException: 会话不存在时返回 404。
    """
    row = await _resolve_session_row(db, session_id)
    items = [
        ChatItem(kind=cast(ChatItemKind, item["kind"]), text=item["text"])
        for item in row.chat_items
    ]
    return ok(items)
