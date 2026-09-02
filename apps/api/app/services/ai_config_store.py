"""AI 配置持久化：读写 ``data/ai_config.json``。"""

import json
from pathlib import Path

from app.config import settings
from app.schemas.ai_config import AiConfig, OpenAiConfig

_API_ROOT = Path(__file__).resolve().parent.parent.parent
_CONFIG_PATH = _API_ROOT / "data" / "ai_config.json"


def _default_config() -> AiConfig:
    """从环境变量与默认值构造初始 AI 配置。

    Returns:
        首次启动或文件缺失时使用的默认配置。
    """
    return AiConfig(
        openai=OpenAiConfig(
            api_key=settings.openai_api_key,
            base_url=settings.openai_base_url or "",
            model=settings.openai_model,
        ),
    )


def load_ai_config() -> AiConfig:
    """读取磁盘上的 AI 配置。

    文件不存在或解析失败时回退到默认配置，避免管理后台无法加载。

    Returns:
        当前 AI 配置。
    """
    if not _CONFIG_PATH.is_file():
        return _default_config()

    try:
        raw = json.loads(_CONFIG_PATH.read_text(encoding="utf-8"))
        return AiConfig.model_validate(raw)
    except (json.JSONDecodeError, ValueError):
        return _default_config()


def save_ai_config(config: AiConfig) -> AiConfig:
    """将 AI 配置写入磁盘。

    Args:
        config: 待保存的完整配置。

    Returns:
        写入后的配置（与入参相同，便于路由直接返回）。
    """
    _CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    _CONFIG_PATH.write_text(
        config.model_dump_json(indent=2),
        encoding="utf-8",
    )
    return config
