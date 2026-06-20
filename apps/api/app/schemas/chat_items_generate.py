from pydantic import BaseModel, Field

from app.schemas.chat_item import ChatItem


class GenerateChatItemsRequest(BaseModel):
    """根据标题与人设自动生成聊天记录的请求体。"""

    title: str = Field(min_length=1, max_length=200, description="会话标题，作为对话主题")
    description: str | None = Field(default=None, description="可选会话描述，补充场景信息")
    peer_npc_ids: list[int] = Field(default_factory=list, description="对方 NPC ID 列表")
    self_npc_id: int | None = Field(default=None, description="己方 NPC ID")


class GenerateChatItemsResponse(BaseModel):
    """自动生成聊天记录的响应体。"""

    chat_items: list[ChatItem] = Field(description="生成的聊天记录数组")
