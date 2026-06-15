"""将统一 AI 异常映射为 API 响应。"""

import logging

from app.schemas.error_codes import ERR_BAD_REQUEST, ERR_INTERNAL
from app.schemas.response import ApiResponse, fail
from app.services.ai_errors import (
    AiAuthenticationError,
    AiConfigurationError,
    AiConnectionError,
    AiResponseError,
    AiUnavailableError,
)

logger = logging.getLogger(__name__)


def fail_from_ai_error(exc: Exception) -> ApiResponse[None]:
    """把 AI 层异常转为统一 ``ApiResponse`` 失败响应。

    Args:
        exc: AI 服务抛出的异常。

    Returns:
        含错误码与提示文案的失败响应。
    """
    if isinstance(exc, AiConfigurationError | AiAuthenticationError):
        return fail(ERR_BAD_REQUEST, str(exc))
    if isinstance(exc, AiConnectionError | AiUnavailableError | AiResponseError):
        return fail(ERR_INTERNAL, str(exc))
    if isinstance(exc, ValueError):
        return fail(ERR_INTERNAL, str(exc))

    logger.exception("未处理的 AI 异常")
    return fail(ERR_INTERNAL, "AI 服务暂时不可用，请稍后重试")
