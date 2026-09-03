"""后台管理员账号认证相关 Schema。"""

from datetime import datetime

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    """登录请求体。"""

    username: str = Field(min_length=1, max_length=64, description="管理员用户名")
    password: str = Field(min_length=1, description="登录密码")


class AdminUserSummary(BaseModel):
    """管理员账号摘要（不含密码哈希）。"""

    id: int = Field(description="管理员 ID")
    username: str = Field(description="管理员用户名")
    created_at: datetime = Field(description="创建时间")


class LoginResponse(BaseModel):
    """登录成功响应，携带访问令牌与账号信息。"""

    token: str = Field(description="JWT 访问令牌")
    token_type: str = Field(default="bearer", description="令牌类型")
    expires_at: datetime = Field(description="令牌过期时间")
    user: AdminUserSummary = Field(description="当前登录的管理员账号")
