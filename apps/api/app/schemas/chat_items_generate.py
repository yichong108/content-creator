from pydantic import BaseModel, Field

from app.schemas.chat_item import ChatItem


class GenerateChatItemsRequest(BaseModel):
    """根据标题自动生成聊天记录的请求体。"""

    title: str = Field(min_length=1, max_length=200, description="会话标题，作为对话主题")


class GenerateChatItemsResponse(BaseModel):
    """自动生成聊天记录的响应体。"""

    chat_items: list[ChatItem] = Field(description="生成的聊天记录数组")
