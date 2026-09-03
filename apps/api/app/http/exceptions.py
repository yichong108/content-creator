"""将 FastAPI 异常统一转换为统一 JSON 响应格式。

成功：
代码在路由调用 success_response() 返回，框架处理返回 HTTP 2xx

失败：
在代码里面抛出异常，比如 raise HTTPException(status_code=401, detail="Unauthorized")
由异常处理器统一处理并返回对应 HTTP 状态码

返回的 JSON 结构：
{
    "code": 0,
    "message": "success",
    "data": <T | null>
}

{
    "code": 40401,
    "message": "error message",
    "data": null
}
"""

import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.schemas.error_codes import ERR_BAD_REQUEST, ERR_INTERNAL, business_code_for_http
from app.schemas.response import fail_json_response

logger = logging.getLogger(__name__)


def _format_validation_error(exc: RequestValidationError) -> str:
    """将 Pydantic 校验错误格式化为单条中文描述。

    Args:
        exc: FastAPI 请求校验异常。

    Returns:
        用分号连接的字段错误信息。
    """
    messages: list[str] = []

    for error in exc.errors():
        location = ".".join(str(part) for part in error.get("loc", [])[1:])
        msg = str(error.get("msg", ""))
        if location:
            messages.append(f"{location}: {msg}")
        elif msg:
            messages.append(msg)

    return "；".join(messages) if messages else "请求数据验证失败"


def register_exception_handlers(app: FastAPI) -> None:
    """注册全局异常处理器。

    Args:
        app: FastAPI 应用实例。
    """

    @app.exception_handler(HTTPException)
    async def http_exception_handler(_request: Request, exc: HTTPException) -> JSONResponse:
        detail = exc.detail
        message = detail if isinstance(detail, str) else str(detail)
        return fail_json_response(business_code_for_http(exc.status_code), message)

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        _request: Request,
        exc: RequestValidationError,
    ) -> JSONResponse:
        return fail_json_response(ERR_BAD_REQUEST, _format_validation_error(exc))

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(_request: Request, exc: Exception) -> JSONResponse:
        logger.exception("未处理异常: %s", exc)
        return fail_json_response(ERR_INTERNAL, "服务器内部错误，请稍后重试")
