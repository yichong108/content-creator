from datetime import datetime

from pydantic import BaseModel, Field


class MobileSessionSummary(BaseModel):
    """移动端会话列表项，供 Web 根路径会话列表页展示。"""

    id: int = Field(description="直播会话 ID")
    title: str = Field(description="会话标题，通常为对方昵称")
    last_message: str | None = Field(default=None, description="最近一条消息预览")
    peer_avatar_url: str | None = Field(default=None, description="对方头像 URL")
    updated_at: datetime = Field(description="最近更新时间")
