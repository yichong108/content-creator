from sqlalchemy import JSON, BigInteger, Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.mixins import TimestampMixin


class LiveSessionRow(TimestampMixin, Base):
    """直播会话行，聊天记录以 JSON 数组存储在 chat_items 字段中。"""

    __tablename__ = "live_sessions"

    # 主键，自增
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    # 会话标题，如"闺蜜深夜谈心"
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    # 会话描述/备注，可选
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # 聊天记录 JSON 数组，每条元素为包含 role/content 的 dict
    chat_items: Mapped[list[dict[str, str]]] = mapped_column(JSON, nullable=False)
    # 参与对话的 NPC ID 列表（对方角色）
    peer_npc_ids: Mapped[list[int]] = mapped_column(JSON, nullable=False, default=list)
    # 用户自身扮演的 NPC ID，为空表示用户真实身份参与
    self_npc_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    # 是否在桌面端展示/启用该会话
    enabled: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="0",
    )
    # 是否在移动端展示/启用该会话
    mobile_enabled: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="0",
    )
    # 当前是否正在运行（AI 生成中）
    running: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="0",
    )
