from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.chat_item import ChatItem
from app.schemas.npc import NpcSummary


class LiveSessionSummary(BaseModel):
    """直播会话列表项，不含完整聊天记录。"""

    id: int = Field(description="直播会话 ID")
    title: str = Field(description="直播会话标题")
    description: str | None = Field(default=None, description="直播会话描述")
    chat_item_count: int = Field(description="聊天记录条数")
    peer_npc_ids: list[int] = Field(default_factory=list, description="对方 NPC ID 列表")
    self_npc_id: int | None = Field(default=None, description="己方 NPC ID")
    enabled: bool = Field(description="是否作为当前直播展示会话")
    running: bool = Field(description="是否正在实时续写聊天记录")
    created_at: datetime = Field(description="创建时间")
    updated_at: datetime = Field(description="更新时间")


class LiveSessionDetail(LiveSessionSummary):
    """直播会话详情，包含完整聊天记录 JSON。"""

    chat_items: list[ChatItem] = Field(description="聊天记录数组")
    peer_npcs: list[NpcSummary] = Field(default_factory=list, description="对方 NPC 详情列表")
    self_npc: NpcSummary | None = Field(default=None, description="己方 NPC 详情")


class LiveSessionCreate(BaseModel):
    """创建直播会话请求体。"""

    title: str = Field(min_length=1, max_length=200, description="直播会话标题")
    description: str | None = Field(default=None, description="直播会话描述")
    peer_npc_ids: list[int] = Field(default_factory=list, description="对方 NPC ID 列表")
    self_npc_id: int | None = Field(default=None, description="己方 NPC ID")
    chat_items: list[ChatItem] = Field(default_factory=list, description="聊天记录数组")


class LiveSessionUpdate(BaseModel):
    """更新直播会话请求体，字段均为可选。"""

    title: str | None = Field(default=None, min_length=1, max_length=200, description="直播会话标题")
    description: str | None = Field(default=None, description="直播会话描述")
    peer_npc_ids: list[int] | None = Field(default=None, description="对方 NPC ID 列表")
    self_npc_id: int | None = Field(default=None, description="己方 NPC ID")
    chat_items: list[ChatItem] | None = Field(default=None, description="聊天记录数组")


class LiveSessionEnabledUpdate(BaseModel):
    """更新直播会话展示开关。"""

    enabled: bool = Field(description="是否作为当前直播展示会话")


class LiveSessionRunningUpdate(BaseModel):
    """更新直播会话运行状态。"""

    running: bool = Field(description="是否开始/停止实时续写聊天记录")
