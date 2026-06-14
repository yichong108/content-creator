from typing import Literal, cast

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.chat_item import ChatItemRow
from app.schemas.chat_item import ChatItem

router = APIRouter(prefix="/api", tags=["chat-items"])

ChatItemKind = Literal["timestamp", "system", "incoming", "outgoing"]


@router.get("/chat-items", response_model=list[ChatItem])
async def list_chat_items(db: AsyncSession = Depends(get_db)) -> list[ChatItem]:
    """按 sort_order 返回全部聊天项，供前端渲染微信对话列表。

    Args:
        db: 异步数据库会话。

    Returns:
        与前端 ChatItem 结构一致的列表。
    """
    result = await db.execute(select(ChatItemRow).order_by(ChatItemRow.sort_order))
    rows = result.scalars().all()
    return [ChatItem(kind=cast(ChatItemKind, row.kind), text=row.text) for row in rows]
