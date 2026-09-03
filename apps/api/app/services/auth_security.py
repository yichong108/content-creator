"""后台管理员登录认证核心逻辑。

提供密码哈希（bcrypt）、JWT 令牌签发/校验，
以及 FastAPI 依赖 ``get_current_admin`` 供受保护路由复用。
"""

from datetime import UTC, datetime, timedelta
from typing import Annotated

import bcrypt
import jwt
from fastapi import Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import async_session, get_db
from app.models.admin_user import AdminUserRow

# PyJWT 使用的算法
_JWT_ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    """使用 bcrypt 生成带盐的密码哈希。

    Args:
        password: 明文密码。

    Returns:
        bcrypt 哈希字符串，可直接存入数据库。
    """
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    """校验明文密码与哈希是否匹配。

    Args:
        password: 待校验的明文密码。
        password_hash: 数据库中存储的 bcrypt 哈希。

    Returns:
        匹配返回 True，否则返回 False。
    """
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        # 哈希格式非法时视为不匹配，避免抛出未处理异常
        return False


def create_access_token(admin_user_id: int) -> tuple[str, datetime]:
    """为指定管理员签发 JWT 访问令牌。

    Args:
        admin_user_id: 管理员用户 ID。

    Returns:
        二元组 ``(token, expires_at)``，其中 expires_at 为令牌过期时间（UTC）。
    """
    expires_at = datetime.now(UTC) + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {
        "sub": str(admin_user_id),
        "iat": datetime.now(UTC),
        "exp": expires_at,
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm=_JWT_ALGORITHM)
    return token, expires_at


def decode_access_token(token: str) -> int:
    """校验 JWT 并返回管理员 ID。

    Args:
        token: 客户端携带的 JWT 字符串。

    Returns:
        令牌中携带的管理员用户 ID。

    Raises:
        jwt.ExpiredSignatureError: 令牌已过期。
        jwt.InvalidTokenError: 令牌签名非法或结构错误。
    """
    payload = jwt.decode(token, settings.jwt_secret, algorithms=[_JWT_ALGORITHM])
    return int(payload["sub"])


async def get_current_admin(
    authorization: Annotated[str | None, Header()] = None,
    db: AsyncSession = Depends(get_db),
) -> AdminUserRow:
    """FastAPI 依赖：解析 Authorization 头并返回当前登录管理员。

    期望 ``Authorization: Bearer <token>`` 格式；任何一步失败
    （缺失、非法、过期、账号停用）均返回 401，避免泄露具体原因。

    Args:
        authorization: HTTP Authorization 请求头。
        db: 异步数据库会话。

    Returns:
        当前登录的管理员 ORM 行。

    Raises:
        HTTPException: 未登录或登录已过期时返回 401。
    """
    unauthorized = HTTPException(status_code=401, detail="未登录或登录已过期")

    if not authorization or not authorization.startswith("Bearer "):
        raise unauthorized

    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise unauthorized

    try:
        admin_user_id = decode_access_token(token)
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        raise unauthorized from None

    result = await db.execute(select(AdminUserRow).where(AdminUserRow.id == admin_user_id))
    row = result.scalar_one_or_none()
    if row is None or not row.is_active:
        raise unauthorized

    return row


async def seed_default_admin() -> None:
    """写入默认管理员账号（按用户名去重）。

    仅当 ``admin_users`` 表中不存在配置的用户名时创建，
    密码使用 bcrypt 哈希后存储；重复执行不会覆盖已有密码。

    Returns:
        无返回值。
    """
    async with async_session() as session:
        result = await session.execute(
            select(AdminUserRow).where(AdminUserRow.username == settings.admin_initial_username)
        )
        if result.scalar_one_or_none() is not None:
            return

        session.add(
            AdminUserRow(
                username=settings.admin_initial_username,
                password_hash=hash_password(settings.admin_initial_password),
                is_active=True,
            )
        )
        await session.commit()
