"""客户聊天消息 ORM 模型。

每条客户与 AI 客服的对话消息独立成行，
通过 session_id 归属到同一会话，支持游标式向上翻历史。
"""

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Index, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class CustomerChatMessageRow(Base):
    """客户聊天消息行。

    每条消息一行，按 ``session_id`` 归属到客户会话。
    ``(session_id, id)`` 索引用于高效的游标式历史加载。
    """

    __tablename__ = "customer_chat_messages"
    __table_args__ = (Index("ix_customer_chat_session_id", "session_id", "id"),)

    # 主键，自增
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    # 客户会话标识（前端生成的 UUID，用于归属同一会话的消息）
    session_id: Mapped[str] = mapped_column(String(64), nullable=False)
    # 消息角色：user（客户发送） / assistant（AI 客服回复）
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    # 消息正文
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # 创建时间，数据库侧写入
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )
