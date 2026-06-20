"""直播会话与 NPC 关联及聊天记录合并工具。"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.npc import NpcRow
from app.schemas.chat_item import ChatItem
from app.schemas.npc import NpcSummary
from app.services.npc_tags import normalize_npc_tags


def dedupe_npc_ids(npc_ids: list[int]) -> list[int]:
    """按首次出现顺序去重 NPC ID 列表。

    Args:
        npc_ids: 原始 NPC ID 列表。

    Returns:
        去重后的 NPC ID 列表。
    """
    seen: set[int] = set()
    result: list[int] = []
    for npc_id in npc_ids:
        if npc_id in seen:
            continue
        seen.add(npc_id)
        result.append(npc_id)
    return result


def merge_npc_chat_items(npc_rows: list[NpcRow]) -> list[dict[str, str]]:
    """按 NPC 行顺序合并聊天记录。

    Args:
        npc_rows: 已按目标顺序排列的 NPC ORM 行。

    Returns:
        合并后的 chat_items 字典列表。
    """
    merged: list[dict[str, str]] = []
    for row in npc_rows:
        merged.extend(row.chat_items or [])
    return merged


def npc_row_to_summary(row: NpcRow) -> NpcSummary:
    """将 NPC ORM 行转换为摘要 schema。

    Args:
        row: NPC ORM 行。

    Returns:
        含 chat_items 的 NPC 摘要。
    """
    chat_items = [ChatItem.model_validate(item) for item in (row.chat_items or [])]
    return NpcSummary(
        id=row.id,
        name=row.name,
        persona_description=row.persona_description,
        tags=normalize_npc_tags(row.tags or []),
        avatar_url=row.avatar_url,
        chat_items=chat_items,
        chat_item_count=len(chat_items),
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


async def fetch_npc_rows_by_ids(db: AsyncSession, npc_ids: list[int]) -> list[NpcRow]:
    """按 ID 列表查询 NPC，返回顺序与输入一致。

    Args:
        db: 异步数据库会话。
        npc_ids: 去重前的 NPC ID 列表。

    Returns:
        与 ``npc_ids`` 顺序一致的 NPC 行；缺失 ID 不会出现在结果中。

    Raises:
        ValueError: 任一 NPC ID 不存在时抛出。
    """
    unique_ids = dedupe_npc_ids(npc_ids)
    if not unique_ids:
        return []

    result = await db.execute(select(NpcRow).where(NpcRow.id.in_(unique_ids)))
    rows_by_id = {row.id: row for row in result.scalars().all()}

    missing = [npc_id for npc_id in unique_ids if npc_id not in rows_by_id]
    if missing:
        raise ValueError(f"NPC 不存在: {', '.join(str(npc_id) for npc_id in missing)}")

    return [rows_by_id[npc_id] for npc_id in unique_ids]


async def load_npc_summaries(db: AsyncSession, npc_ids: list[int]) -> list[NpcSummary]:
    """加载关联 NPC 摘要列表。

    Args:
        db: 异步数据库会话。
        npc_ids: 直播会话关联的 NPC ID 列表。

    Returns:
        与 ``npc_ids`` 顺序一致的 NPC 摘要列表。
    """
    if not npc_ids:
        return []

    rows = await fetch_npc_rows_by_ids(db, npc_ids)
    return [npc_row_to_summary(row) for row in rows]
