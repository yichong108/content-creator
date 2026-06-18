from datetime import datetime

from pydantic import BaseModel, Field


class NpcSummary(BaseModel):
    """NPC 列表项与详情（字段一致）。"""

    id: int = Field(description="NPC ID")
    name: str = Field(description="NPC 名称")
    persona_description: str = Field(description="人设描述")
    created_at: datetime = Field(description="创建时间")
    updated_at: datetime = Field(description="更新时间")


class NpcCreate(BaseModel):
    """创建 NPC 请求体。"""

    name: str = Field(min_length=1, max_length=200, description="NPC 名称")
    persona_description: str = Field(min_length=1, description="人设描述")


class NpcUpdate(BaseModel):
    """更新 NPC 请求体，字段均为可选。"""

    name: str | None = Field(default=None, min_length=1, max_length=200, description="NPC 名称")
    persona_description: str | None = Field(default=None, min_length=1, description="人设描述")
