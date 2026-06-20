from typing import Literal

from pydantic import BaseModel, Field


class ChatItem(BaseModel):
    """与 @wechat-bot/chat-item 及前端 ChatItem 类型一致的聊天项。"""

    kind: Literal["timestamp", "system", "incoming", "outgoing"] = Field(
        description="消息类型：时间戳、系统提示、非己方消息(incoming)、己方消息(outgoing)",
    )
    text: str = Field(min_length=1, description="展示文本")
