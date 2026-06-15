import asyncio
import logging

from fastapi import APIRouter
from openai import APIConnectionError, APIStatusError, AuthenticationError

from app.config import settings
from app.graph.chat import chat_graph, to_langchain_messages
from app.schemas.chat import ChatMessage, ChatRequest, ChatResponse
from app.schemas.error_codes import ERR_BAD_REQUEST, ERR_INTERNAL
from app.schemas.response import ApiResponse, fail, ok

router = APIRouter(tags=["chat"])
logger = logging.getLogger(__name__)


@router.post("/chat", response_model=ApiResponse[ChatResponse])
async def chat(request: ChatRequest) -> ApiResponse[ChatResponse | None]:
    """根据对话历史调用 LangGraph 聊天图，返回助手回复。

    Args:
        request: 含完整 messages 列表的请求体。

    Returns:
        统一 ``ApiResponse`` 包裹的助手最新消息。
    """
    if not settings.openai_api_key.strip():
        return fail(ERR_BAD_REQUEST, "未配置 OPENAI_API_KEY，请在 apps/api/.env 中设置")

    payload = [message.model_dump() for message in request.messages]
    state = {"messages": to_langchain_messages(payload)}

    try:
        result = await asyncio.to_thread(chat_graph.invoke, state)
    except AuthenticationError:
        return fail(ERR_BAD_REQUEST, "OPENAI_API_KEY 无效，请检查 apps/api/.env")
    except APIConnectionError:
        return fail(ERR_INTERNAL, "AI 服务连接失败，请稍后重试")
    except APIStatusError as exc:
        logger.warning("LLM API 错误: %s", exc)
        return fail(ERR_INTERNAL, "AI 服务暂时不可用，请稍后重试")

    last = result["messages"][-1]
    return ok(
        ChatResponse(
            message=ChatMessage(role="assistant", content=str(last.content)),
        ),
    )
