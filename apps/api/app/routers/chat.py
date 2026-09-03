import asyncio
import logging

from fastapi import APIRouter, Response

from app.schemas.chat import ChatMessage, ChatRequest, ChatResponse
from app.schemas.response import ApiResponse, success_response
from app.services.ai_errors import (
    AiAuthenticationError,
    AiConfigurationError,
    AiConnectionError,
    AiResponseError,
    AiUnavailableError,
)
from app.services.ai_http import fail_from_ai_error
from app.services.ai_provider import invoke_chat, validate_ai_config

router = APIRouter(tags=["chat"])
logger = logging.getLogger(__name__)


@router.post("/chat")
async def chat(request: ChatRequest, response: Response) -> ApiResponse[ChatResponse | None]:
    """根据对话历史调用 AI 聊天补全，返回助手回复。

    Args:
        request: 含完整 messages 列表的请求体。
        response: FastAPI 响应对象，失败时用于写入 HTTP 状态码。

    Returns:
        统一响应包裹的助手最新消息。
    """
    validation_error = validate_ai_config()
    if validation_error:
        return fail_from_ai_error(AiConfigurationError(validation_error), response)

    payload = [message.model_dump() for message in request.messages]

    try:
        content = await asyncio.to_thread(invoke_chat, payload)
    except (
        AiConfigurationError,
        AiAuthenticationError,
        AiConnectionError,
        AiUnavailableError,
        AiResponseError,
        ValueError,
    ) as exc:
        return fail_from_ai_error(exc, response)

    return success_response(
        ChatResponse(
            message=ChatMessage(role="assistant", content=content),
        ),
    )
