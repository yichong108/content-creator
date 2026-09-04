from fastapi import APIRouter, Depends

from app.schemas.response import ApiResponse, success_response
from app.schemas.token_usage import TokenUsage
from app.services.ai_config_store import load_ai_config
from app.services.auth_security import get_current_admin
from app.services.token_usage_store import get_used_tokens

router = APIRouter(tags=["admin-token-usage"], dependencies=[Depends(get_current_admin)])


@router.get("")
async def get_token_usage() -> ApiResponse[TokenUsage]:
    """获取累计 token 消耗与总量额度。

    Returns:
        统一响应包裹的 ``{used_tokens, total_tokens}``。
    """
    used = get_used_tokens()
    total = load_ai_config().token_quota
    return success_response(data=TokenUsage(used_tokens=used, total_tokens=total))
