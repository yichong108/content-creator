import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.session import SessionRow
from app.schemas.chat_item import ChatItem
from app.schemas.chat_items_generate import GenerateChatItemsRequest, GenerateChatItemsResponse
from app.schemas.error_codes import ERR_BAD_REQUEST
from app.schemas.response import ApiResponse, fail, ok
from app.schemas.session import (
    SessionCreate,
    SessionDetail,
    SessionMobileEnabledUpdate,
    SessionSummary,
    SessionUpdate,
)
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
from app.services.chat_items_generator import generate_chat_items
from app.services.live_session_npcs import (
    dedupe_npc_ids,
    load_npc_summaries,
    load_npc_summary,
    merge_session_npc_chat_items,
    resolve_session_npc_rows,
)
from app.services.session_title_generator import generate_session_title

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/sessions", tags=["admin-sessions"])


def _to_summary(row: SessionRow) -> SessionSummary:
    """将 ORM 行转换为会话摘要。

    Args:
        row: 数据库会话行。

    Returns:
        不含 chat_items 的会话摘要。
    """
    return SessionSummary(
        id=row.id,
        title=row.title,
        description=row.description,
        chat_item_count=len(row.chat_items),
        peer_npc_ids=list(row.peer_npc_ids or []),
        self_npc_id=row.self_npc_id,
        mobile_enabled=row.mobile_enabled,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


async def _to_detail(row: SessionRow, db: AsyncSession) -> SessionDetail:
    """将 ORM 行转换为会话详情。

    Args:
        row: 数据库会话行。
        db: 异步数据库会话。

    Returns:
        含 chat_items 与关联 NPC 的会话详情。
    """
    chat_items = [ChatItem.model_validate(item) for item in row.chat_items]
    peer_npc_ids = list(row.peer_npc_ids or [])
    peer_npcs = await load_npc_summaries(db, peer_npc_ids)
    self_npc = await load_npc_summary(db, row.self_npc_id)
    return SessionDetail(
        id=row.id,
        title=row.title,
        description=row.description,
        chat_item_count=len(chat_items),
        peer_npc_ids=peer_npc_ids,
        self_npc_id=row.self_npc_id,
        mobile_enabled=row.mobile_enabled,
        created_at=row.created_at,
        updated_at=row.updated_at,
        chat_items=chat_items,
        peer_npcs=peer_npcs,
        self_npc=self_npc,
    )


async def _get_session_row(session_id: int, db: AsyncSession) -> SessionRow:
    """按 ID 查询会话，不存在时抛出 404。

    Args:
        session_id: 会话 ID。
        db: 异步数据库会话。

    Returns:
        会话 ORM 行。

    Raises:
        HTTPException: 会话不存在时返回 404。
    """
    result = await db.execute(select(SessionRow).where(SessionRow.id == session_id))
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="会话不存在")
    return row


@router.get("", response_model=ApiResponse[list[SessionSummary]])
async def list_sessions(db: AsyncSession = Depends(get_db)) -> ApiResponse[list[SessionSummary]]:
    """返回全部会话摘要列表，按更新时间降序排列。

    Args:
        db: 异步数据库会话。

    Returns:
        统一 ``ApiResponse`` 包裹的会话摘要列表。
    """
    result = await db.execute(select(SessionRow).order_by(SessionRow.updated_at.desc()))
    rows = result.scalars().all()
    return ok([_to_summary(row) for row in rows])


@router.post("/generate-title", response_model=ApiResponse[GenerateSessionTitleResponse])
async def generate_session_title_endpoint(
    payload: GenerateSessionTitleRequest,
) -> ApiResponse[GenerateSessionTitleResponse | None]:
    """根据描述或聊天记录自动生成会话标题。

    Args:
        payload: 含可选描述与聊天记录的请求体。

    Returns:
        统一 ``ApiResponse`` 包裹的标题字符串。
    """
    validation_error = validate_ai_config()
    if validation_error:
        return fail_from_ai_error(AiConfigurationError(validation_error))

    description = payload.description.strip() if payload.description else None
    chat_items = payload.chat_items if payload.chat_items else None

    try:
        title = await generate_session_title(description, chat_items)
    except (
        AiConfigurationError,
        AiAuthenticationError,
        AiConnectionError,
        AiUnavailableError,
        AiResponseError,
        ValueError,
    ) as exc:
        return fail_from_ai_error(exc)

    return ok(GenerateSessionTitleResponse(title=title))


