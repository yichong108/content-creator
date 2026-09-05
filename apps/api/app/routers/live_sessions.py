import logging

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.admin_user import AdminUserRow
from app.models.live_session import LiveSessionRow
from app.schemas.chat_items_generate import GenerateChatItemsRequest, GenerateChatItemsResponse
from app.schemas.error_codes import ERR_BAD_REQUEST
from app.schemas.live_session import (
    LiveSessionCreate,
    LiveSessionDetail,
    LiveSessionEnabledUpdate,
    LiveSessionMobileEnabledUpdate,
    LiveSessionRunningUpdate,
    LiveSessionSummary,
    LiveSessionUpdate,
)
from app.schemas.response import ApiResponse, fail_response, success_response
from app.schemas.session_title_generate import (
    GenerateSessionTitleRequest,
    GenerateSessionTitleResponse,
)
from app.services.ai_errors import (
    AiAuthenticationError,
    AiConfigurationError,
    AiConnectionError,
    AiResponseError,
    AiUnavailableError,
)
from app.services.ai_http import fail_from_ai_error
from app.services.ai_provider import validate_ai_config
from app.services.auth_security import get_current_admin
from app.services.chat_item_npc import normalize_session_chat_items
from app.services.chat_items_generator import generate_chat_items
from app.services.live_session_events import live_session_event_hub
from app.services.live_session_npcs import (
    dedupe_npc_ids,
    load_npc_summaries,
    load_npc_summary,
    resolve_session_npc_rows,
)
from app.services.live_session_runner import live_session_runner
from app.services.session_title_generator import generate_session_title

logger = logging.getLogger(__name__)

router = APIRouter(tags=["admin-live-sessions"], dependencies=[Depends(get_current_admin)])


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


