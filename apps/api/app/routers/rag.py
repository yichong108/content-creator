import asyncio
import logging
from typing import Any

from fastapi import APIRouter, Depends, Response

from app.schemas.rag import RagQueryRequest, RagQueryResponse, RagSource
from app.schemas.response import ApiResponse, success_response
from app.services.ai_errors import (
    AiAuthenticationError,
    AiConfigurationError,
    AiConnectionError,
    AiResponseError,
    AiUnavailableError,
)
from app.services.ai_http import fail_from_ai_error
from app.services.ai_provider import invoke_chat, validate_ai_config
from app.services.auth_security import get_current_admin
from app.services.rag_service import get_rag_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["admin-rag"], dependencies=[Depends(get_current_admin)])

RAG_SYSTEM_PROMPT = """\
你是一个基于文档内容回答问题的助手。请只依据下方提供的文档片段回答用户的问题。

规则：
1. 若文档片段包含答案，请准确、简洁地作答，必要时引用要点。
2. 若文档片段不包含答案，请明确说明"文档中未找到相关信息"，不要编造。
3. 使用与用户相同的语言回答。

文档片段如下：
"""


def _build_sources(nodes: list[Any]) -> list[RagSource]:
    """将检索到的节点转换为来源片段列表。

    Args:
        nodes: LlamaIndex 检索返回的节点列表。

    Returns:
        含文档 ID、文件名、相似度与截断片段的来源列表。
    """
    sources: list[RagSource] = []
    for node in nodes:
        content = (node.get_content() or "").strip()
        metadata = getattr(node, "metadata", {}) or {}
        document_id = metadata.get("document_id", 0)
        filename = metadata.get("filename", "未知文档")
        sources.append(
            RagSource(
                document_id=int(document_id) if document_id is not None else 0,
                filename=str(filename),
                score=getattr(node, "score", None),
                snippet=content[:200],
            )
        )
    return sources


@router.post("/query")
async def query_rag(
    payload: RagQueryRequest,
    response: Response,
) -> ApiResponse[RagQueryResponse | None]:
    """基于已上传文档执行检索增强问答。

    Args:
        payload: 含提问与检索数量的请求体。
        response: FastAPI 响应对象，失败时用于写入 HTTP 状态码。

    Returns:
        统一响应包裹的答案与来源。
    """
    query = payload.query.strip()
    if not query:
        return success_response(RagQueryResponse(answer="请输入要提问的内容"))

    nodes = await asyncio.to_thread(get_rag_service().retrieve, query, payload.top_k)
    if not nodes:
        return success_response(RagQueryResponse(answer="暂无可检索的文档，请先上传文档。"))

    context = "\n\n".join(f"【片段 {i + 1}】\n{(node.get_content() or '').strip()}" for i, node in enumerate(nodes))

    validation_error = validate_ai_config()
    if validation_error:
        return fail_from_ai_error(AiConfigurationError(validation_error), response)

    messages = [
        {"role": "system", "content": RAG_SYSTEM_PROMPT + context},
        {"role": "user", "content": query},
    ]

    try:
        answer = await asyncio.to_thread(invoke_chat, messages)
    except (
        AiConfigurationError,
        AiAuthenticationError,
        AiConnectionError,
        AiUnavailableError,
        AiResponseError,
        ValueError,
    ) as exc:
        return fail_from_ai_error(exc, response)

    return success_response(RagQueryResponse(answer=answer, sources=_build_sources(nodes)))
