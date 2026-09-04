from sqlalchemy import BigInteger, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.mixins import TimestampMixin


class DocumentRow(TimestampMixin, Base):
    """RAG 知识库文档行，记录上传文件元信息，磁盘文件存储于 uploads/documents/。"""

    __tablename__ = "documents"

    # 主键，自增
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    # 文件原始名称（含扩展名）
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    # 文件扩展名，不含点号，如 "pdf"、"txt"
    extension: Mapped[str] = mapped_column(String(16), nullable=False)
    # 文件大小，单位字节
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
