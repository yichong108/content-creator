"""统一 AI 提供商：按 ``ai_config.json`` 使用 OpenAI 兼容 API。"""

from __future__ import annotations

import logging
from typing import Any

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from openai import APIConnectionError, APIStatusError, AuthenticationError
from pydantic import BaseModel

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


def _build_openai_model(config: AiConfig, *, max_tokens: int | None = None) -> ChatOpenAI:
    """构建 LangChain OpenAI 兼容聊天模型。

    Args:
        config: 完整 AI 配置。
        max_tokens: 可选最大输出 token 数。

    Returns:
        已配置 API Key、Base URL 与模型名的实例。
    """
    openai_cfg = _resolve_openai_config(config)
    kwargs: dict[str, Any] = {
        "model": openai_cfg.model,
        "api_key": openai_cfg.api_key or None,
    }
    if max_tokens is not None:
        kwargs["max_tokens"] = max_tokens
    if openai_cfg.base_url:
        kwargs["base_url"] = openai_cfg.base_url
    return ChatOpenAI(**kwargs)


def _map_openai_exception(exc: Exception) -> Exception:
    """将 OpenAI SDK 异常映射为统一 AI 异常。

    Args:
        exc: OpenAI 或网络相关异常。

    Returns:
        对应的 ``Ai*`` 异常实例。
    """
    if isinstance(exc, AuthenticationError):
        return AiAuthenticationError("OpenAI API Key 无效，请检查管理后台或 apps/api/.env")
    if isinstance(exc, APIConnectionError):
        return AiConnectionError("AI 服务连接失败，请稍后重试")
    if isinstance(exc, APIStatusError):
        logger.warning("LLM API 错误: %s", exc)
        return AiUnavailableError("AI 服务暂时不可用，请稍后重试")
    return exc


def _invoke_openai_text(
    config: AiConfig,
    messages: list[BaseMessage],
    *,
    max_tokens: int | None = None,
) -> str:
    """通过 OpenAI 兼容 API 调用聊天模型。

    Args:
        config: 完整 AI 配置。
        messages: LangChain 消息列表。
        max_tokens: 可选最大输出 token 数。

    Returns:
        助手回复文本。

    Raises:
        AiAuthenticationError: API Key 无效。
        AiConnectionError: 连接失败。
        AiUnavailableError: 服务不可用。
        AiResponseError: 返回空结果。
    """
    try:
        model = _build_openai_model(config, max_tokens=max_tokens)
        response = model.invoke(messages)
    except (AuthenticationError, APIConnectionError, APIStatusError) as exc:
        raise _map_openai_exception(exc) from exc

    content = str(response.content).strip()
    if not content:
        raise AiResponseError("AI 未返回有效内容")
    return content


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
    messages: list[BaseMessage] = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=full_user),
    ]
    try:
        model = _build_openai_model(config, max_tokens=8192)
        structured = model.with_structured_output(output_type, method="json_mode")
        result = structured.invoke(messages)
    except (AuthenticationError, APIConnectionError, APIStatusError) as exc:
        raise _map_openai_exception(exc) from exc

    if not isinstance(result, output_type):
        raise AiResponseError("AI 未返回有效的 JSON 结果")
    return result


def _format_chat_messages(messages: list[dict[str, str]]) -> list[BaseMessage]:
    """将 API 层消息字典转为 LangChain 消息。

    Args:
        messages: ``{"role": "...", "content": "..."}`` 列表。

    Returns:
        LangChain ``BaseMessage`` 列表。
    """
    result: list[BaseMessage] = []
    for item in messages:
        role = item.get("role", "user")
        content = item.get("content", "")
        if role == "assistant":
            result.append(AIMessage(content=content))
        elif role == "system":
            result.append(SystemMessage(content=content))
        else:
            result.append(HumanMessage(content=content))
    return result


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

    lc_messages = _format_chat_messages(messages)
    return _invoke_openai_text(config, lc_messages)
