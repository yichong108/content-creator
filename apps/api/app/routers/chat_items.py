from typing import Literal, cast

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.live_session import LiveSessionRow
from app.models.session import SessionRow
from app.schemas.chat_item import ChatItem
from app.schemas.response import ApiResponse, ok

router = APIRouter(tags=["chat-items"])

ChatItemKind = Literal["timestamp", "system", "incoming", "outgoing"]


async def _resolve_mobile_session_row(
    db: AsyncSession,
    session_id: int | None,
) -> SessionRow:
    """解析移动端目标会话行，未指定时取 mobile_enabled 已开启的会话。

    Args:
        db: 异步数据库会话。
        session_id: 可选会话 ID。

    Returns:
        目标会话 ORM 行。

    Raises:
        HTTPException: 指定 ID 不存在或尚无移动端会话时返回 404。
    """
    if session_id is not None:
        result = await db.execute(select(SessionRow).where(SessionRow.id == session_id))
        row = result.scalar_one_or_none()
        if row is None:
            raise HTTPException(status_code=404, detail="会话不存在")
        return row

    result = await db.execute(select(SessionRow).where(SessionRow.mobile_enabled.is_(True)).limit(1))
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="暂无已开启移动端的会话")
    return row


async def _resolve_live_session_row(
    db: AsyncSession,
    live_session_id: int | None,
) -> LiveSessionRow:
    """解析直播目标会话行，未指定时取 enabled 已开启的直播会话。

    Args:
        db: 异步数据库会话。
        live_session_id: 可选直播会话 ID。

    Returns:
        目标直播会话 ORM 行。

    Raises:
        HTTPException: 指定 ID 不存在或尚无直播会话时返回 404。
    """
    if live_session_id is not None:
        result = await db.execute(select(LiveSessionRow).where(LiveSessionRow.id == live_session_id))
        row = result.scalar_one_or_none()
        if row is None:
            raise HTTPException(status_code=404, detail="直播会话不存在")
        return row

    result = await db.execute(select(LiveSessionRow).where(LiveSessionRow.enabled.is_(True)).limit(1))
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="暂无已开启的直播会话")
    return row


def _chat_items_from_row(chat_items: list[dict[str, str]]) -> list[ChatItem]:
    """将 chat_items JSON 转为 ChatItem 列表。"""
    return [ChatItem(kind=cast(ChatItemKind, item["kind"]), text=item["text"]) for item in chat_items]


@router.get("/chat-items", response_model=ApiResponse[list[ChatItem]])
async def list_chat_items(
    session_id: int | None = Query(default=None, description="会话 ID，缺省时取移动端已开启的会话"),
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
    row = await _resolve_mobile_session_row(db, session_id)
    return ok(_chat_items_from_row(row.chat_items))


@router.get("/live/chat-items", response_model=ApiResponse[list[ChatItem]])
async def list_live_chat_items(
    live_session_id: int | None = Query(
        default=None,
        description="直播会话 ID，缺省时取已开启的直播会话",
    ),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[list[ChatItem]]:
    """返回指定直播会话的聊天记录，供直播页渲染微信对话列表。

    Args:
        live_session_id: 可选直播会话 ID。
        db: 异步数据库会话。

    Returns:
        统一 ``ApiResponse`` 包裹的 ChatItem 列表。

    Raises:
        HTTPException: 直播会话不存在时返回 404。
    """
    row = await _resolve_live_session_row(db, live_session_id)
    return ok(_chat_items_from_row(row.chat_items))
