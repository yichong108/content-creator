from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.npc import NpcRow
from app.schemas.error_codes import ERR_BAD_REQUEST
from app.schemas.npc import NpcCreate, NpcSummary, NpcUpdate
from app.schemas.response import ApiResponse, fail_response, success_response
from app.services.live_session_npcs import npc_row_to_summary
from app.services.npc_avatar import (
    build_default_avatar_url,
    delete_local_avatar_file,
    is_local_npc_avatar_url,
    save_npc_avatar_file,
)

router = APIRouter(tags=["admin-npcs"])


def _to_summary(row: NpcRow) -> NpcSummary:
    """将 ORM 行转换为 NPC 摘要。

    Args:
        row: 数据库 NPC 行。

    Returns:
        NPC 摘要对象。
    """
    return npc_row_to_summary(row)


async def _get_npc_row(npc_id: int, db: AsyncSession) -> NpcRow:
    """按 ID 查询 NPC，不存在时抛出 404。

    Args:
        npc_id: NPC ID。
        db: 异步数据库会话。

    Returns:
        NPC ORM 行。

    Raises:
        HTTPException: NPC 不存在时返回 404。
    """
    result = await db.execute(select(NpcRow).where(NpcRow.id == npc_id))
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="NPC 不存在")
    return row


@router.get("")
async def list_npcs(db: AsyncSession = Depends(get_db)) -> ApiResponse[list[NpcSummary]]:
    """返回全部 NPC 列表，按更新时间降序排列。

    Args:
        db: 异步数据库会话。

    Returns:
        统一响应包裹的 NPC 列表。
    """
    result = await db.execute(select(NpcRow).order_by(NpcRow.updated_at.desc()))
    rows = result.scalars().all()
    return success_response([_to_summary(row) for row in rows])


@router.get("/{npc_id}")
async def get_npc(
    npc_id: int,
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[NpcSummary]:
    """返回指定 NPC 详情。

    Args:
        npc_id: NPC ID。
        db: 异步数据库会话。

    Returns:
        统一响应包裹的 NPC 详情。

    Raises:
        HTTPException: NPC 不存在时返回 404。
    """
    row = await _get_npc_row(npc_id, db)
    return success_response(_to_summary(row))


@router.post("")
async def create_npc(
    payload: NpcCreate,
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[NpcSummary]:
    """创建新 NPC。

    Args:
        payload: 创建 NPC 请求体。
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
        chat_items=[item.model_dump() for item in payload.chat_items],
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return success_response(_to_summary(row))


@router.put("/{npc_id}")
async def update_npc(
    npc_id: int,
    payload: NpcUpdate,
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[NpcSummary]:
    """更新指定 NPC。

    Args:
        npc_id: NPC ID。
        payload: 更新 NPC 请求体。
        db: 异步数据库会话。

    Returns:
        统一响应包裹的更新后 NPC。

    Raises:
        HTTPException: NPC 不存在时返回 404。
    """
    row = await _get_npc_row(npc_id, db)
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
    if payload.chat_items is not None:
        row.chat_items = [item.model_dump() for item in payload.chat_items]

    await db.commit()
    await db.refresh(row)
    return success_response(_to_summary(row))


@router.post("/{npc_id}/avatar")
async def upload_npc_avatar(
    npc_id: int,
    response: Response,
    db: AsyncSession = Depends(get_db),
    file: UploadFile = File(...),
) -> ApiResponse[NpcSummary | None]:
    """上传并替换指定 NPC 的头像文件。

    Args:
        npc_id: NPC ID。
        file: 头像图片文件。
        db: 异步数据库会话。

    Returns:
        统一响应包裹的更新后 NPC。

    Raises:
        HTTPException: NPC 不存在时返回 404。
    """
    row = await _get_npc_row(npc_id, db)

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
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[None]:
    """删除指定 NPC。

    Args:
        npc_id: NPC ID。
        db: 异步数据库会话。

    Returns:
        统一响应包裹的空数据成功响应。

    Raises:
        HTTPException: NPC 不存在时返回 404。
    """
    row = await _get_npc_row(npc_id, db)
    delete_local_avatar_file(row.avatar_url)
    await db.delete(row)
    await db.commit()
    return success_response(None, message="deleted")
