from sqlalchemy import BigInteger, Boolean, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.mixins import TimestampMixin


class AdminUserRow(TimestampMixin, Base):
    """后台管理员账号行，用于登录认证。"""

    __tablename__ = "admin_users"

    # 主键，自增
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    # 登录用户名，唯一
    username: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    # 密码哈希值，存储 bcrypt/argon2 等加密后的摘要
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    # 账号是否启用，false 时禁止登录
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
