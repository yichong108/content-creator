from sqlalchemy import JSON, BigInteger, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.mixins import TimestampMixin


class NpcRow(TimestampMixin, Base):
    """对话 NPC 角色行。"""

    __tablename__ = "npcs"

    # 主键，自增
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    # NPC 显示名称，如"小林""张医生"
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    # 人设描述，供 AI prompt 使用
    persona_description: Mapped[str] = mapped_column(Text, nullable=False)
    # 标签列表，用于分类和检索，如 ["朋友", "治愈系"]
    tags: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    # 头像图片 URL，可选
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
