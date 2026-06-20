"""会话与 NPC 关联及聊天记录合并工具。"""

from typing import Any, Literal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.npc import NpcRow
from app.schemas.npc import NpcSummary
from app.services.chat_item_npc import normalize_npc_owned_chat_items, npc_metadata_from_row
from app.services.npc_tags import normalize_npc_tags

NpcSide = Literal["peer", "self"]


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


def extract_npc_chat_items_for_side(
    chat_items: list[dict[str, Any]] | None,
    side: NpcSide,
    npc_row: NpcRow,
) -> list[dict[str, Any]]:
    """从 NPC 聊天记录中提取指定侧别的消息，并写入 NPC 元数据。

    peer 侧保留 incoming；self 侧保留 outgoing。timestamp/system 两侧均保留。
    若 NPC 数据仍含对侧 kind，会转换为当前侧别以兼容旧数据。

    Args:
        chat_items: NPC 原始聊天记录。
        side: ``peer`` 表示对方侧，``self`` 表示己方。
        npc_row: 来源 NPC 行，用于写入 ``npc_id`` / ``npc_name``。

    Returns:
        过滤并规范化后的 chat_items 字典列表。
    """
    target_kind = "incoming" if side == "peer" else "outgoing"
    alternate_kind = "outgoing" if side == "peer" else "incoming"
    extracted: list[dict[str, Any]] = []

    for item in chat_items or []:
        kind = item.get("kind")
        text = item.get("text", "")
        if not isinstance(kind, str) or not isinstance(text, str):
            continue

        if kind in ("timestamp", "system"):
            extracted.append({"kind": kind, "text": text})
        elif kind == target_kind:
            extracted.append({"kind": kind, "text": text, **npc_metadata_from_row(npc_row)})
        elif kind == alternate_kind:
            extracted.append({"kind": target_kind, "text": text, **npc_metadata_from_row(npc_row)})

    return extracted


def merge_session_npc_chat_items(
    peer_npc_rows: list[NpcRow],
    self_npc_row: NpcRow | None,
) -> list[dict[str, Any]]:
    """按对方/己方 NPC 合并聊天记录。

    Args:
        peer_npc_rows: 对方 NPC ORM 行列表，按选择顺序排列。
        self_npc_row: 己方 NPC ORM 行，可为 ``None``。

    Returns:
        合并后的 chat_items 字典列表（先各对方 NPC，后己方 NPC）。
    """
    merged: list[dict[str, Any]] = []

    for peer_row in peer_npc_rows:
        merged.extend(extract_npc_chat_items_for_side(peer_row.chat_items, "peer", peer_row))
    if self_npc_row is not None:
        merged.extend(extract_npc_chat_items_for_side(self_npc_row.chat_items, "self", self_npc_row))

    return merged


def npc_row_to_summary(row: NpcRow) -> NpcSummary:
    """将 NPC ORM 行转换为摘要 schema。

    Args:
        row: NPC ORM 行。

    Returns:
        含 chat_items 的 NPC 摘要。
    """
    chat_items = normalize_npc_owned_chat_items(row.chat_items, row)
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
        与 ``npc_ids`` 顺序一致的 NPC 行。

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


async def load_npc_summary(db: AsyncSession, npc_id: int | None) -> NpcSummary | None:
    """加载单个 NPC 摘要。

    Args:
        db: 异步数据库会话。
        npc_id: NPC ID，为 ``None`` 时不查询。

    Returns:
        NPC 摘要；``npc_id`` 为空或已删除时返回 ``None``。
    """
    if npc_id is None:
        return None

    result = await db.execute(select(NpcRow).where(NpcRow.id == npc_id))
    row = result.scalar_one_or_none()
    if row is None:
        return None

    return npc_row_to_summary(row)


async def load_npc_summaries(db: AsyncSession, npc_ids: list[int]) -> list[NpcSummary]:
    """加载 NPC 摘要列表。

    Args:
        db: 异步数据库会话。
        npc_ids: NPC ID 列表。

    Returns:
        与 ``npc_ids`` 顺序一致的 NPC 摘要列表；已删除 NPC 不会出现在结果中。
    """
    if not npc_ids:
        return []

    rows = await fetch_npc_rows_by_ids(db, npc_ids)
    return [npc_row_to_summary(row) for row in rows]


async def resolve_session_npc_rows(
    db: AsyncSession,
    peer_npc_ids: list[int],
    self_npc_id: int | None,
) -> tuple[list[NpcRow], NpcRow | None]:
    """解析并校验会话关联的对方/己方 NPC。

    Args:
        db: 异步数据库会话。
        peer_npc_ids: 对方 NPC ID 列表。
        self_npc_id: 己方 NPC ID，可为 ``None``。

    Returns:
        ``(peer_npc_rows, self_npc_row)`` 元组。

    Raises:
        ValueError: 任一 NPC ID 不存在时抛出。
    """
    peer_rows = await fetch_npc_rows_by_ids(db, peer_npc_ids)
    self_row = None
    if self_npc_id is not None:
        rows = await fetch_npc_rows_by_ids(db, [self_npc_id])
        self_row = rows[0]
    return peer_rows, self_row
