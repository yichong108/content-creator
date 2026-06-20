import asyncio

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import async_session, get_db
from app.models.live_session import LiveSessionRow
from app.models.session import SessionRow
from app.schemas.chat_item import ChatItem
from app.schemas.live_status import LiveChatItemsAppendResponse, LiveStatusResponse
from app.schemas.response import ApiResponse, ok
from app.services.chat_item_npc import normalize_session_chat_items
from app.services.live_session_events import LIVE_WS_HEARTBEAT_SEC, live_session_event_hub
from app.services.live_session_npcs import resolve_session_npc_rows

router = APIRouter(tags=["chat-items"])


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


async def _chat_items_from_session_row(row: SessionRow, db: AsyncSession) -> list[ChatItem]:
    """将会话行中的聊天记录规范化为 ChatItem 列表。"""
    peer_rows, self_row = await resolve_session_npc_rows(
        db,
        list(row.peer_npc_ids or []),
        row.self_npc_id,
    )
    return normalize_session_chat_items(row.chat_items, peer_rows, self_row)


async def _chat_items_from_live_session_row(row: LiveSessionRow, db: AsyncSession) -> list[ChatItem]:
    """将直播会话行中的聊天记录规范化为 ChatItem 列表。"""
    peer_rows, self_row = await resolve_session_npc_rows(
        db,
        list(row.peer_npc_ids or []),
        row.self_npc_id,
    )
    return normalize_session_chat_items(row.chat_items, peer_rows, self_row)


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
    return ok(await _chat_items_from_session_row(row, db))


@router.get("/live/status", response_model=ApiResponse[LiveStatusResponse])
async def get_live_status(
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[LiveStatusResponse]:
    """返回当前直播展示会话的运行状态，供直播页决定是否高频轮询。

    Args:
        db: 异步数据库会话。

    Returns:
        统一 ``ApiResponse`` 包裹的直播状态。

    Raises:
        HTTPException: 尚无已开启的直播会话时返回 404。
    """
    row = await _resolve_live_session_row(db, None)
    return ok(
        LiveStatusResponse(
            live_session_id=row.id,
            title=row.title,
            running=row.running,
            chat_item_count=len(row.chat_items),
            updated_at=row.updated_at,
        )
    )


@router.get("/live/chat-items", response_model=ApiResponse[LiveChatItemsAppendResponse])
async def list_live_chat_items(
    live_session_id: int | None = Query(
        default=None,
        description="直播会话 ID，缺省时取已开启的直播会话",
    ),
    since: int | None = Query(
        default=None,
        ge=0,
        description="仅返回该索引之后的新消息；缺省时返回全部",
    ),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[LiveChatItemsAppendResponse]:
    """返回指定直播会话的聊天记录，供直播页渲染微信对话列表。

    传入 ``since`` 时仅返回增量消息，便于前端轮询追加。

    Args:
        live_session_id: 可选直播会话 ID。
        since: 已有消息条数，用于增量拉取。
        db: 异步数据库会话。

    Returns:
        统一 ``ApiResponse`` 包裹的聊天记录与总数。

    Raises:
        HTTPException: 直播会话不存在时返回 404。
    """
    row = await _resolve_live_session_row(db, live_session_id)
    all_items = await _chat_items_from_live_session_row(row, db)
    if since is None:
        return ok(LiveChatItemsAppendResponse(items=all_items, total=len(all_items)))

    if since >= len(all_items):
        return ok(LiveChatItemsAppendResponse(items=[], total=len(all_items)))

    return ok(LiveChatItemsAppendResponse(items=all_items[since:], total=len(all_items)))


async def _load_enabled_live_session() -> LiveSessionRow | None:
    """读取当前已开启的直播会话。

    Returns:
        已开启的直播会话 ORM 行；不存在时返回 ``None``。
    """
    async with async_session() as db:
        result = await db.execute(select(LiveSessionRow).where(LiveSessionRow.enabled.is_(True)).limit(1))
        return result.scalar_one_or_none()


@router.websocket("/live/ws")
async def websocket_live_events(websocket: WebSocket) -> None:
    """通过 WebSocket 推送直播新消息与状态变更。

    连接建立时发送 ``connected`` 事件；后台续写入库后发送 ``message`` 事件；
    续写生成过程中发送 ``typing`` 事件；运行状态变化时发送 ``status`` 事件；空闲时发送 ``ping`` 心跳。

    Args:
        websocket: FastAPI WebSocket 连接。
    """
    await websocket.accept()
    queue = await live_session_event_hub.subscribe()
    try:
        row = await _load_enabled_live_session()
        if row is None:
            await websocket.send_json({"event": "error", "data": {"detail": "暂无已开启的直播会话"}})
            await websocket.close(code=1008)
            return

        await websocket.send_json(
            {
                "event": "connected",
                "data": {
                    "live_session_id": row.id,
                    "title": row.title,
                    "running": row.running,
                    "total": len(row.chat_items),
                },
            }
        )

        while True:
            try:
                message = await asyncio.wait_for(queue.get(), timeout=LIVE_WS_HEARTBEAT_SEC)
                await websocket.send_json(message)
            except TimeoutError:
                await websocket.send_json({"event": "ping", "data": {}})
    except WebSocketDisconnect:
        pass
    finally:
        await live_session_event_hub.unsubscribe(queue)
