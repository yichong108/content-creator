"""AI 提供商配置 schema。"""

from typing import Literal

from pydantic import BaseModel, Field


class OpenAiConfig(BaseModel):
    """OpenAI 兼容 API 配置。"""

    api_key: str = Field(default="", description="OpenAI 或兼容服务的 API Key")
    base_url: str = Field(default="", description="可选自定义 Base URL")
    model: str = Field(default="gpt-4o-mini", description="默认模型名称")


class CursorSdkConfig(BaseModel):
    """Cursor SDK 配置。"""

    api_key: str = Field(default="", description="Cursor API Key")
    model: str = Field(default="composer-2.5", description="Agent 使用的模型 ID")
    runtime: Literal["local", "cloud"] = Field(
        default="local",
        description="运行环境：local 本地、cloud 云端",
    )
    cwd: str = Field(default="", description="local 模式下的工作目录")
    repos: str = Field(
        default="",
        description="cloud 模式下的 Git 仓库地址，多个用逗号或换行分隔",
    )


class AiConfig(BaseModel):
    """当前启用的 AI 提供商及两套独立配置。"""

    provider: Literal["openai", "cursor_sdk"] = Field(
        default="openai",
        description="当前选中的 AI 提供商",
    )
    openai: OpenAiConfig = Field(default_factory=OpenAiConfig)
    cursor_sdk: CursorSdkConfig = Field(default_factory=CursorSdkConfig)
