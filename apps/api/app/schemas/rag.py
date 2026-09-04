from pydantic import BaseModel, Field


class RagQueryRequest(BaseModel):
    """RAG 检索问答请求体。"""

    query: str = Field(min_length=1, description="用户提问")
    top_k: int = Field(default=4, ge=1, le=20, description="检索的相关文档片段数量")


class RagSource(BaseModel):
    """RAG 答案的来源片段。"""

    document_id: int = Field(description="来源文档 ID")
    filename: str = Field(description="来源文档文件名")
    score: float | None = Field(default=None, description="相似度得分")
    snippet: str = Field(description="截断后的来源片段文本")


class RagQueryResponse(BaseModel):
    """RAG 检索问答响应体。"""

    answer: str = Field(description="基于文档内容生成的答案")
    sources: list[RagSource] = Field(default_factory=list, description="答案来源片段列表")
