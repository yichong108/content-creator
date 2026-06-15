from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.chat_item import ChatItem


class SessionSummary(BaseModel):
    """会话列表项，不含完整聊天记录。"""

    id: int = Field(description="会话 ID")
    title: str = Field(description="会话标题")
    description: str | None = Field(default=None, description="会话描述")
    chat_item_count: int = Field(description="聊天记录条数")
    created_at: datetime = Field(description="创建时间")
    updated_at: datetime = Field(description="更新时间")


class SessionDetail(SessionSummary):
    """会话详情，包含完整聊天记录 JSON。"""

    chat_items: list[ChatItem] = Field(description="聊天记录数组")


class SessionCreate(BaseModel):
    """创建会话请求体。"""

    title: str = Field(min_length=1, max_length=200, description="会话标题")
    description: str | None = Field(default=None, description="会话描述")
    chat_items: list[ChatItem] = Field(default_factory=list, description="聊天记录数组")


class SessionUpdate(BaseModel):
    """更新会话请求体，字段均为可选。"""

    title: str | None = Field(default=None, min_length=1, max_length=200, description="会话标题")
    description: str | None = Field(default=None, description="会话描述")
    chat_items: list[ChatItem] | None = Field(default=None, description="聊天记录数组")
