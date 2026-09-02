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
