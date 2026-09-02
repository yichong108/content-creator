"""统一 AI 提供商：按 ``ai_config.json`` 使用 OpenAI 兼容 API。"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from collections.abc import Awaitable
from typing import Any

from pi_agent.agent_core import AssistantMessage, LlmContext, LlmMessage, Model, TextContent, UserMessage
from pi_agent.pi_ai import complete, create_default_registry
from pydantic import BaseModel, ValidationError

from app.config import settings
from app.schemas.ai_config import AiConfig, OpenAiConfig
from app.services.ai_config_store import load_ai_config
from app.services.ai_errors import (
    AiAuthenticationError,
    AiConfigurationError,
    AiConnectionError,
    AiResponseError,
    AiUnavailableError,
)

logger = logging.getLogger(__name__)

_registry = create_default_registry()


def get_active_config() -> AiConfig:
    """读取当前生效的 AI 配置。

    Returns:
        磁盘上的 ``AiConfig``；缺失时回退到环境变量默认值。
    """
    return load_ai_config()


def validate_ai_config(config: AiConfig | None = None) -> str | None:
    """校验 OpenAI 配置是否可用。

    Args:
        config: 待校验配置；缺省时读取磁盘配置。

    Returns:
        错误提示文案；配置有效时返回 ``None``。
    """
    cfg = config or get_active_config()
    api_key = cfg.openai.api_key.strip() or settings.openai_api_key.strip()
    if not api_key:
        return "未配置 OpenAI API Key，请在管理后台或 apps/api/.env 中设置"
    return None


def _resolve_openai_config(config: AiConfig) -> OpenAiConfig:
    """合并磁盘配置与环境变量，得到 OpenAI 有效参数。

    Args:
        config: 完整 AI 配置。

    Returns:
        含回退逻辑的有效 OpenAI 配置。
    """
    openai_cfg = config.openai
    return OpenAiConfig(
        api_key=openai_cfg.api_key.strip() or settings.openai_api_key,
        base_url=openai_cfg.base_url.strip() or (settings.openai_base_url or ""),
        model=openai_cfg.model.strip() or settings.openai_model,
    )


def _build_pi_model(openai_cfg: OpenAiConfig) -> Model:
    """构建 pi-agent OpenAI 兼容模型描述。

    Args:
        openai_cfg: 已解析的 OpenAI 配置。

    Returns:
        指向 OpenAI Completions 兼容端点的 ``Model`` 实例。
    """
    return Model(
        id=openai_cfg.model,
        provider="openai",
        api="openai-completions",
        base_url=openai_cfg.base_url,
    )


def _extract_assistant_text(message: AssistantMessage) -> str:
    """从 pi-agent 助手消息中提取纯文本。

    Args:
        message: pi-agent 返回的助手消息。

    Returns:
        拼接后的非空文本；无文本块时返回空字符串。
    """
    return " ".join(block.text for block in message.content if isinstance(block, TextContent)).strip()


def _map_pi_agent_response_error(message: AssistantMessage) -> Exception:
    """将 pi-agent 错误响应映射为统一 AI 异常。

    Args:
        message: 含 ``stop_reason`` 与 ``error_message`` 的助手消息。

    Returns:
        对应的 ``Ai*`` 异常实例。
    """
    error_msg = (message.error_message or "AI 服务暂时不可用").strip()
    lower = error_msg.lower()
    if "authentication" in lower or "api key" in lower or "401" in error_msg:
        return AiAuthenticationError("OpenAI API Key 无效，请检查管理后台或 apps/api/.env")
    if "connection" in lower or "connect" in lower:
        return AiConnectionError("AI 服务连接失败，请稍后重试")
    logger.warning("LLM API 错误: %s", error_msg)
    return AiUnavailableError("AI 服务暂时不可用，请稍后重试")


def _ensure_assistant_text(message: AssistantMessage) -> str:
    """校验 pi-agent 响应并提取助手文本。

    Args:
        message: pi-agent 返回的助手消息。

    Returns:
        非空助手回复文本。

    Raises:
        AiAuthenticationError: API Key 无效。
        AiConnectionError: 连接失败。
        AiUnavailableError: 服务不可用或请求被中止。
        AiResponseError: 返回空结果。
    """
    if message.stop_reason in {"error", "aborted"}:
        raise _map_pi_agent_response_error(message)

    content = _extract_assistant_text(message)
    if not content:
        raise AiResponseError("AI 未返回有效内容")
    return content


def _format_pi_agent_context(
    messages: list[dict[str, str]],
    *,
    model_id: str,
) -> LlmContext:
    """将 API 层消息字典转为 pi-agent ``LlmContext``。

    Args:
        messages: ``{"role": "...", "content": "..."}`` 列表。
        model_id: 当前模型 ID，用于构造历史 assistant 消息。

    Returns:
        含 system_prompt 与多轮消息的上下文。
    """
    system_parts: list[str] = []
    llm_messages: list[LlmMessage] = []

    for item in messages:
        role = item.get("role", "user")
        content = item.get("content", "")
        if role == "system":
            system_parts.append(content)
        elif role == "assistant":
            llm_messages.append(
                AssistantMessage(
                    content=[TextContent(text=content)],
                    api="openai-completions",
                    provider="openai",
                    model=model_id,
                ),
            )
        else:
            llm_messages.append(UserMessage(content=content))

    system_prompt = "\n\n".join(system_parts) if system_parts else None
    return LlmContext(system_prompt=system_prompt, messages=llm_messages)


def _parse_json_object(text: str) -> dict[str, Any]:
    """从模型文本响应中解析 JSON 对象。

    Args:
        text: 模型原始输出，可能含 markdown 代码块。

    Returns:
        解析后的 JSON 对象。

    Raises:
        AiResponseError: 文本不是合法 JSON 对象。
    """
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise AiResponseError("AI 未返回有效的 JSON 结果") from exc

    if not isinstance(parsed, dict):
        raise AiResponseError("AI 未返回有效的 JSON 结果")
    return parsed


async def _complete_openai_text(
    config: AiConfig,
    context: LlmContext,
) -> str:
    """通过 pi-agent 调用 OpenAI 兼容聊天模型。

    Args:
        config: 完整 AI 配置。
        context: pi-agent 对话上下文。

    Returns:
        助手回复文本。

    Raises:
        AiAuthenticationError: API Key 无效。
        AiConnectionError: 连接失败。
        AiUnavailableError: 服务不可用。
        AiResponseError: 返回空结果。
    """
    openai_cfg = _resolve_openai_config(config)
    message = await complete(
        model=_build_pi_model(openai_cfg),
        context=context,
        registry=_registry,
        api_key=openai_cfg.api_key or None,
    )
    return _ensure_assistant_text(message)


def _run_async[T](coro: Awaitable[T]) -> T:
    """在同步上下文中执行 pi-agent 异步调用。

    Args:
        coro: 待执行的协程。

    Returns:
        协程执行结果。
    """
    return asyncio.run(coro)  # type: ignore[arg-type]


def invoke_structured_output[T: BaseModel](
    system_prompt: str,
    user_prompt: str,
    output_type: type[T],
    *,
    json_suffix: str = "只输出 JSON 对象，不要 markdown 代码块，不要附加解释。",
) -> T:
    """按 OpenAI 兼容 API 生成并解析结构化 JSON 输出。

    Args:
        system_prompt: 系统指令。
        user_prompt: 用户输入。
        output_type: Pydantic 模型类型。
        json_suffix: 追加在用户提示后的 JSON 格式约束。

    Returns:
        校验通过的 Pydantic 模型实例。

    Raises:
        AiConfigurationError: 配置无效。
        AiAuthenticationError: 认证失败。
        AiConnectionError: 连接失败。
        AiUnavailableError: 服务不可用。
        AiResponseError: 响应为空或 JSON 无效。
    """
    config = get_active_config()
    validation_error = validate_ai_config(config)
    if validation_error:
        raise AiConfigurationError(validation_error)

    full_user = f"{user_prompt.strip()}\n\n{json_suffix}"
    context = LlmContext(
        system_prompt=system_prompt,
        messages=[UserMessage(content=full_user)],
    )
    content = _run_async(_complete_openai_text(config, context))

    try:
        parsed = _parse_json_object(content)
        return output_type.model_validate(parsed)
    except ValidationError as exc:
        raise AiResponseError("AI 未返回有效的 JSON 结果") from exc


def invoke_chat(messages: list[dict[str, str]]) -> str:
    """通过 OpenAI 兼容 API 执行多轮聊天补全。

    Args:
        messages: 含 role/content 的对话历史。

    Returns:
        助手最新回复文本。

    Raises:
        AiConfigurationError: 配置无效。
        AiAuthenticationError: 认证失败。
        AiConnectionError: 连接失败。
        AiUnavailableError: 服务不可用。
        AiResponseError: 响应为空。
    """
    config = get_active_config()
    validation_error = validate_ai_config(config)
    if validation_error:
        raise AiConfigurationError(validation_error)

    if not messages:
        raise AiResponseError("对话消息不能为空")

    openai_cfg = _resolve_openai_config(config)
    context = _format_pi_agent_context(messages, model_id=openai_cfg.model)
    return _run_async(_complete_openai_text(config, context))
