from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.services.npc_tags import normalize_npc_tags


class NpcSummary(BaseModel):
    """NPC 列表项与详情（字段一致）。"""

    id: int = Field(description="NPC ID")
    name: str = Field(description="NPC 名称")
    persona_description: str = Field(description="人设描述")
    tags: list[str] = Field(default_factory=list, description="标签列表")
    created_at: datetime = Field(description="创建时间")
    updated_at: datetime = Field(description="更新时间")


class NpcCreate(BaseModel):
    """创建 NPC 请求体。"""

    name: str = Field(min_length=1, max_length=200, description="NPC 名称")
    persona_description: str = Field(min_length=1, description="人设描述")
    tags: list[str] = Field(default_factory=list, description="标签列表")

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, value: list[str]) -> list[str]:
        """规范化标签列表。"""
        return normalize_npc_tags(value)


class NpcUpdate(BaseModel):
    """更新 NPC 请求体，字段均为可选。"""

    name: str | None = Field(default=None, min_length=1, max_length=200, description="NPC 名称")
    persona_description: str | None = Field(default=None, min_length=1, description="人设描述")
    tags: list[str] | None = Field(default=None, description="标签列表")

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, value: list[str] | None) -> list[str] | None:
        """规范化标签列表。"""
        if value is None:
            return None
        return normalize_npc_tags(value)
