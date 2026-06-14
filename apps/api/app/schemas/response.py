"""统一 API 响应规范。

成功与失败均返回同一 JSON 结构::

    {
        "code": 0,
        "message": "ok",
        "data": <T | null>
    }

约定：

- ``code == 0``：业务成功，``data`` 为业务载荷
- ``code != 0``：业务失败，``data`` 为 ``null``；``code`` 为业务错误码（见 ``error_codes``）
- HTTP 状态码单独由响应行表达，不与 ``code`` 混用
"""

from pydantic import BaseModel, Field

from app.schemas.error_codes import API_SUCCESS_CODE


class ApiResponse[T](BaseModel):
    """统一 API 响应体。"""

    code: int = Field(description="0 表示业务成功，非 0 为业务错误码")
    message: str = Field(default="ok", description="人类可读的状态描述")
    data: T | None = Field(default=None, description="业务数据；失败时为 null")


def ok[T](data: T, message: str = "ok") -> ApiResponse[T]:
    """构造成功响应。

    Args:
        data: 业务数据载荷。
        message: 成功描述，默认 ``ok``。

    Returns:
        ``code=0`` 的 ``ApiResponse``。
    """
    return ApiResponse(code=API_SUCCESS_CODE, message=message, data=data)


def fail(code: int, message: str) -> ApiResponse[None]:
    """构造业务失败响应（无业务数据）。

    Args:
        code: 非 0 业务错误码（非 HTTP 状态码）。
        message: 面向客户端的错误描述。

    Returns:
        ``data=None`` 的 ``ApiResponse``。
    """
    return ApiResponse(code=code, message=message, data=None)
