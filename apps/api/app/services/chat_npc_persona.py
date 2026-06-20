"""NPC 人设上下文，供聊天记录生成与续写 prompt 使用。"""

from dataclasses import dataclass

from app.models.npc import NpcRow


@dataclass(frozen=True)
class NpcPersona:
    """单条 NPC 人设，用于 LLM 提示词。"""

    id: int
    name: str
    persona_description: str
    tags: tuple[str, ...]


def npc_row_to_persona(row: NpcRow) -> NpcPersona:
    """将 NPC ORM 行转换为人设上下文。

    Args:
        row: NPC ORM 行。

    Returns:
        供 prompt 使用的人设对象。
    """
    return NpcPersona(
        id=row.id,
        name=row.name.strip(),
        persona_description=row.persona_description.strip(),
        tags=tuple(row.tags or []),
    )


def personas_from_npc_rows(
    peer_npc_rows: list[NpcRow],
    self_npc_row: NpcRow | None,
) -> tuple[list[NpcPersona], NpcPersona | None]:
    """从对方/己方 NPC 行提取人设列表。

    Args:
        peer_npc_rows: 对方 NPC ORM 行列表。
        self_npc_row: 己方 NPC ORM 行，可为 ``None``。

    Returns:
        ``(peer_personas, self_persona)`` 元组。
    """
    peer_personas = [npc_row_to_persona(row) for row in peer_npc_rows]
    self_persona = npc_row_to_persona(self_npc_row) if self_npc_row is not None else None
    return peer_personas, self_persona


def _format_single_persona(side_label: str, persona: NpcPersona) -> str:
    """格式化单个 NPC 人设描述行。

    Args:
        side_label: 侧别说明（如 incoming/outgoing）。
        persona: NPC 人设。

    Returns:
        单行或多行人设文本。
    """
    lines = [f"{side_label}（npc_id={persona.id}，名称「{persona.name}」）人设：{persona.persona_description}"]
    if persona.tags:
        lines.append(f"{side_label}标签：{', '.join(persona.tags)}")
    return "\n".join(lines)


def build_persona_prompt_section(
    peer_personas: list[NpcPersona],
    self_persona: NpcPersona | None,
) -> str:
    """构建角色人设 prompt 片段。

    Args:
        peer_personas: 对方侧 NPC 人设列表。
        self_persona: 己方 NPC 人设，可为 ``None``。

    Returns:
        人设说明文本；无 NPC 时返回空字符串。
    """
    sections: list[str] = []

    if len(peer_personas) == 1:
        sections.append(_format_single_persona("对方 incoming", peer_personas[0]))
    elif len(peer_personas) > 1:
        for index, persona in enumerate(peer_personas, start=1):
            sections.append(_format_single_persona(f"对方 incoming #{index}", persona))
        sections.append("多条 incoming 消息需带对应 npc_id，并符合该 NPC 人设。")

    if self_persona is not None:
        sections.append(_format_single_persona("己方 outgoing", self_persona))

    return "\n".join(sections)


def build_chat_items_user_prompt(
    title: str,
    description: str | None,
    peer_personas: list[NpcPersona],
    self_persona: NpcPersona | None,
) -> str:
    """构建批量生成聊天记录的用户提示。

    Args:
        title: 会话标题。
        description: 可选会话描述。
        peer_personas: 对方侧 NPC 人设列表。
        self_persona: 己方 NPC 人设。

    Returns:
        完整的用户提示文本。
    """
    parts = [f"会话标题：{title}"]

    if description and description.strip():
        parts.append(f"会话描述：{description.strip()}")

    persona_section = build_persona_prompt_section(peer_personas, self_persona)
    if persona_section:
        parts.extend(
            [
                "",
                "角色人设（必须渗透于措辞习惯与话题偏好，不要每条自我介绍身份）：",
                persona_section,
            ]
        )

    return "\n".join(parts)
