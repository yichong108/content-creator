from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.npc import NpcRow
from app.schemas.npc import NpcCreate, NpcSummary, NpcUpdate
from app.schemas.response import ApiResponse, ok

router = APIRouter(prefix="/admin/npcs", tags=["admin-npcs"])


def _to_summary(row: NpcRow) -> NpcSummary:
    """将 ORM 行转换为 NPC 摘要。

    Args:
        row: 数据库 NPC 行。

    Returns:
        NPC 摘要对象。
    """
    return NpcSummary(
        id=row.id,
        name=row.name,
        persona_description=row.persona_description,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


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


@router.get("", response_model=ApiResponse[list[NpcSummary]])
async def list_npcs(db: AsyncSession = Depends(get_db)) -> ApiResponse[list[NpcSummary]]:
    """返回全部 NPC 列表，按更新时间降序排列。

    Args:
        db: 异步数据库会话。

    Returns:
        统一 ``ApiResponse`` 包裹的 NPC 列表。
    """
    result = await db.execute(select(NpcRow).order_by(NpcRow.updated_at.desc()))
    rows = result.scalars().all()
    return ok([_to_summary(row) for row in rows])


@router.get("/{npc_id}", response_model=ApiResponse[NpcSummary])
async def get_npc(
    npc_id: int,
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[NpcSummary]:
    """返回指定 NPC 详情。

    Args:
        npc_id: NPC ID。
        db: 异步数据库会话。

    Returns:
        统一 ``ApiResponse`` 包裹的 NPC 详情。

    Raises:
        HTTPException: NPC 不存在时返回 404。
    """
    row = await _get_npc_row(npc_id, db)
    return ok(_to_summary(row))


@router.post("", response_model=ApiResponse[NpcSummary])
async def create_npc(
    payload: NpcCreate,
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[NpcSummary]:
    """创建新 NPC。

    Args:
        payload: 创建 NPC 请求体。
        db: 异步数据库会话。

    Returns:
        统一 ``ApiResponse`` 包裹的新建 NPC。
    """
    row = NpcRow(
        name=payload.name.strip(),
        persona_description=payload.persona_description.strip(),
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return ok(_to_summary(row))


@router.put("/{npc_id}", response_model=ApiResponse[NpcSummary])
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
        统一 ``ApiResponse`` 包裹的更新后 NPC。

    Raises:
        HTTPException: NPC 不存在时返回 404。
    """
    row = await _get_npc_row(npc_id, db)

    if payload.name is not None:
        row.name = payload.name.strip()
    if payload.persona_description is not None:
        row.persona_description = payload.persona_description.strip()

    await db.commit()
    await db.refresh(row)
    return ok(_to_summary(row))


@router.delete("/{npc_id}", response_model=ApiResponse[None])
async def delete_npc(
    npc_id: int,
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[None]:
    """删除指定 NPC。

    Args:
        npc_id: NPC ID。
        db: 异步数据库会话。

    Returns:
        统一 ``ApiResponse`` 包裹的空数据成功响应。

    Raises:
        HTTPException: NPC 不存在时返回 404。
    """
    row = await _get_npc_row(npc_id, db)
    await db.delete(row)
    await db.commit()
    return ok(None, message="deleted")
