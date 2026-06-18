"""NPC 标签规范化工具。"""


def normalize_npc_tags(tags: list[str]) -> list[str]:
    """去空白、去重并保持顺序。

    Args:
        tags: 原始标签列表。

    Returns:
        规范化后的标签列表。
    """
    seen: set[str] = set()
    normalized: list[str] = []
    for tag in tags:
        trimmed = tag.strip()
        if not trimmed or trimmed in seen:
            continue
        seen.add(trimmed)
        normalized.append(trimmed)
    return normalized
