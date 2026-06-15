from fastapi import APIRouter

from app.schemas.response import ApiResponse, ok

router = APIRouter(tags=["health"])


@router.get("/health", response_model=ApiResponse[dict[str, str]])
async def health() -> ApiResponse[dict[str, str]]:
    """存活探针，供部署环境或负载均衡做健康检查。

    Returns:
        统一 ``ApiResponse`` 包裹的 ``{"status": "ok"}``。
    """
    return ok({"status": "ok"})
