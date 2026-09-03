import asyncio

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import async_session, get_db
from app.models.live_session import LiveSessionRow
from app.schemas.chat_item import ChatItem
from app.schemas.live_status import LiveChatItemsAppendResponse, LiveStatusResponse
from app.schemas.mobile_session import MobileSessionSummary
from app.schemas.response import ApiResponse, success_response
from app.services.chat_item_npc import normalize_session_chat_items
from app.services.live_session_events import LIVE_WS_HEARTBEAT_SEC, live_session_event_hub
from app.services.live_session_npcs import load_npc_summaries, resolve_session_npc_rows

router = APIRouter(tags=["chat-items"])


async def _resolve_mobile_live_session_row(
    db: AsyncSession,
    live_session_id: int | None,
) -> LiveSessionRow:
    """解析移动端目标直播会话行，未指定时取 mobile_enabled 已开启的直播会话。

    Args:
        db: 异步数据库会话。
        live_session_id: 可选直播会话 ID。

    Returns:
        目标直播会话 ORM 行。

    Raises:
        HTTPException: 指定 ID 不存在或尚无移动端直播会话时返回 404。
    """
    if live_session_id is not None:
        result = await db.execute(select(LiveSessionRow).where(LiveSessionRow.id == live_session_id))
        row = result.scalar_one_or_none()
        if row is None:
            raise HTTPException(status_code=404, detail="直播会话不存在")
        return row

    result = await db.execute(select(LiveSessionRow).where(LiveSessionRow.mobile_enabled.is_(True)).limit(1))
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="暂无已开启移动端的直播会话")
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


async def _chat_items_from_live_session_row(row: LiveSessionRow, db: AsyncSession) -> list[ChatItem]:
    """将直播会话行中的聊天记录规范化为 ChatItem 列表。"""
    peer_rows, self_row = await resolve_session_npc_rows(
        db,
        list(row.peer_npc_ids or []),
        row.self_npc_id,
    )
    return normalize_session_chat_items(row.chat_items, peer_rows, self_row)


def _session_npc_count(row: LiveSessionRow) -> int:
    """统计会话参与 NPC 数量（对方列表 + 己方）。

    Args:
        row: 直播会话 ORM 行。

    Returns:
        参与会话的 NPC 总数。
    """
    count = len(list(row.peer_npc_ids or []))
    if row.self_npc_id is not None:
        count += 1
    return count


def _live_chat_items_response(row: LiveSessionRow, items: list[ChatItem]) -> LiveChatItemsAppendResponse:
    """将会话行与消息列表组装为直播聊天拉取响应。

    Args:
        row: 直播会话 ORM 行。
        items: 本次返回的消息列表。

    Returns:
        含标题与 NPC 数量的响应体。
    """
    return LiveChatItemsAppendResponse(
        items=items,
        total=len(row.chat_items),
        title=row.title,
        npc_count=_session_npc_count(row),
        running=row.running,
    )


def _extract_last_message_preview(chat_items: list[dict[str, object]]) -> str | None:
    """从原始聊天记录中提取最近一条可展示的消息文本。

    Args:
        chat_items: 会话内原始 chat_items JSON 数组。

    Returns:
        最近一条 incoming/outgoing 消息文本；无有效消息时返回 ``None``。
    """
    for item in reversed(chat_items):
        kind = item.get("kind")
        text = item.get("text")
        if kind in ("incoming", "outgoing") and isinstance(text, str):
            stripped = text.strip()
            if stripped:
                return stripped
    return None


async def _to_mobile_session_summary(row: LiveSessionRow, db: AsyncSession) -> MobileSessionSummary:
    """将直播会话行转换为移动端列表项。

    Args:
        row: 直播会话 ORM 行。
        db: 异步数据库会话。

    Returns:
        供 Web 会话列表页使用的摘要。
    """
    peer_avatar_url: str | None = None
    peer_npc_ids = list(row.peer_npc_ids or [])
    if peer_npc_ids:
        peer_npcs = await load_npc_summaries(db, peer_npc_ids[:1])
        if peer_npcs:
            peer_avatar_url = peer_npcs[0].avatar_url

    return MobileSessionSummary(
        id=row.id,
        title=row.title,
        last_message=_extract_last_message_preview(row.chat_items),
        peer_avatar_url=peer_avatar_url,
        updated_at=row.updated_at,
        running=row.running,
    )


@router.get("/mobile-sessions")
async def list_mobile_sessions(
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[list[MobileSessionSummary]]:
    """返回移动端会话列表，按更新时间降序排列。

    仅包含至少有一条聊天记录的会话，供 Web 根路径会话列表页渲染。

    Args:
        db: 异步数据库会话。

    Returns:
        统一响应包裹的移动端会话摘要列表。
    """
    result = await db.execute(select(LiveSessionRow).order_by(LiveSessionRow.updated_at.desc()))
    rows = result.scalars().all()
    summaries: list[MobileSessionSummary] = []
    for row in rows:
        if not row.chat_items:
            continue
        summaries.append(await _to_mobile_session_summary(row, db))
    return success_response(summaries)


@router.get("/chat-items")
async def list_chat_items(
    live_session_id: int | None = Query(
        default=None,
        description="直播会话 ID，缺省时取移动端已开启的直播会话",
    ),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[list[ChatItem]]:
    """返回指定直播会话的聊天记录，供 Web 移动端首页渲染微信对话列表。

    Args:
        live_session_id: 可选直播会话 ID。
        db: 异步数据库会话。

    Returns:
        统一响应包裹的 ChatItem 列表。

    Raises:
        HTTPException: 直播会话不存在时返回 404。
    """
    row = await _resolve_mobile_live_session_row(db, live_session_id)
    return success_response(await _chat_items_from_live_session_row(row, db))


@router.get("/live/status")
async def get_live_status(
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[LiveStatusResponse]:
    """返回当前直播展示会话的运行状态，供直播页决定是否高频轮询。

    Args:
        db: 异步数据库会话。

    Returns:
        统一响应包裹的直播状态。

    Raises:
        HTTPException: 尚无已开启的直播会话时返回 404。
    """
    row = await _resolve_live_session_row(db, None)
    return success_response(
        LiveStatusResponse(
            live_session_id=row.id,
            title=row.title,
            running=row.running,
            chat_item_count=len(row.chat_items),
            updated_at=row.updated_at,
        )
    )


@router.get("/live/chat-items")
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
        统一响应包裹的聊天记录与总数。

    Raises:
        HTTPException: 直播会话不存在时返回 404。
    """
    row = await _resolve_live_session_row(db, live_session_id)
    all_items = await _chat_items_from_live_session_row(row, db)
    if since is None:
        return success_response(_live_chat_items_response(row, all_items))

    if since >= len(all_items):
        return success_response(_live_chat_items_response(row, []))

    return success_response(_live_chat_items_response(row, all_items[since:]))


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
