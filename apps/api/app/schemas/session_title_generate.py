from pydantic import BaseModel, Field

from app.schemas.chat_item import ChatItem


class GenerateSessionTitleRequest(BaseModel):
    """自动生成会话标题的请求体。"""

    description: str | None = Field(
        default=None,
        max_length=2000,
        description="可选描述，作为标题主题参考",
    )
    chat_items: list[ChatItem] | None = Field(
        default=None,
        description="可选聊天记录，用于从对话内容提炼标题",
    )


class GenerateSessionTitleResponse(BaseModel):
    """自动生成会话标题的响应体。"""

    title: str = Field(max_length=200, description="生成的会话标题")
