"""RAG 文档文件存储。"""

from __future__ import annotations

import re
from pathlib import Path

from app.config import settings

DOCUMENT_SUBDIR = "documents"
# 允许的扩展名 -> 内容类型映射；仅支持可被解析为文本的文档
ALLOWED_DOCUMENT_EXTENSIONS: dict[str, str] = {
    ".txt": "text/plain",
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
MAX_DOCUMENT_BYTES = 20 * 1024 * 1024  # 单个文档上限 20MB


def ensure_document_upload_dir() -> Path:
    """确保文档上传目录存在。

    Returns:
        文档目录绝对路径。
    """
    directory = settings.uploads_path / DOCUMENT_SUBDIR
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def document_extension_for(filename: str) -> str | None:
    """从文件名解析小写扩展名，并校验是否在允许范围内。

    Args:
        filename: 原始文件名。

    Returns:
        小写扩展名（含点）；不允许或无法解析时返回 ``None``。
    """
    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED_DOCUMENT_EXTENSIONS:
        return None
    return suffix


def resolve_document_path(path_or_url: str) -> Path | None:
    """将文档相对 URL 解析为磁盘绝对路径。

    Args:
        path_or_url: 形如 ``/uploads/documents/1.pdf`` 的路径。

    Returns:
        对应文件路径；非法时返回 ``None``。
    """
    if not path_or_url.startswith(f"/uploads/{DOCUMENT_SUBDIR}/"):
        return None

    filename = Path(path_or_url).name
    if not re.fullmatch(r"[\w.-]+", filename):
        return None

    return settings.uploads_path / DOCUMENT_SUBDIR / filename


def store_document_file(document_id: int, extension: str, content: bytes) -> str:
    """保存上传的文档并返回可访问的相对 URL。

    Args:
        document_id: 文档 ID。
        extension: 含点的小写扩展名。
        content: 文件字节内容。

    Returns:
        形如 ``/uploads/documents/{id}{ext}`` 的相对 URL。
    """
    directory = ensure_document_upload_dir()
    target = directory / f"{document_id}{extension}"
    target.write_bytes(content)
    return f"/uploads/{DOCUMENT_SUBDIR}/{document_id}{extension}"


def delete_document_file(document_id: int, extension: str) -> None:
    """删除指定文档的磁盘文件（若存在）。

    Args:
        document_id: 文档 ID。
        extension: 含点的小写扩展名。
    """
    path = settings.uploads_path / DOCUMENT_SUBDIR / f"{document_id}{extension}"
    if path.is_file():
        path.unlink(missing_ok=True)
