"""将 FastAPI 异常统一转换为 ``ApiResponse`` JSON 格式。

与前端 ``request`` 约定一致：正常 API 响应（含业务失败）均返回 HTTP 200，
由 body 中的 ``code`` 区分成败；仅网络/网关层异常由前端 ``ok: false`` 兜底。
"""

import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.schemas.error_codes import ERR_INTERNAL, ERR_VALIDATION, business_code_for_http
from app.schemas.response import ApiResponse, fail

# 与前端约定：可解析的 envelope 响应统一使用 HTTP 200
ENVELOPE_HTTP_STATUS = 200

logger = logging.getLogger(__name__)


def _envelope_json(body: ApiResponse) -> JSONResponse:
    """将 ``ApiResponse`` 序列化为 JSON 响应。

    Args:
        body: 统一响应体。

    Returns:
        HTTP 200 的 JSON 响应。
    """
    return JSONResponse(status_code=ENVELOPE_HTTP_STATUS, content=body.model_dump())


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
    """注册全局异常处理器，保证错误响应符合 ``ApiResponse`` 规范。

    业务错误与校验失败均返回 HTTP 200 + ``code != 0`` 的 envelope，
    便于前端 ``request`` 统一解析。

    Args:
        app: FastAPI 应用实例。
    """

    @app.exception_handler(HTTPException)
    async def http_exception_handler(_request: Request, exc: HTTPException) -> JSONResponse:
        detail = exc.detail
        message = detail if isinstance(detail, str) else str(detail)
        body = fail(code=business_code_for_http(exc.status_code), message=message)
        return _envelope_json(body)

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        _request: Request,
        exc: RequestValidationError,
    ) -> JSONResponse:
        body = fail(code=ERR_VALIDATION, message=_format_validation_error(exc))
        return _envelope_json(body)

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(_request: Request, exc: Exception) -> JSONResponse:
        logger.exception("未处理异常: %s", exc)
        body = fail(code=ERR_INTERNAL, message="服务器内部错误，请稍后重试")
        return _envelope_json(body)