@router.post("/generate-chat-items", response_model=ApiResponse[GenerateChatItemsResponse])
async def generate_session_chat_items(
    payload: GenerateChatItemsRequest,
) -> ApiResponse[GenerateChatItemsResponse | None]:
    """根据会话标题自动生成聊天记录 JSON。

    Args:
        payload: 含非空标题的请求体。

    Returns:
        统一 ``ApiResponse`` 包裹的聊天记录数组。
    """
    validation_error = validate_ai_config()
    if validation_error:
        return fail_from_ai_error(AiConfigurationError(validation_error))

    title = payload.title.strip()
    if not title:
        return fail(ERR_BAD_REQUEST, "标题不能为空")

    try:
        items = await generate_chat_items(title)
    except (
        AiConfigurationError,
        AiAuthenticationError,
        AiConnectionError,
        AiUnavailableError,
        AiResponseError,
        ValueError,
    ) as exc:
        return fail_from_ai_error(exc)

    return ok(GenerateChatItemsResponse(chat_items=items))


@router.get("/{session_id}", response_model=ApiResponse[SessionDetail])
async def get_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[SessionDetail]:
    """返回指定会话详情，含完整聊天记录 JSON。

    Args:
        session_id: 会话 ID。
        db: 异步数据库会话。

    Returns:
        统一 ``ApiResponse`` 包裹的会话详情。

    Raises:
        HTTPException: 会话不存在时返回 404。
    """
    row = await _get_session_row(session_id, db)
    return ok(await _to_detail(row, db))


@router.post("", response_model=ApiResponse[SessionDetail])
async def create_session(
    payload: SessionCreate,
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[SessionDetail]:
    """创建新会话。

    Args:
        payload: 创建会话请求体。
        db: 异步数据库会话。

    Returns:
        统一 ``ApiResponse`` 包裹的新建会话详情。
    """
    peer_npc_ids = dedupe_npc_ids(payload.peer_npc_ids)
    try:
        peer_rows, self_row = await resolve_session_npc_rows(
            db,
            peer_npc_ids,
            payload.self_npc_id,
        )
    except ValueError as exc:
        return fail(ERR_BAD_REQUEST, str(exc))

    chat_items = [item.model_dump() for item in payload.chat_items]
    if not chat_items and (peer_rows or self_row is not None):
        chat_items = merge_session_npc_chat_items(peer_rows, self_row)

    row = SessionRow(
        title=payload.title,
        description=payload.description,
        peer_npc_ids=peer_npc_ids,
        self_npc_id=payload.self_npc_id,
        chat_items=chat_items,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return ok(await _to_detail(row, db))


@router.put("/{session_id}", response_model=ApiResponse[SessionDetail])
async def update_session(
    session_id: int,
    payload: SessionUpdate,
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[SessionDetail]:
    """更新指定会话。

    Args:
        session_id: 会话 ID。
        payload: 更新会话请求体。
        db: 异步数据库会话。

    Returns:
        统一 ``ApiResponse`` 包裹的更新后会话详情。

    Raises:
        HTTPException: 会话不存在时返回 404。
    """
    row = await _get_session_row(session_id, db)

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
            return fail(ERR_BAD_REQUEST, str(exc))

        if payload.chat_items is not None:
            row.chat_items = [item.model_dump() for item in payload.chat_items]
        else:
            row.chat_items = merge_session_npc_chat_items(peer_rows, self_row)
    elif payload.chat_items is not None:
        row.chat_items = [item.model_dump() for item in payload.chat_items]

    await db.commit()
    await db.refresh(row)
    return ok(await _to_detail(row, db))


@router.patch("/{session_id}/mobile-enabled", response_model=ApiResponse[SessionSummary])
async def update_session_mobile_enabled(
    session_id: int,
    payload: SessionMobileEnabledUpdate,
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[SessionSummary]:
    """更新会话移动端展示开关，全局仅允许一个会话开启。

    Args:
        session_id: 会话 ID。
        payload: 含 mobile_enabled 的请求体。
        db: 异步数据库会话。

    Returns:
        统一 ``ApiResponse`` 包裹的更新后会话摘要。

    Raises:
        HTTPException: 会话不存在时返回 404。
    """
    row = await _get_session_row(session_id, db)

    if payload.mobile_enabled:
        result = await db.execute(select(SessionRow).where(SessionRow.mobile_enabled.is_(True)))
        for enabled_row in result.scalars().all():
            enabled_row.mobile_enabled = False

    row.mobile_enabled = payload.mobile_enabled

    await db.commit()
    await db.refresh(row)
    return ok(_to_summary(row))


@router.delete("/{session_id}", response_model=ApiResponse[None])
async def delete_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[None]:
    """删除指定会话。

    Args:
        session_id: 会话 ID。
        db: 异步数据库会话。

    Returns:
        统一 ``ApiResponse`` 包裹的空数据成功响应。

    Raises:
        HTTPException: 会话不存在时返回 404。
    """
    row = await _get_session_row(session_id, db)
    await db.delete(row)
    await db.commit()
    return ok(None, message="deleted")
