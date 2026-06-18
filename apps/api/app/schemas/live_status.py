from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.chat_item import ChatItem


class LiveStatusResponse(BaseModel):
    """直播页当前展示会话的运行状态。"""

    live_session_id: int | None = Field(description="当前直播展示会话 ID，无则为 null")
    title: str | None = Field(description="当前直播展示会话标题")
    running: bool = Field(description="是否正在实时续写")
    chat_item_count: int = Field(description="当前聊天记录条数")
    updated_at: datetime | None = Field(description="会话最后更新时间")


class LiveChatItemsAppendResponse(BaseModel):
    """增量拉取直播聊天记录的响应。"""

    items: list[ChatItem] = Field(description="since 索引之后的新消息；无 since 时为全部消息")
    total: int = Field(description="当前会话聊天记录总条数")


class LiveWsConnectedPayload(BaseModel):
    """WebSocket connected 事件载荷。"""

    live_session_id: int = Field(description="当前直播展示会话 ID")
    title: str = Field(description="当前直播展示会话标题")
    running: bool = Field(description="是否正在实时续写")
    total: int = Field(description="当前聊天记录总条数")


class LiveWsMessagePayload(BaseModel):
    """WebSocket message 事件载荷。"""

    live_session_id: int = Field(description="直播会话 ID")
    item: ChatItem = Field(description="新追加的单条消息")
    total: int = Field(description="当前聊天记录总条数")
    index: int = Field(description="新消息在数组中的索引")


class LiveWsStatusPayload(BaseModel):
    """WebSocket status 事件载荷。"""

    live_session_id: int = Field(description="直播会话 ID")
    running: bool = Field(description="是否正在实时续写")
    total: int = Field(description="当前聊天记录总条数")


class LiveWsTypingPayload(BaseModel):
    """WebSocket typing 事件载荷。"""

    live_session_id: int = Field(description="直播会话 ID")
    typing: bool = Field(description="是否正在生成下一条消息")
    speaker: Literal["incoming", "outgoing"] = Field(
        description="预测的下一条消息发送方；incoming 为对方，outgoing 为自己"
    )
