import asyncio
import logging

from fastapi import APIRouter

from app.graph.chat import chat_graph, to_langchain_messages
from app.schemas.chat import ChatMessage, ChatRequest, ChatResponse
from app.schemas.response import ApiResponse, ok
from app.services.ai_errors import (
    AiAuthenticationError,
    AiConfigurationError,
    AiConnectionError,
    AiResponseError,
    AiUnavailableError,
)
from app.services.ai_http import fail_from_ai_error
from app.services.ai_provider import validate_ai_config

router = APIRouter(tags=["chat"])
logger = logging.getLogger(__name__)


@router.post("/chat", response_model=ApiResponse[ChatResponse])
async def chat(request: ChatRequest) -> ApiResponse[ChatResponse | None]:
    """根据对话历史调用聊天图，返回助手回复。

    Args:
        request: 含完整 messages 列表的请求体。

    Returns:
        统一 ``ApiResponse`` 包裹的助手最新消息。
    """
    validation_error = validate_ai_config()
    if validation_error:
        return fail_from_ai_error(AiConfigurationError(validation_error))

    payload = [message.model_dump() for message in request.messages]
    state = {"messages": to_langchain_messages(payload)}

    try:
        result = await asyncio.to_thread(chat_graph.invoke, state)
    except (
        AiConfigurationError,
        AiAuthenticationError,
        AiConnectionError,
        AiUnavailableError,
        AiResponseError,
        ValueError,
    ) as exc:
        return fail_from_ai_error(exc)

    last = result["messages"][-1]
    return ok(
        ChatResponse(
            message=ChatMessage(role="assistant", content=str(last.content)),
        ),
    )
