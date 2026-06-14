from typing import Literal

from pydantic import BaseModel, Field


class ChatItem(BaseModel):
    """与前端 ChatItem 类型一致的聊天项。"""

    kind: Literal["timestamp", "system", "incoming", "outgoing"] = Field(
        description="消息类型：时间戳、系统提示、对方消息、本人消息",
    )
    text: str = Field(min_length=1, description="展示文本")
