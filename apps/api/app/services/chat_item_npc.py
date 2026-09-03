"""聊天记录与 NPC 元数据绑定工具。"""

from typing import Any, Literal, cast

from app.models.npc import NpcRow
from app.schemas.chat_item import ChatItem
from app.services.npc_avatar import build_default_avatar_url

# 与 ChatItem.kind 一致的合法字面量集合，用于从原始 JSON 收窄类型
_CHAT_ITEM_KINDS: frozenset[str] = frozenset({"timestamp", "system", "incoming", "outgoing"})
ChatItemKind = Literal["timestamp", "system", "incoming", "outgoing"]


def _draft_chat_item_from_dict(item: dict[str, Any]) -> ChatItem | None:
    """从原始字典构造未校验的 ChatItem 草稿。

    Args:
        item: 原始 chat_item 字典。

    Returns:
        ``kind``/``text`` 合法时的 ``model_construct`` 结果；否则 ``None``。
    """
    kind_raw = item.get("kind")
    text_raw = item.get("text")
    if not isinstance(kind_raw, str) or kind_raw not in _CHAT_ITEM_KINDS:
        return None
    if not isinstance(text_raw, str):
        return None

    return ChatItem.model_construct(
        kind=cast(ChatItemKind, kind_raw),
        text=text_raw,
        npc_id=item.get("npc_id") if isinstance(item.get("npc_id"), int) else None,
        npc_name=item.get("npc_name") if isinstance(item.get("npc_name"), str) else None,
        npc_avatar_url=item.get("npc_avatar_url") if isinstance(item.get("npc_avatar_url"), str) else None,
    )


def resolve_npc_avatar_url(npc_row: NpcRow) -> str:
    """解析 NPC 头像 URL，未设置时使用默认 DiceBear 头像。

    Args:
        npc_row: NPC ORM 行。

    Returns:
        可用于前端展示的头像 URL。
    """
    if npc_row.avatar_url and npc_row.avatar_url.strip():
        return npc_row.avatar_url.strip()
    return build_default_avatar_url(npc_row.name)


def npc_metadata_from_row(npc_row: NpcRow) -> dict[str, int | str]:
    """从 NPC 行提取写入 chat_item 的元数据字段。

    Args:
        npc_row: NPC ORM 行。

    Returns:
        含 ``npc_id``、``npc_name``、``npc_avatar_url`` 的字典。
    """
    return {
        "npc_id": npc_row.id,
        "npc_name": npc_row.name,
        "npc_avatar_url": resolve_npc_avatar_url(npc_row),
    }


def tag_chat_item_dict_with_npc(item: dict[str, object], npc_row: NpcRow) -> dict[str, object]:
    """为 incoming/outgoing 字典项写入 NPC 元数据。

    Args:
        item: 原始 chat_item 字典。
        npc_row: 来源 NPC 行。

    Returns:
        写入 NPC 元数据后的字典；timestamp/system 原样返回。
    """
    kind = item.get("kind")
    if kind not in ("incoming", "outgoing"):
        return item

    tagged = dict(item)
    tagged.update(npc_metadata_from_row(npc_row))
    return tagged


def enrich_chat_items_with_npc_info(
    items: list[ChatItem],
    peer_npc_rows: list[NpcRow],
    self_npc_row: NpcRow | None,
) -> list[ChatItem]:
    """补全或校正 incoming/outgoing 的 NPC 元数据。

    LLM 可能只返回 ``npc_id`` 或完全省略；此函数根据会话关联 NPC 写入最终值。

    Args:
        items: 原始聊天记录。
        peer_npc_rows: 对方 NPC 行列表。
        self_npc_row: 己方 NPC 行。

    Returns:
        带完整 NPC 元数据的聊天记录。
    """
    peer_by_id = {row.id: row for row in peer_npc_rows}
    default_peer = peer_npc_rows[0] if len(peer_npc_rows) == 1 else None
    enriched: list[ChatItem] = []

    for item in items:
        if item.kind == "outgoing":
            if self_npc_row is None:
                enriched.append(item)
                continue

            enriched.append(item.model_copy(update=npc_metadata_from_row(self_npc_row)))
            continue

        if item.kind == "incoming":
            incoming_npc: NpcRow | None = None
            if item.npc_id is not None and item.npc_id in peer_by_id:
                incoming_npc = peer_by_id[item.npc_id]
            elif default_peer is not None:
                incoming_npc = default_peer
            elif peer_npc_rows:
                incoming_npc = peer_npc_rows[0]

            if incoming_npc is None:
                enriched.append(item)
                continue

            enriched.append(item.model_copy(update=npc_metadata_from_row(incoming_npc)))
            continue

        enriched.append(item.model_copy(update={"npc_id": None, "npc_name": None, "npc_avatar_url": None}))

    return enriched


def normalize_npc_owned_chat_items(
    chat_items: list[dict[str, Any]] | None,
    npc_row: NpcRow,
) -> list[ChatItem]:
    """规范化 NPC 自身存储的聊天记录，并补全 NPC 元数据。

    Args:
        chat_items: NPC 原始聊天记录 JSON。
        npc_row: 所属 NPC 行。

    Returns:
        校验通过的 ChatItem 列表。
    """
    draft_items = [
        draft
        for item in chat_items or []
        if isinstance(item, dict)
        for draft in [_draft_chat_item_from_dict(item)]
        if draft is not None
    ]
    enriched = enrich_chat_items_with_npc_info(draft_items, [npc_row], npc_row)
    return [ChatItem.model_validate(item.model_dump()) for item in enriched]


def normalize_session_chat_items(
    chat_items: list[dict[str, Any]],
    peer_npc_rows: list[NpcRow],
    self_npc_row: NpcRow | None,
) -> list[ChatItem]:
    """规范化会话聊天记录，补全缺失的 NPC 元数据。

    Args:
        chat_items: 会话原始聊天记录 JSON。
        peer_npc_rows: 对方 NPC 行列表。
        self_npc_row: 己方 NPC 行。

    Returns:
        校验通过的 ChatItem 列表。
    """
    draft_items = [
        draft
        for item in chat_items
        if isinstance(item, dict)
        for draft in [_draft_chat_item_from_dict(item)]
        if draft is not None
    ]
    enriched = enrich_chat_items_with_npc_info(draft_items, peer_npc_rows, self_npc_row)
    return [ChatItem.model_validate(item.model_dump()) for item in enriched]


def enrich_chat_item_with_npc_info(
    item: ChatItem,
    peer_npc_rows: list[NpcRow],
    self_npc_row: NpcRow | None,
) -> ChatItem:
    """为单条续写消息补全 NPC 元数据。

    Args:
        item: 新生成的聊天项。
        peer_npc_rows: 对方 NPC 行列表。
        self_npc_row: 己方 NPC 行。

    Returns:
        带 NPC 元数据的聊天项。
    """
    enriched = enrich_chat_items_with_npc_info([item], peer_npc_rows, self_npc_row)
    return enriched[0]
