"""token 用量持久化：读写 ``data/token_usage.json``。

AI 调用每完成一次请求，都会从模型响应的 usage 元数据中累加真实 token
用量到本地文件，供管理后台「token 用量」页面展示消耗占比。
"""

import json
import threading
from pathlib import Path

_API_ROOT = Path(__file__).resolve().parent.parent.parent
_STORE_PATH = _API_ROOT / "data" / "token_usage.json"

# 并发 AI 调用可能同时写入文件，加锁避免读-改-写丢失更新
_lock = threading.Lock()


def _read() -> dict[str, int]:
    """读取磁盘上的用量数据，缺失或损坏时返回零值。

    Returns:
        含 ``used_tokens`` 键的字典。
    """
    if not _STORE_PATH.is_file():
        return {"used_tokens": 0}

    try:
        raw = json.loads(_STORE_PATH.read_text(encoding="utf-8"))
        used = int(raw.get("used_tokens", 0))
        return {"used_tokens": max(0, used)}
    except (json.JSONDecodeError, TypeError, ValueError):
        return {"used_tokens": 0}


def get_used_tokens() -> int:
    """获取累计已消耗的 token 数。

    Returns:
        历史累计 token 消耗量。
    """
    return _read()["used_tokens"]


def add_used_tokens(amount: int) -> None:
    """累加一次 AI 调用的 token 消耗。

    Args:
        amount: 本次调用消耗的 token 数（非正数将被忽略）。
    """
    if amount <= 0:
        return

    with _lock:
        current = _read()["used_tokens"]
        _STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
        _STORE_PATH.write_text(
            json.dumps({"used_tokens": current + amount}),
            encoding="utf-8",
        )
