from fastapi import APIRouter

from app.graph.chat import chat_graph, to_langchain_messages
from app.schemas.chat import ChatMessage, ChatRequest, ChatResponse
from app.schemas.response import ApiResponse, ok

router = APIRouter(tags=["chat"])


@router.post("/chat", response_model=ApiResponse[ChatResponse])
async def chat(request: ChatRequest) -> ApiResponse[ChatResponse]:
    """根据对话历史调用 LangGraph 聊天图，返回助手回复。

    Args:
        request: 含完整 messages 列表的请求体。

    Returns:
        统一 ``ApiResponse`` 包裹的助手最新消息。
    """
    payload = [message.model_dump() for message in request.messages]
    state = {"messages": to_langchain_messages(payload)}
    result = chat_graph.invoke(state)
    last = result["messages"][-1]
    return ok(
        ChatResponse(
            message=ChatMessage(role="assistant", content=str(last.content)),
        ),
    )
