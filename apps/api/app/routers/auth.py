from datetime import UTC

from fastapi import APIRouter, Depends, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.admin_user import AdminUserRow
from app.schemas.auth import AdminUserSummary, LoginRequest, LoginResponse
from app.schemas.error_codes import ERR_UNAUTHORIZED
from app.schemas.response import ApiResponse, fail_response, success_response
from app.services.auth_security import (
    create_access_token,
    get_current_admin,
    verify_password,
)

router = APIRouter(tags=["admin-auth"])


def _to_summary(row: AdminUserRow) -> AdminUserSummary:
    """将 ORM 行转换为管理员摘要。

    Args:
        row: 数据库管理员行。

    Returns:
        不含敏感字段的管理员摘要对象。
    """
    return AdminUserSummary(
        id=row.id,
        username=row.username,
        created_at=row.created_at,
    )


@router.post("/login")
async def login(
    payload: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[LoginResponse | None]:
    """管理员登录，校验账号密码并签发 JWT 令牌。

    Args:
        payload: 登录请求体。
        response: FastAPI 响应对象，用于写入失败状态码。
        db: 异步数据库会话。

    Returns:
        成功返回含令牌的登录响应；账号或密码错误返回 401。
    """
    result = await db.execute(select(AdminUserRow).where(AdminUserRow.username == payload.username))
    row = result.scalar_one_or_none()

    if row is None or not row.is_active or not verify_password(payload.password, row.password_hash):
        return fail_response(response, ERR_UNAUTHORIZED, "用户名或密码错误")

    token, expires_at = create_access_token(row.id)
    expires_at_utc = expires_at.astimezone(UTC)
    return success_response(
        LoginResponse(
            token=token,
            token_type="bearer",
            expires_at=expires_at_utc,
            user=_to_summary(row),
        )
    )


@router.get("/me")
async def get_me(
    current_admin: AdminUserRow = Depends(get_current_admin),
) -> ApiResponse[AdminUserSummary]:
    """返回当前登录管理员信息，用于前端校验令牌有效性。

    Args:
        current_admin: 由鉴权依赖解析出的当前管理员。

    Returns:
        当前管理员的摘要信息。
    """
    return success_response(_to_summary(current_admin))
