from fastapi import APIRouter

from app.schemas.ai_config import AiConfig
from app.schemas.response import ApiResponse, ok
from app.services.ai_config_store import load_ai_config, save_ai_config

router = APIRouter(prefix="/admin/ai-config", tags=["admin-ai-config"])


@router.get("", response_model=ApiResponse[AiConfig])
async def get_ai_config() -> ApiResponse[AiConfig]:
    """获取当前 AI 配置（含 OpenAI 与 Cursor SDK 两套设置）。

    Returns:
        统一 ``ApiResponse`` 包裹的 AI 配置。
    """
    return ok(load_ai_config())


@router.put("", response_model=ApiResponse[AiConfig])
async def update_ai_config(payload: AiConfig) -> ApiResponse[AiConfig]:
    """保存 AI 配置；切换 ``provider`` 不会丢弃另一套提供商字段。

    Args:
        payload: 完整 AI 配置请求体。

    Returns:
        保存后的 AI 配置。
    """
    saved = save_ai_config(payload)
    return ok(saved)
