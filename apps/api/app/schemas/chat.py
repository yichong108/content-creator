from typing import Literal

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    """单条聊天消息，角色限定为用户或助手。"""

    role: Literal["user", "assistant"] = "user"
    content: str = Field(min_length=1, description="消息正文")


class ChatRequest(BaseModel):
    """聊天接口请求体，携带完整对话历史。"""

    messages: list[ChatMessage]


class ChatResponse(BaseModel):
    """聊天接口响应体，返回助手最新一条回复。"""

    message: ChatMessage
