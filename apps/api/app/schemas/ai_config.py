"""AI 提供商配置 schema。"""

from pydantic import BaseModel, Field


class OpenAiConfig(BaseModel):
    """OpenAI 兼容 API 配置。"""

    api_key: str = Field(default="", description="OpenAI 或兼容服务的 API Key")
    base_url: str = Field(default="", description="可选自定义 Base URL")
    model: str = Field(default="gpt-4o-mini", description="默认模型名称")


class AiConfig(BaseModel):
    """OpenAI 兼容 API 配置。"""

    openai: OpenAiConfig = Field(default_factory=OpenAiConfig)
    # token 总量额度上限，用于「token 用量」页面计算消耗占比
    token_quota: int = Field(default=1_000_000, ge=1, description="token 总量额度")
