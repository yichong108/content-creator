"""RAG 文档文件存储。

磁盘命名规则：``{document_id}__{sanitized_original_stem}{extension}``
例如上传 ``运动的利与弊.txt`` 且数据库 ID 为 5，磁盘文件就是
``5__运动的利与弊.txt``。保留 ``{id}`` 前缀保证不冲突，
双下划线分隔让运维能一眼看出哪部分是系统 ID、哪部分是原文件名。

向后兼容：删除和解析路径时，会先尝试新命名，找不到再回退到旧格式
``{document_id}{extension}``，避免历史数据丢失。
"""

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

# 原始文件名 stem 的最大长度（字符数），防止极长文件名撑爆磁盘
_MAX_STEM_LENGTH = 80


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


def _sanitize_stem(stem: str) -> str:
    """清洗原始文件名中的主名部分（不含扩展名），使其可安全落盘。

    处理规则：
    1. 剥离路径组件（防止 ``../`` 穿越）
    2. 替换 Windows/Linux 下的非法字符为下划线
    3. 去除首尾的点和空格
    4. 截断到 ``_MAX_STEM_LENGTH`` 字符

    Args:
        stem: 文件名主名部分（不含扩展名）。

    Returns:
        清洗后的主名；清洗后为空时返回空串。
    """
    stem = Path(stem).name  # 防止 "dir/file.txt" 这种带路径的 stem
    # 替换非法字符：Windows 保留字符 + ASCII 控制字符
    stem = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", stem)
    stem = stem.strip(". \t")
    if len(stem) > _MAX_STEM_LENGTH:
        stem = stem[:_MAX_STEM_LENGTH].rstrip()
    return stem


def _build_disk_filename(document_id: int, original_filename: str) -> str:
    """根据数据库 ID 和原始文件名生成磁盘命名。

    格式：``{document_id}__{sanitized_stem}{extension}``
    若清洗后的 stem 为空，则回退为 ``{document_id}{extension}``。

    Args:
        document_id: 文档数据库 ID。
        original_filename: 用户上传时的原始文件名。

    Returns:
        磁盘文件名（仅文件名，不含目录）。
    """
    extension = Path(original_filename).suffix.lower() or ".txt"
    stem = Path(original_filename).stem
    sanitized = _sanitize_stem(stem)
    if sanitized:
        return f"{document_id}__{sanitized}{extension}"
    return f"{document_id}{extension}"


def build_document_relative_url(document_id: int, original_filename: str) -> str:
    """构造文档的相对访问 URL。

    Args:
        document_id: 文档数据库 ID。
        original_filename: 用户上传时的原始文件名。

    Returns:
        形如 ``/uploads/documents/5__运动的利与弊.txt`` 的相对路径。
    """
    return f"/uploads/{DOCUMENT_SUBDIR}/{_build_disk_filename(document_id, original_filename)}"


def resolve_document_path(path_or_url: str) -> Path | None:
    """将文档相对 URL 解析为磁盘绝对路径。

    Args:
        path_or_url: 形如 ``/uploads/documents/5__运动的利与弊.txt`` 的路径。

    Returns:
        对应文件路径；非法时返回 ``None``。
    """
    if not path_or_url.startswith(f"/uploads/{DOCUMENT_SUBDIR}/"):
        return None

    filename = Path(path_or_url).name
    # 允许中英文、数字、常见标点（_. -）以及双下划线分隔符
    if not filename or len(filename) > 255:
        return None

    return settings.uploads_path / DOCUMENT_SUBDIR / filename


def store_document_file(document_id: int, original_filename: str, content: bytes) -> str:
    """保存上传的文档并返回可访问的相对 URL。

    Args:
        document_id: 文档 ID。
        original_filename: 用户上传时的原始文件名（用于生成带原文件名的磁盘命名）。
        content: 文件字节内容。

    Returns:
        形如 ``/uploads/documents/{id}__{original_stem}.txt`` 的相对 URL。
    """
    directory = ensure_document_upload_dir()
    disk_name = _build_disk_filename(document_id, original_filename)
    target = directory / disk_name
    target.write_bytes(content)
    return f"/uploads/{DOCUMENT_SUBDIR}/{disk_name}"


def delete_document_file(document_id: int, original_filename: str) -> None:
    """删除指定文档的磁盘文件（若存在）。

    先尝试新命名 ``{id}__{stem}{ext}``，找不到再回退到旧格式
    ``{id}{ext}``，以兼容历史遗留数据。

    Args:
        document_id: 文档 ID。
        original_filename: 原始文件名（用于生成新命名 + 解析扩展名）。
    """
    directory = settings.uploads_path / DOCUMENT_SUBDIR

    # 1. 先尝试新格式
    new_path = directory / _build_disk_filename(document_id, original_filename)
    if new_path.is_file():
        new_path.unlink(missing_ok=True)
        return

    # 2. 回退旧格式：{id}{ext}
    extension = Path(original_filename).suffix.lower()
    if extension:
        old_path = directory / f"{document_id}{extension}"
        if old_path.is_file():
            old_path.unlink(missing_ok=True)
