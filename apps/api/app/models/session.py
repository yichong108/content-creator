from datetime import datetime

from sqlalchemy import JSON, BigInteger, Boolean, DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class SessionRow(Base):
    """聊天会话行，聊天记录以 JSON 数组存储在 chat_items 字段中。"""

    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    chat_items: Mapped[list[dict[str, str]]] = mapped_column(JSON, nullable=False)
    peer_npc_ids: Mapped[list[int]] = mapped_column(JSON, nullable=False, default=list)
    self_npc_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    mobile_enabled: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="0",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
