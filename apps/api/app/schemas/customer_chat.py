"""客户聊天相关的 Pydantic schemas。"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.rag import RagSource


class CustomerChatMessage(BaseModel):
    """客户聊天消息（ORM 行的 API 投影）。"""

    id: int = Field(description="消息 ID")
    role: Literal["user", "assistant"] = Field(description="消息角色")
    content: str = Field(description="消息正文")
    created_at: datetime = Field(description="消息创建时间")


class CustomerChatHistoryResponse(BaseModel):
    """客户聊天历史加载响应。

    消息列表按时间升序排列（最旧在前、最新在后），
    便于前端直接追加渲染；游标用于下次向上翻页时定位起点。
    """

    messages: list[CustomerChatMessage] = Field(description="本次加载的消息列表")
    has_more: bool = Field(description="是否还有更早的历史消息")
    next_cursor: int | None = Field(default=None, description="翻页游标（最早一条的 id），has_more=True 时返回")


class CustomerChatSendRequest(BaseModel):
    """客户发送消息请求体。"""

    session_id: str = Field(min_length=1, max_length=64, description="客户会话标识（前端生成的 UUID）")
    message: str = Field(min_length=1, max_length=5000, description="客户输入的消息正文")


class CustomerChatSendResponse(BaseModel):
    """客户发送消息响应体。"""

    message: CustomerChatMessage = Field(description="AI 客服回复消息")
    sources: list[RagSource] = Field(default_factory=list, description="RAG 检索到的参考来源列表")
