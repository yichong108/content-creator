from typing import Literal

from pydantic import BaseModel, Field, model_validator


class ChatItem(BaseModel):
    """与 @wechat-bot/chat-item 及前端 ChatItem 类型一致的聊天项。"""

    kind: Literal["timestamp", "system", "incoming", "outgoing"] = Field(
        description="消息类型：时间戳、系统提示、非己方消息(incoming)、己方消息(outgoing)",
    )
    text: str = Field(min_length=1, description="展示文本")
    npc_id: int | None = Field(default=None, gt=0, description="发言 NPC ID，incoming/outgoing 必填")
    npc_name: str | None = Field(default=None, min_length=1, description="发言 NPC 名称，incoming/outgoing 必填")
    npc_avatar_url: str | None = Field(
        default=None,
        min_length=1,
        description="发言 NPC 头像 URL，incoming/outgoing 必填",
    )

    @model_validator(mode="after")
    def validate_npc_info(self) -> "ChatItem":
        """校验 incoming/outgoing 必须携带 NPC 信息。"""
        if self.kind in ("incoming", "outgoing"):
            if self.npc_id is None:
                raise ValueError(f"{self.kind} 消息缺少 npc_id")
            if self.npc_name is None or not self.npc_name.strip():
                raise ValueError(f"{self.kind} 消息缺少 npc_name")
            if self.npc_avatar_url is None or not self.npc_avatar_url.strip():
                raise ValueError(f"{self.kind} 消息缺少 npc_avatar_url")
            self.npc_name = self.npc_name.strip()
            self.npc_avatar_url = self.npc_avatar_url.strip()
        else:
            self.npc_id = None
            self.npc_name = None
            self.npc_avatar_url = None
        return self
