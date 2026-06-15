from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.session import SessionRow
from app.schemas.chat_item import ChatItem
from app.schemas.response import ApiResponse, ok
from app.schemas.session import SessionCreate, SessionDetail, SessionSummary, SessionUpdate

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
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _to_detail(row: SessionRow) -> SessionDetail:
    """将 ORM 行转换为会话详情。

    Args:
        row: 数据库会话行。

    Returns:
        含 chat_items 的会话详情。
    """
    chat_items = [ChatItem.model_validate(item) for item in row.chat_items]
    return SessionDetail(
        id=row.id,
        title=row.title,
        description=row.description,
        chat_item_count=len(chat_items),
        created_at=row.created_at,
        updated_at=row.updated_at,
        chat_items=chat_items,
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
    return ok(_to_detail(row))


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
    row = SessionRow(
        title=payload.title,
        description=payload.description,
        chat_items=[item.model_dump() for item in payload.chat_items],
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return ok(_to_detail(row))


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
    if payload.chat_items is not None:
        row.chat_items = [item.model_dump() for item in payload.chat_items]

    await db.commit()
    await db.refresh(row)
    return ok(_to_detail(row))


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
