"""统一 AI 提供商：基于 LangChain ``create_agent`` 调用 OpenAI 兼容 API。"""

from __future__ import annotations

import logging
from typing import Any

import openai
from langchain.agents import create_agent
from langchain.agents.structured_output import ToolStrategy
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langchain_openai import ChatOpenAI
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


def _build_llm(openai_cfg: OpenAiConfig) -> ChatOpenAI:
    """构建指向 OpenAI 兼容端点的 LangChain 聊天模型。

    DeepSeek 的思考模式会拒绝强制 ``tool_choice``，导致基于工具调用的结构化
    输出返回 400；因此对 DeepSeek 端点显式关闭思考模式，其余端点保持默认。

    Args:
        openai_cfg: 已解析的 OpenAI 配置。

    Returns:
        可被 ``create_agent`` 使用的 ``ChatOpenAI`` 实例。
    """
    extra_body: dict[str, Any] | None = None
    if "deepseek" in (openai_cfg.base_url or "").lower():
        extra_body = {"thinking": {"type": "disabled"}}
    return ChatOpenAI(
        model=openai_cfg.model,
        api_key=openai_cfg.api_key or None,
        base_url=openai_cfg.base_url or None,
        timeout=60,
        max_retries=2,
        extra_body=extra_body,
    )


def _map_openai_error(exc: openai.OpenAIError) -> Exception:
    """将 openai SDK 异常映射为统一 AI 异常。

    Args:
        exc: openai 客户端抛出的异常。

    Returns:
        对应的 ``Ai*`` 异常实例。
    """
    if isinstance(exc, openai.AuthenticationError):
        return AiAuthenticationError("OpenAI API Key 无效，请检查管理后台或 apps/api/.env")
    if isinstance(exc, openai.APITimeoutError):
        return AiConnectionError("AI 服务连接超时，请稍后重试")
    if isinstance(exc, openai.APIConnectionError):
        return AiConnectionError("AI 服务连接失败，请稍后重试")
    if isinstance(exc, openai.RateLimitError):
        return AiUnavailableError("AI 服务请求过于频繁，请稍后重试")
    if isinstance(exc, openai.BadRequestError):
        return AiUnavailableError("AI 服务请求被拒绝，请检查模型与接口配置")
    if isinstance(exc, openai.InternalServerError):
        return AiUnavailableError("AI 服务暂时不可用，请稍后重试")
    if isinstance(exc, openai.APIStatusError):
        return AiUnavailableError("AI 服务暂时不可用，请稍后重试")
    logger.exception("未预期的 AI 调用异常")
    return AiUnavailableError("AI 服务暂时不可用，请稍后重试")


def _to_langchain_messages(messages: list[dict[str, str]]) -> list[BaseMessage]:
    """将 API 层消息字典转为 LangChain 消息对象。

    Args:
        messages: ``{"role": "...", "content": "..."}`` 列表（已剔除 system）。

    Returns:
        可被 agent 接收的 ``BaseMessage`` 列表。
    """
    converted: list[BaseMessage] = []
    for item in messages:
        role = item.get("role", "user")
        content = item.get("content", "")
        if role == "assistant":
            converted.append(AIMessage(content=content))
        else:
            converted.append(HumanMessage(content=content))
    return converted


def _extract_agent_text(messages: list[BaseMessage]) -> str:
    """从 agent 消息列表中提取最后一条助手文本。

    Args:
        messages: agent 返回的消息列表。

    Returns:
        最后一条非空助手消息文本；不存在时返回空字符串。
    """
    for msg in reversed(messages):
        if not isinstance(msg, AIMessage):
            continue
        content = msg.content
        if isinstance(content, str):
            text = content
        elif isinstance(content, list):
            text = " ".join(
                part.get("text", "") for part in content if isinstance(part, dict) and part.get("type") == "text"
            )
        else:
            text = ""
        text = text.strip()
        if text:
            return text
    return ""


def invoke_chat(messages: list[dict[str, str]]) -> str:
    """通过 LangChain agent 执行多轮聊天补全。

    每个 ``{role, content}`` 字典中的 ``system`` 消息会抽离为 agent 的系统提示词，
    其余 ``user/assistant`` 消息作为对话历史传入。

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

    system_parts = [item.get("content", "") for item in messages if item.get("role") == "system"]
    system_prompt = "\n\n".join(system_parts).strip() or None
    chat_messages = _to_langchain_messages([item for item in messages if item.get("role") != "system"])

    openai_cfg = _resolve_openai_config(config)
    agent = create_agent(
        model=_build_llm(openai_cfg),
        tools=[],
        system_prompt=system_prompt,
    )

    try:
        result = agent.invoke({"messages": chat_messages})  # type: ignore[call-overload]
    except openai.OpenAIError as exc:
        raise _map_openai_error(exc) from exc

    content = _extract_agent_text(result.get("messages", []))
    if not content:
        raise AiResponseError("AI 未返回有效内容")
    return content


def invoke_structured_output[T: BaseModel](
    system_prompt: str,
    user_prompt: str,
    output_type: type[T],
) -> T:
    """通过 LangChain agent 生成并解析结构化 JSON 输出。

    使用 ``ToolStrategy`` 将输出 schema 伪装成工具调用，兼容 DeepSeek 等
    未原生支持 ``response_format`` 的 OpenAI 兼容端点，避免解析非稳定 JSON。

    Args:
        system_prompt: 系统指令。
        user_prompt: 用户输入。
        output_type: Pydantic 模型类型。

    Returns:
        校验通过的 Pydantic 模型实例。

    Raises:
        AiConfigurationError: 配置无效。
        AiAuthenticationError: 认证失败。
        AiConnectionError: 连接失败。
        AiUnavailableError: 服务不可用。
        AiResponseError: 响应为空或结构化结果无效。
    """
    config = get_active_config()
    validation_error = validate_ai_config(config)
    if validation_error:
        raise AiConfigurationError(validation_error)

    openai_cfg = _resolve_openai_config(config)
    agent = create_agent(
        model=_build_llm(openai_cfg),
        tools=[],
        system_prompt=system_prompt,
        response_format=ToolStrategy(output_type),
    )

    try:
        result = agent.invoke({"messages": [HumanMessage(content=user_prompt.strip())]})
    except openai.OpenAIError as exc:
        raise _map_openai_error(exc) from exc

    structured = result.get("structured_response")
    if isinstance(structured, output_type):
        return structured

    # 兜底：个别策略可能返回 dict，仍按 schema 校验
    if isinstance(structured, dict):
        try:
            return output_type.model_validate(structured)
        except ValidationError as exc:
            raise AiResponseError("AI 未返回有效的 JSON 结果") from exc

    raise AiResponseError("AI 未返回有效的 JSON 结果")
