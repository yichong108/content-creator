"""将 FastAPI 异常统一转换为 ``ApiResponse`` JSON 格式。"""

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.schemas.error_codes import ERR_INTERNAL, ERR_VALIDATION, business_code_for_http
from app.schemas.response import fail


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

    HTTP 状态码与 body ``code``（业务错误码）分别设置，互不替代。

    Args:
        app: FastAPI 应用实例。
    """

    @app.exception_handler(HTTPException)
    async def http_exception_handler(_request: Request, exc: HTTPException) -> JSONResponse:
        detail = exc.detail
        message = detail if isinstance(detail, str) else str(detail)
        body = fail(code=business_code_for_http(exc.status_code), message=message)
        return JSONResponse(status_code=exc.status_code, content=body.model_dump())

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        _request: Request,
        exc: RequestValidationError,
    ) -> JSONResponse:
        body = fail(code=ERR_VALIDATION, message=_format_validation_error(exc))
        return JSONResponse(status_code=422, content=body.model_dump())

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(_request: Request, _exc: Exception) -> JSONResponse:
        body = fail(code=ERR_INTERNAL, message="服务器内部错误，请稍后重试")
        return JSONResponse(status_code=500, content=body.model_dump())
