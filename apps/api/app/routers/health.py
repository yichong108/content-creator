from fastapi import APIRouter

from app.schemas.response import ApiResponse, success_response

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> ApiResponse[dict[str, str]]:
    """存活探针，供部署环境或负载均衡做健康检查。

    Returns:
        统一响应包裹的 ``{"status": "ok"}``。
    """
    return success_response(data={"status": "ok"})
