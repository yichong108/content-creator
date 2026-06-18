"""NPC 头像 URL 与文件存储。"""

from __future__ import annotations

import re
from pathlib import Path
from urllib.parse import quote

from fastapi import UploadFile

from app.config import settings

NPC_AVATAR_SUBDIR = "npcs"
ALLOWED_AVATAR_CONTENT_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}
MAX_AVATAR_BYTES = 2 * 1024 * 1024


def ensure_npc_upload_dir() -> Path:
    """确保 NPC 头像上传目录存在。

    Returns:
        NPC 头像目录绝对路径。
    """
    directory = settings.uploads_path / NPC_AVATAR_SUBDIR
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def build_default_avatar_url(name: str) -> str:
    """根据 NPC 名称生成默认头像 URL（DiceBear）。

    Args:
        name: NPC 名称。

    Returns:
        可公开访问的头像 URL。
    """
    seed = quote(name.strip() or "NPC")
    return f"https://api.dicebear.com/9.x/notionists/svg?seed={seed}"


def normalize_avatar_url(value: str | None) -> str | None:
    """规范化头像 URL，空白字符串视为未设置。

    Args:
        value: 原始头像 URL。

    Returns:
        去空白后的 URL，或 ``None``。
    """
    if value is None:
        return None
    trimmed = value.strip()
    return trimmed or None


def is_local_npc_avatar_url(avatar_url: str | None) -> bool:
    """判断是否为本地存储的 NPC 头像路径。

    Args:
        avatar_url: 头像 URL 或相对路径。

    Returns:
        是否为 ``/uploads/npcs/`` 下的本地文件路径。
    """
    if avatar_url is None:
        return False
    return avatar_url.startswith(f"/uploads/{NPC_AVATAR_SUBDIR}/")


def resolve_local_avatar_path(avatar_url: str) -> Path | None:
    """将本地头像 URL 解析为磁盘路径。

    Args:
        avatar_url: 形如 ``/uploads/npcs/1.png`` 的路径。

    Returns:
        对应文件路径；非本地路径时返回 ``None``。
    """
    if not is_local_npc_avatar_url(avatar_url):
        return None

    filename = Path(avatar_url).name
    if not re.fullmatch(r"[\w.-]+", filename):
        return None

    return settings.uploads_path / NPC_AVATAR_SUBDIR / filename


def delete_local_avatar_file(avatar_url: str | None) -> None:
    """删除本地 NPC 头像文件（若存在）。

    Args:
        avatar_url: 头像 URL 或相对路径。
    """
    path = resolve_local_avatar_path(avatar_url) if avatar_url else None
    if path is None or not path.is_file():
        return
    path.unlink(missing_ok=True)


async def save_npc_avatar_file(npc_id: int, upload: UploadFile) -> str:
    """保存上传的 NPC 头像并返回可访问的相对 URL。

    Args:
        npc_id: NPC ID。
        upload: 上传文件对象。

    Returns:
        形如 ``/uploads/npcs/{id}.png`` 的相对 URL。

    Raises:
        ValueError: 文件类型或大小不合法。
    """
    content_type = (upload.content_type or "").lower()
    extension = ALLOWED_AVATAR_CONTENT_TYPES.get(content_type)
    if extension is None:
        raise ValueError("仅支持 JPG、PNG、WebP、GIF 格式的头像")

    content = await upload.read()
    if not content:
        raise ValueError("头像文件不能为空")
    if len(content) > MAX_AVATAR_BYTES:
        raise ValueError("头像文件不能超过 2MB")

    directory = ensure_npc_upload_dir()

    for existing in directory.glob(f"{npc_id}.*"):
        if existing.is_file():
            existing.unlink()

    target = directory / f"{npc_id}{extension}"
    target.write_bytes(content)
    return f"/uploads/{NPC_AVATAR_SUBDIR}/{npc_id}{extension}"
