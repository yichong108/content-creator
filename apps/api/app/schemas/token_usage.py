"""token 用量 schema。"""

from pydantic import BaseModel, Field


class TokenUsage(BaseModel):
    """累计 token 消耗与总量额度。"""

    used_tokens: int = Field(description="累计已消耗的 token 数")
    total_tokens: int = Field(description="token 总量额度上限")
