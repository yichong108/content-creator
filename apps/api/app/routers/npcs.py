from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.admin_user import AdminUserRow
from app.models.npc import NpcRow
from app.schemas.error_codes import ERR_BAD_REQUEST
from app.schemas.npc import NpcCreate, NpcSummary, NpcUpdate
from app.schemas.pagination import PageResult
from app.schemas.response import ApiResponse, fail_response, success_response
from app.services.auth_security import get_current_admin
from app.services.live_session_npcs import npc_row_to_summary
from app.services.npc_avatar import (
    build_default_avatar_url,
    delete_local_avatar_file,
    is_local_npc_avatar_url,
    save_npc_avatar_file,
)

router = APIRouter(tags=["admin-npcs"], dependencies=[Depends(get_current_admin)])

# 列表分页每页默认记录数
DEFAULT_PAGE_SIZE = 10


def _to_summary(row: NpcRow) -> NpcSummary:
    """将 ORM 行转换为 NPC 摘要。

    Args:
        row: 数据库 NPC 行。

    Returns:
        NPC 摘要对象。
    """
    return npc_row_to_summary(row)


async def _get_npc_row(npc_id: int, current_admin_id: int, db: AsyncSession) -> NpcRow:
    """按 ID 查询当前用户创建的 NPC，不存在或无权限时抛出 404。

    仅用于写入操作（更新/删除），公共种子 NPC 不可修改。

    Args:
        npc_id: NPC ID。
        current_admin_id: 当前登录管理员 ID。
        db: 异步数据库会话。

    Returns:
        NPC ORM 行。

    Raises:
        HTTPException: NPC 不存在或不属于当前用户时返回 404。
    """
    result = await db.execute(select(NpcRow).where(NpcRow.id == npc_id, NpcRow.created_by == current_admin_id))
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="NPC 不存在")
    return row