async def _get_live_session_row(live_session_id: int, current_admin_id: int, db: AsyncSession) -> LiveSessionRow:
    """按 ID 查询当前用户的直播会话，不存在或无权限时抛出 404。

    Args:
        live_session_id: 直播会话 ID。
        current_admin_id: 当前登录管理员 ID。
        db: 异步数据库会话。

    Returns:
        直播会话 ORM 行。

    Raises:
        HTTPException: 直播会话不存在或不属于当前用户时返回 404。
    """
    result = await db.execute(
        select(LiveSessionRow).where(
            LiveSessionRow.id == live_session_id, LiveSessionRow.created_by == current_admin_id
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="直播会话不存在")
    return row


@router.get("")
async def list_live_sessions(
    current_admin: AdminUserRow = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[list[LiveSessionSummary]]:
    """返回当前用户的直播会话摘要列表，按更新时间降序排列。

    Args:
        current_admin: 当前登录管理员。
        db: 异步数据库会话。

    Returns:
        统一响应包裹的直播会话摘要列表。
    """
    result = await db.execute(
        select(LiveSessionRow)
        .where(LiveSessionRow.created_by == current_admin.id)
        .order_by(LiveSessionRow.updated_at.desc())
    )
    rows = result.scalars().all()
    return success_response([_to_summary(row) for row in rows])


@router.post("/generate-title")
async def generate_live_session_title_endpoint(
    payload: GenerateSessionTitleRequest,
    response: Response,
) -> ApiResponse[GenerateSessionTitleResponse | None]:
    """根据可选描述自动生成直播会话标题；未提供描述时随机生成。

    Args:
        payload: 含可选描述的请求体。

    Returns:
        统一响应包裹的标题字符串。
    """
    validation_error = validate_ai_config()
    if validation_error:
        return fail_from_ai_error(AiConfigurationError(validation_error), response)

    description = payload.description.strip() if payload.description else None

    try:
        title = await generate_session_title(description)
    except (
        AiConfigurationError,
        AiAuthenticationError,
        AiConnectionError,
        AiUnavailableError,
        AiResponseError,
        ValueError,
    ) as exc:
        return fail_from_ai_error(exc, response)

    return success_response(GenerateSessionTitleResponse(title=title))


@router.post("/generate-chat-items")
async def generate_live_session_chat_items(
    payload: GenerateChatItemsRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[GenerateChatItemsResponse | None]:
    """根据直播会话标题与关联 NPC 人设自动生成聊天记录 JSON。

    Args:
        payload: 含标题、描述与 NPC ID 的请求体。
        db: 异步数据库会话。

    Returns:
        统一响应包裹的聊天记录数组。
    """
    validation_error = validate_ai_config()
    if validation_error:
        return fail_from_ai_error(AiConfigurationError(validation_error), response)

    title = payload.title.strip()
    if not title:
        return fail_response(response, ERR_BAD_REQUEST, "标题不能为空")

    peer_npc_ids = dedupe_npc_ids(payload.peer_npc_ids)
    if not peer_npc_ids and payload.self_npc_id is None:
        return fail_response(response, ERR_BAD_REQUEST, "请先选择对方或己方，以便按人设生成聊天记录")

    try:
        peer_rows, self_row = await resolve_session_npc_rows(db, peer_npc_ids, payload.self_npc_id)
    except ValueError as exc:
        return fail_response(response, ERR_BAD_REQUEST, str(exc))

    description = payload.description.strip() if payload.description else None

    try:
        items = await generate_chat_items(title, description, peer_rows, self_row)
    except (
        AiConfigurationError,
        AiAuthenticationError,
        AiConnectionError,
        AiUnavailableError,
        AiResponseError,
        ValueError,
    ) as exc:
        return fail_from_ai_error(exc, response)

    return success_response(GenerateChatItemsResponse(chat_items=items))


@router.get("/{live_session_id}")
async def get_live_session(
    live_session_id: int,
    current_admin: AdminUserRow = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[LiveSessionDetail]:
    """返回指定直播会话详情，含完整聊天记录 JSON。

    Args:
        live_session_id: 直播会话 ID。
        current_admin: 当前登录管理员。
        db: 异步数据库会话。

    Returns:
        统一响应包裹的直播会话详情。

    Raises:
        HTTPException: 直播会话不存在或不属于当前用户时返回 404。
    """
    row = await _get_live_session_row(live_session_id, current_admin.id, db)
    return success_response(await _to_detail(row, db))


@router.post("")
async def create_live_session(
    payload: LiveSessionCreate,
    response: Response,
    current_admin: AdminUserRow = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[LiveSessionDetail | None]:
    """创建新直播会话。

    Args:
        payload: 创建直播会话请求体。
        current_admin: 当前登录管理员。
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
        created_by=current_admin.id,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return success_response(await _to_detail(row, db))


@router.put("/{live_session_id}")
async def update_live_session(
    live_session_id: int,
    payload: LiveSessionUpdate,
    response: Response,
    current_admin: AdminUserRow = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[LiveSessionDetail | None]:
    """更新指定直播会话。

    Args:
        live_session_id: 直播会话 ID。
        payload: 更新直播会话请求体。
        current_admin: 当前登录管理员。
        db: 异步数据库会话。

    Returns:
        统一响应包裹的更新后直播会话详情。

    Raises:
        HTTPException: 直播会话不存在或不属于当前用户时返回 404。
    """
    row = await _get_live_session_row(live_session_id, current_admin.id, db)

    if payload.title is not None:
        row.title = payload.title
    if payload.description is not None:
        row.description = payload.description

    npc_fields_updated = "peer_npc_ids" in payload.model_fields_set or "self_npc_id" in payload.model_fields_set
    if "peer_npc_ids" in payload.model_fields_set:
        row.peer_npc_ids = dedupe_npc_ids(payload.peer_npc_ids or [])
    if "self_npc_id" in payload.model_fields_set:
        row.self_npc_id = payload.self_npc_id

    if npc_fields_updated:
        try:
            peer_rows, self_row = await resolve_session_npc_rows(
                db,
                list(row.peer_npc_ids or []),
                row.self_npc_id,
            )
        except ValueError as exc:
            return fail_response(response, ERR_BAD_REQUEST, str(exc))

        if payload.chat_items is not None:
            row.chat_items = [item.model_dump() for item in payload.chat_items]
    elif payload.chat_items is not None:
        row.chat_items = [item.model_dump() for item in payload.chat_items]

    await db.commit()
    await db.refresh(row)
    return success_response(await _to_detail(row, db))


@router.patch("/{live_session_id}/enabled")
async def update_live_session_enabled(
    live_session_id: int,
    payload: LiveSessionEnabledUpdate,
    current_admin: AdminUserRow = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[LiveSessionSummary]:
    """更新直播会话展示开关，当前用户下仅允许一个直播会话开启。

    Args:
        live_session_id: 直播会话 ID。
        payload: 含 enabled 的请求体。
        current_admin: 当前登录管理员。
        db: 异步数据库会话。

    Returns:
        统一响应包裹的更新后直播会话摘要。

    Raises:
        HTTPException: 直播会话不存在或不属于当前用户时返回 404。
    """
    row = await _get_live_session_row(live_session_id, current_admin.id, db)

    if payload.enabled:
        result = await db.execute(
            select(LiveSessionRow).where(
                LiveSessionRow.enabled.is_(True),
                LiveSessionRow.created_by == current_admin.id,
            )
        )
        for enabled_row in result.scalars().all():
            enabled_row.enabled = False

        running_result = await db.execute(
            select(LiveSessionRow).where(
                LiveSessionRow.running.is_(True),
                LiveSessionRow.created_by == current_admin.id,
            )
        )
        for running_row in running_result.scalars().all():
            if running_row.id != live_session_id:
                running_row.running = False

        row.enabled = True
    else:
        row.enabled = False
        if row.running:
            row.running = False

    await db.commit()
    await db.refresh(row)
    return success_response(_to_summary(row))


@router.patch("/{live_session_id}/mobile-enabled")
async def update_live_session_mobile_enabled(
    live_session_id: int,
    payload: LiveSessionMobileEnabledUpdate,
    current_admin: AdminUserRow = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[LiveSessionSummary]:
    """更新直播会话移动端展示开关，当前用户下仅允许一个直播会话开启。

    Args:
        live_session_id: 直播会话 ID。
        payload: 含 mobile_enabled 的请求体。
        current_admin: 当前登录管理员。
        db: 异步数据库会话。

    Returns:
        统一响应包裹的更新后直播会话摘要。

    Raises:
        HTTPException: 直播会话不存在或不属于当前用户时返回 404。
    """
    row = await _get_live_session_row(live_session_id, current_admin.id, db)

    if payload.mobile_enabled:
        result = await db.execute(
            select(LiveSessionRow).where(
                LiveSessionRow.mobile_enabled.is_(True),
                LiveSessionRow.created_by == current_admin.id,
            )
        )
        for enabled_row in result.scalars().all():
            enabled_row.mobile_enabled = False

    row.mobile_enabled = payload.mobile_enabled

    await db.commit()
    await db.refresh(row)
    return success_response(_to_summary(row))


@router.patch("/{live_session_id}/running")
async def update_live_session_running(
    live_session_id: int,
    payload: LiveSessionRunningUpdate,
    current_admin: AdminUserRow = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[LiveSessionSummary]:
    """更新直播会话运行状态，当前用户下仅允许一个直播会话处于 running。

    开始运行时自动开启直播展示，并启动后台续写任务；停止时关闭 running 标记。

    Args:
        live_session_id: 直播会话 ID。
        payload: 含 running 的请求体。
        current_admin: 当前登录管理员。
        db: 异步数据库会话。

    Returns:
        统一响应包裹的更新后直播会话摘要。

    Raises:
        HTTPException: 直播会话不存在或不属于当前用户时返回 404。
    """
    row = await _get_live_session_row(live_session_id, current_admin.id, db)

    if payload.running:
        result = await db.execute(
            select(LiveSessionRow).where(
                LiveSessionRow.running.is_(True),
                LiveSessionRow.created_by == current_admin.id,
            )
        )
        for running_row in result.scalars().all():
            running_row.running = False

        enabled_result = await db.execute(
            select(LiveSessionRow).where(
                LiveSessionRow.enabled.is_(True),
                LiveSessionRow.created_by == current_admin.id,
            )
        )
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


@router.delete("/{live_session_id}")
async def delete_live_session(
    live_session_id: int,
    current_admin: AdminUserRow = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[None]:
    """删除指定直播会话。

    Args:
        live_session_id: 直播会话 ID。
        current_admin: 当前登录管理员。
        db: 异步数据库会话。

    Returns:
        统一响应包裹的空数据成功响应。

    Raises:
        HTTPException: 直播会话不存在或不属于当前用户时返回 404。
    """
    row = await _get_live_session_row(live_session_id, current_admin.id, db)
    if row.running:
        row.running = False
    await db.delete(row)
    await db.commit()
    return success_response(None, message="deleted")
