from datetime import datetime

from sqlalchemy import DateTime, func
from sqlalchemy.orm import Mapped, mapped_column


class TimestampMixin:
    """时间戳混入类 - 为 ORM 模型统一提供创建/更新时间字段

    所有模型继承此类即可获得 created_at / updated_at 两个字段：
    created_at 由数据库在插入时写入当前时间，updated_at 在每次更新时自动刷新。
    """

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