async def _get_npc_row_any(npc_id: int, current_admin_id: int, db: AsyncSession) -> NpcRow:
    """按 ID 查询当前用户有权读取的 NPC（自己创建的 + 公共种子），不存在时抛出 404。

    仅用于读取操作（查看详情）。

    Args:
        npc_id: NPC ID。
        current_admin_id: 当前登录管理员 ID。
        db: 异步数据库会话。

    Returns:
        NPC ORM 行。

    Raises:
        HTTPException: NPC 不存在时返回 404。
    """
    result = await db.execute(
        select(NpcRow).where(
            NpcRow.id == npc_id,
            (NpcRow.created_by == current_admin_id) | (NpcRow.created_by.is_(None)),
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="NPC 不存在")
    return row


@router.get("")
async def list_npcs(
    current_admin: AdminUserRow = Depends(get_current_admin),
    page: int = Query(default=1, ge=1, description="页码，从 1 开始"),
    page_size: int = Query(default=DEFAULT_PAGE_SIZE, ge=1, le=100, description="每页记录数"),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[PageResult[NpcSummary]]:
    """分页返回当前用户的 NPC 列表，按更新时间降序排列。

    Args:
        current_admin: 当前登录管理员。
        page: 页码，从 1 开始。
        page_size: 每页记录数，默认 10，最大 100。
        db: 异步数据库会话。

    Returns:
        统一响应包裹的分页 NPC 列表，含总数。
    """
    total_stmt = (
        select(func.count())
        .select_from(NpcRow)
        .where((NpcRow.created_by == current_admin.id) | (NpcRow.created_by.is_(None)))
    )
    total = (await db.execute(total_stmt)).scalar_one()

    stmt = (
        select(NpcRow)
        .where((NpcRow.created_by == current_admin.id) | (NpcRow.created_by.is_(None)))
        .order_by(NpcRow.updated_at.desc(), NpcRow.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = (await db.execute(stmt)).scalars().all()
    items = [_to_summary(row) for row in rows]
    return success_response(PageResult[NpcSummary](items=items, total=total, page=page, page_size=page_size))


@router.get("/{npc_id}")
async def get_npc(
    npc_id: int,
    current_admin: AdminUserRow = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[NpcSummary]:
    """返回指定 NPC 详情。

    Args:
        npc_id: NPC ID。
        current_admin: 当前登录管理员。
        db: 异步数据库会话。

    Returns:
        统一响应包裹的 NPC 详情。

    Raises:
        HTTPException: NPC 不存在或不属于当前用户时返回 404。
    """
    row = await _get_npc_row_any(npc_id, current_admin.id, db)
    return success_response(_to_summary(row))


@router.post("")
async def create_npc(
    payload: NpcCreate,
    current_admin: AdminUserRow = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[NpcSummary]:
    """创建新 NPC。

    Args:
        payload: 创建 NPC 请求体。
        current_admin: 当前登录管理员。
        db: 异步数据库会话。

    Returns:
        统一响应包裹的新建 NPC。
    """
    avatar_url = payload.avatar_url or build_default_avatar_url(payload.name.strip())
    row = NpcRow(
        name=payload.name.strip(),
        persona_description=payload.persona_description.strip(),
        tags=payload.tags,
        avatar_url=avatar_url,
        created_by=current_admin.id,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return success_response(_to_summary(row))


@router.put("/{npc_id}")
async def update_npc(
    npc_id: int,
    payload: NpcUpdate,
    current_admin: AdminUserRow = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[NpcSummary]:
    """更新指定 NPC。

    Args:
        npc_id: NPC ID。
        payload: 更新 NPC 请求体。
        current_admin: 当前登录管理员。
        db: 异步数据库会话。

    Returns:
        统一响应包裹的更新后 NPC。

    Raises:
        HTTPException: NPC 不存在或不属于当前用户时返回 404。
    """
    row = await _get_npc_row(npc_id, current_admin.id, db)
    previous_avatar_url = row.avatar_url

    if payload.name is not None:
        row.name = payload.name.strip()
    if payload.persona_description is not None:
        row.persona_description = payload.persona_description.strip()
    if payload.tags is not None:
        row.tags = payload.tags
    if "avatar_url" in payload.model_fields_set:
        next_avatar_url = payload.avatar_url
        if next_avatar_url != previous_avatar_url and is_local_npc_avatar_url(previous_avatar_url):
            delete_local_avatar_file(previous_avatar_url)
        row.avatar_url = next_avatar_url

    await db.commit()
    await db.refresh(row)
    return success_response(_to_summary(row))


@router.post("/{npc_id}/avatar")
async def upload_npc_avatar(
    npc_id: int,
    response: Response,
    current_admin: AdminUserRow = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
    file: UploadFile = File(...),
) -> ApiResponse[NpcSummary | None]:
    """上传并替换指定 NPC 的头像文件。

    Args:
        npc_id: NPC ID。
        file: 头像图片文件。
        current_admin: 当前登录管理员。
        db: 异步数据库会话。

    Returns:
        统一响应包裹的更新后 NPC。

    Raises:
        HTTPException: NPC 不存在或不属于当前用户时返回 404。
    """
    row = await _get_npc_row(npc_id, current_admin.id, db)

    try:
        avatar_url = await save_npc_avatar_file(npc_id, file)
    except ValueError as exc:
        return fail_response(response, ERR_BAD_REQUEST, str(exc))

    if is_local_npc_avatar_url(row.avatar_url) and row.avatar_url != avatar_url:
        delete_local_avatar_file(row.avatar_url)

    row.avatar_url = avatar_url
    await db.commit()
    await db.refresh(row)
    return success_response(_to_summary(row))


@router.delete("/{npc_id}")
async def delete_npc(
    npc_id: int,
    current_admin: AdminUserRow = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[None]:
    """删除指定 NPC。

    Args:
        npc_id: NPC ID。
        current_admin: 当前登录管理员。
        db: 异步数据库会话。

    Returns:
        统一响应包裹的空数据成功响应。

    Raises:
        HTTPException: NPC 不存在或不属于当前用户时返回 404。
    """
    row = await _get_npc_row(npc_id, current_admin.id, db)
    delete_local_avatar_file(row.avatar_url)
    await db.delete(row)
    await db.commit()
    return success_response(None, message="deleted")
