from pydantic import BaseModel, Field


class GenerateSessionTitleRequest(BaseModel):
    """自动生成会话标题的请求体，标题依据可选描述生成；无描述时随机生成。"""

    description: str | None = Field(
        default=None,
        max_length=2000,
        description="可选描述，作为标题依据",
    )


class GenerateSessionTitleResponse(BaseModel):
    """自动生成会话标题的响应体。"""

    title: str = Field(max_length=200, description="生成的会话标题")
