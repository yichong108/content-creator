from fastapi import APIRouter, Depends

from app.schemas.ai_config import AiConfig
from app.schemas.response import ApiResponse, success_response
from app.services.ai_config_store import load_ai_config, save_ai_config
from app.services.auth_security import get_current_admin

router = APIRouter(tags=["admin-ai-config"], dependencies=[Depends(get_current_admin)])


@router.get("")
async def get_ai_config() -> ApiResponse[AiConfig]:
    """获取当前 OpenAI 兼容 API 配置。

    Returns:
        统一响应包裹的 AI 配置。
    """
    return success_response(data=load_ai_config())


@router.put("")
async def update_ai_config(payload: AiConfig) -> ApiResponse[AiConfig]:
    """保存 AI 配置。

    Args:
        payload: 完整 AI 配置请求体。

    Returns:
        保存后的 AI 配置。
    """
    saved = save_ai_config(payload)
    return success_response(data=saved)
