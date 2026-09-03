"""统一 API 响应规范。

成功：HTTP 2xx + ``{ code: 0, message, data }``
失败：HTTP 4xx/5xx + ``{ code: 非0, message, data: null }``
"""

from fastapi import Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.schemas.error_codes import API_SUCCESS_CODE, http_status_for_business_code


class ApiResponse[T](BaseModel):
    """统一 API 响应体。

    成功与失败均使用该结构；失败时 ``data`` 为 ``null``。
    """

    code: int = Field(default=API_SUCCESS_CODE, description="业务状态码；0 表示成功")
    message: str = Field(default="", description="人类可读的状态描述")
    data: T | None = Field(default=None, description="业务数据；失败时为 null")


def success_response[T](data: T, message: str = "success") -> ApiResponse[T]:
    """构造成功响应。

    Args:
        data: 业务数据（Pydantic 模型、列表、字典或 ``None``）。
        message: 人类可读描述，默认 ``success``。

    Returns:
        ``code=0`` 的 ``ApiResponse``，由 FastAPI 序列化为 HTTP 200 JSON。
    """
    return ApiResponse[T](code=API_SUCCESS_CODE, message=message, data=data)


def fail_response[T](response: Response, code: int, message: str) -> ApiResponse[T]:
    """构造失败响应并设置 HTTP 状态码。

    返回类型参数 ``T`` 由调用处期望的 ``ApiResponse[T]`` 推断，
    避免 ``ApiResponse[None]`` 与具体业务数据类型不兼容。

    Args:
        response: FastAPI 响应对象，用于写入 HTTP 状态码。
        code: 业务错误码。
        message: 人类可读错误描述。

    Returns:
        ``data=None`` 的 ``ApiResponse[T]``。
    """
    response.status_code = http_status_for_business_code(code)
    return ApiResponse[T](code=code, message=message, data=None)


def fail_json_response(code: int, message: str) -> JSONResponse:
    """构造失败 JSON 响应（供异常处理器使用）。

    Args:
        code: 业务错误码。
        message: 人类可读错误描述。

    Returns:
        body 为 ``ApiResponse`` 的 ``JSONResponse``。
    """
    body = ApiResponse[None](code=code, message=message, data=None)
    return JSONResponse(
        status_code=http_status_for_business_code(code),
        content=body.model_dump(),
    )
