from datetime import datetime

from pydantic import BaseModel, Field


class DocumentSummary(BaseModel):
    """文档列表项（列表与上传返回一致）。"""

    id: int = Field(description="文档 ID")
    filename: str = Field(description="原始文件名")
    extension: str = Field(description="小写扩展名，如 .pdf / .txt / .docx")
    file_size: int = Field(description="文件字节数")
    created_at: datetime = Field(description="上传时间")
    updated_at: datetime = Field(description="更新时间")
