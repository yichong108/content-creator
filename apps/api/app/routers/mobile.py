"""移动端预览页公开接口（无需登录）。

供 apps/web（微信聊天模拟页）的「发起会话」流程使用，
与受保护的管理端接口逻辑一致，仅对外公开必要能力。
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.live_session import LiveSessionRow
from app.models.npc import NpcRow
from app.schemas.error_codes import ERR_BAD_REQUEST
from app.schemas.live_session import (
    LiveSessionCreate,
    LiveSessionDetail,
    LiveSessionRunningUpdate,
    LiveSessionSummary,
)
from app.schemas.npc import NpcSummary
from app.schemas.response import ApiResponse, fail_response, success_response
from app.services.chat_item_npc import normalize_session_chat_items
from app.services.live_session_events import live_session_event_hub
from app.services.live_session_npcs import (
    dedupe_npc_ids,
    load_npc_summaries,
    load_npc_summary,
    npc_row_to_summary,
    resolve_session_npc_rows,
)
from app.services.live_session_runner import live_session_runner

logger = logging.getLogger(__name__)

router = APIRouter(tags=["mobile"])


def _to_summary(row: LiveSessionRow) -> LiveSessionSummary:
    """将 ORM 行转换为直播会话摘要。

    Args:
        row: 数据库直播会话行。

    Returns:
        不含 chat_items 的直播会话摘要。
    """
    return LiveSessionSummary(
        id=row.id,
        title=row.title,
        description=row.description,
        chat_item_count=len(row.chat_items),
        peer_npc_ids=list(row.peer_npc_ids or []),
        self_npc_id=row.self_npc_id,
        enabled=row.enabled,
        mobile_enabled=row.mobile_enabled,
        running=row.running,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


async def _to_detail(row: LiveSessionRow, db: AsyncSession) -> LiveSessionDetail:
    """将 ORM 行转换为直播会话详情。

    Args:
        row: 数据库直播会话行。
        db: 异步数据库会话。

    Returns:
        含 chat_items 的直播会话详情。
    """
    peer_npc_ids = list(row.peer_npc_ids or [])
    peer_rows, self_row = await resolve_session_npc_rows(db, peer_npc_ids, row.self_npc_id)
    chat_items = normalize_session_chat_items(row.chat_items, peer_rows, self_row)
    peer_npcs = await load_npc_summaries(db, peer_npc_ids)
    self_npc = await load_npc_summary(db, row.self_npc_id)
    return LiveSessionDetail(
        id=row.id,
        title=row.title,
        description=row.description,
        chat_item_count=len(chat_items),
        peer_npc_ids=peer_npc_ids,
        self_npc_id=row.self_npc_id,
        enabled=row.enabled,
        mobile_enabled=row.mobile_enabled,
        running=row.running,
        created_at=row.created_at,
        updated_at=row.updated_at,
        chat_items=chat_items,
        peer_npcs=peer_npcs,
        self_npc=self_npc,
    )


async def _get_live_session_row(live_session_id: int, db: AsyncSession) -> LiveSessionRow:
    """按 ID 查询直播会话，不存在时抛出 404。

    Args:
        live_session_id: 直播会话 ID。
        db: 异步数据库会话。

    Returns:
        直播会话 ORM 行。

    Raises:
        HTTPException: 直播会话不存在时返回 404。
    """
    result = await db.execute(select(LiveSessionRow).where(LiveSessionRow.id == live_session_id))
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="直播会话不存在")
    return row


@router.get("/npcs")
async def list_mobile_npcs(
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[list[NpcSummary]]:
    """返回全部 NPC 的普通列表（供移动端发起会话页选择角色）。

    与受保护的分页接口不同，此处返回全量数组而非分页结构，
    便于移动端直接渲染。

    Args:
        db: 异步数据库会话。

    Returns:
        按更新时间降序排列的全部 NPC 摘要列表。
    """
    result = await db.execute(select(NpcRow).order_by(NpcRow.updated_at.desc()))
    rows = result.scalars().all()
    return success_response([npc_row_to_summary(row) for row in rows])


@router.post("/live-sessions")
async def create_mobile_live_session(
    payload: LiveSessionCreate,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[LiveSessionDetail | None]:
    """移动端创建新直播会话。

    Args:
        payload: 创建直播会话请求体。
        response: FastAPI 响应对象，用于写入失败状态码。
        db: 异步数据库会话。

    Returns:
        统一响应包裹的新建直播会话详情。
    """
    peer_npc_ids = dedupe_npc_ids(payload.peer_npc_ids)
    try:
        peer_rows, self_row = await resolve_session_npc_rows(
            db,
            peer_npc_ids,
            payload.self_npc_id,
        )
    except ValueError as exc:
        return fail_response(response, ERR_BAD_REQUEST, str(exc))

    chat_items = [item.model_dump() for item in payload.chat_items]

    row = LiveSessionRow(
        title=payload.title,
        description=payload.description,
        peer_npc_ids=peer_npc_ids,
        self_npc_id=payload.self_npc_id,
        chat_items=chat_items,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return success_response(await _to_detail(row, db))


@router.patch("/live-sessions/{live_session_id}/running")
async def update_mobile_live_session_running(
    live_session_id: int,
    payload: LiveSessionRunningUpdate,
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[LiveSessionSummary]:
    """移动端切换直播会话运行状态（开始/停止实时续写）。

    Args:
        live_session_id: 直播会话 ID。
        payload: 含 running 的请求体。
        db: 异步数据库会话。

    Returns:
        统一响应包裹的更新后直播会话摘要。

    Raises:
        HTTPException: 直播会话不存在时返回 404。
    """
    row = await _get_live_session_row(live_session_id, db)

    if payload.running:
        result = await db.execute(select(LiveSessionRow).where(LiveSessionRow.running.is_(True)))
        for running_row in result.scalars().all():
            running_row.running = False

        enabled_result = await db.execute(select(LiveSessionRow).where(LiveSessionRow.enabled.is_(True)))
        for enabled_row in enabled_result.scalars().all():
            enabled_row.enabled = False

        row.running = True
        row.enabled = True
        await live_session_runner.start()
    else:
        row.running = False

    await db.commit()
    await db.refresh(row)

    await live_session_event_hub.publish(
        "status",
        {
            "live_session_id": row.id,
            "running": row.running,
            "total": len(row.chat_items),
        },
    )

    return success_response(_to_summary(row))
