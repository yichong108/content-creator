"""将统一 AI 异常映射为 API 响应。"""

import logging

from fastapi import Response

from app.schemas.error_codes import ERR_BAD_REQUEST, ERR_INTERNAL
from app.schemas.response import ApiResponse, fail_response
from app.services.ai_errors import (
    AiAuthenticationError,
    AiConfigurationError,
    AiConnectionError,
    AiResponseError,
    AiUnavailableError,
)

logger = logging.getLogger(__name__)


def fail_from_ai_error[T](exc: Exception, response: Response) -> ApiResponse[T]:
    """把 AI 层异常转为统一失败响应。

    返回类型参数 ``T`` 由调用处期望的 ``ApiResponse[T]`` 推断。

    Args:
        exc: AI 服务抛出的异常。
        response: FastAPI 响应对象，用于写入 HTTP 状态码。

    Returns:
        含业务错误码与提示文案的 ``ApiResponse[T]``。
    """
    if isinstance(exc, AiConfigurationError | AiAuthenticationError):
        return fail_response(response, ERR_BAD_REQUEST, str(exc))
    if isinstance(exc, AiConnectionError | AiUnavailableError | AiResponseError):
        return fail_response(response, ERR_INTERNAL, str(exc))
    if isinstance(exc, ValueError):
        return fail_response(response, ERR_INTERNAL, str(exc))

    logger.exception("未处理的 AI 异常")
    return fail_response(response, ERR_INTERNAL, "AI 服务暂时不可用，请稍后重试")
