"""统一 AI 提供商：按 ``ai_config.json`` 在 OpenAI 兼容 API 与 Cursor SDK 间切换。"""

from __future__ import annotations

import json
import logging
import re
from pathlib import Path

from cursor_sdk import Agent, AgentOptions, CloudAgentOptions, CursorAgentError, LocalAgentOptions
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from openai import APIConnectionError, APIStatusError, AuthenticationError
from pydantic import BaseModel, ValidationError

from app.config import settings
from app.schemas.ai_config import AiConfig, CursorSdkConfig, OpenAiConfig
from app.services.ai_config_store import load_ai_config
from app.services.ai_errors import (
    AiAuthenticationError,
    AiConfigurationError,
    AiConnectionError,
    AiResponseError,
    AiUnavailableError,
)
from app.services.cursor_bridge import ensure_cursor_bridge, get_cursor_client

logger = logging.getLogger(__name__)

_API_ROOT = Path(__file__).resolve().parent.parent.parent
_PROJECT_ROOT = _API_ROOT.parent.parent

_JSON_FENCE_RE = re.compile(r"^```(?:json)?\s*\n?(.*?)\n?```\s*$", re.DOTALL | re.IGNORECASE)


def get_active_config() -> AiConfig:
    """读取当前生效的 AI 配置。

    Returns:
        磁盘上的 ``AiConfig``；缺失时回退到环境变量默认值。
    """
    return load_ai_config()


def validate_ai_config(config: AiConfig | None = None) -> str | None:
    """校验当前提供商配置是否可用。

    Args:
        config: 待校验配置；缺省时读取磁盘配置。

    Returns:
        错误提示文案；配置有效时返回 ``None``。
    """
    cfg = config or get_active_config()

    if cfg.provider == "openai":
        api_key = cfg.openai.api_key.strip() or settings.openai_api_key.strip()
        if not api_key:
            return "未配置 OpenAI API Key，请在管理后台或 apps/api/.env 中设置"
        return None

    cursor = cfg.cursor_sdk
    if not cursor.api_key.strip():
        return "未配置 Cursor API Key，请在管理后台 Cursor SDK 配置中填写"

    if not cursor.model.strip():
        return "未配置 Cursor SDK 模型"

    if cursor.runtime == "cloud":
        repos = _parse_repos(cursor.repos)
        if not repos:
            return "Cloud 模式需配置至少一个 Git 仓库地址"
        return None

    return None


def _parse_repos(repos_text: str) -> list[str]:
    """将逗号/换行分隔的仓库字符串解析为列表。

    Args:
        repos_text: 用户输入的仓库地址文本。

    Returns:
        去重后的非空仓库 URL 列表。
    """
    if not repos_text.strip():
        return []

    parts = re.split(r"[\n,]+", repos_text)
    seen: set[str] = set()
    result: list[str] = []
    for part in parts:
        value = part.strip()
        if value and value not in seen:
            seen.add(value)
            result.append(value)
    return result


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
    kwargs: dict = {
        "model": openai_cfg.model,
        "api_key": openai_cfg.api_key or None,
    }
    if max_tokens is not None:
        kwargs["max_tokens"] = max_tokens
    if openai_cfg.base_url:
        kwargs["base_url"] = openai_cfg.base_url
    return ChatOpenAI(**kwargs)


def _resolve_cursor_cwd(cursor: CursorSdkConfig) -> str:
    """解析 Local 模式下 Cursor Agent 的工作目录。

    Args:
        cursor: Cursor SDK 配置。

    Returns:
        绝对路径字符串；留空时回退到 monorepo 根目录。
    """
    cwd = cursor.cwd.strip()
    if cwd:
        return str(Path(cwd).expanduser().resolve())
    return str(_PROJECT_ROOT.resolve())


def _build_cursor_options(config: AiConfig) -> AgentOptions:
    """根据配置构造 Cursor SDK ``AgentOptions``。

    Args:
        config: 完整 AI 配置。

    Returns:
        含 runtime、模型与认证信息的选项对象。

    Raises:
        AiConfigurationError: Cloud 模式未配置仓库时抛出。
    """
    cursor = config.cursor_sdk
    options_kwargs: dict = {
        "api_key": cursor.api_key.strip(),
        "model": cursor.model.strip(),
    }

    if cursor.runtime == "cloud":
        repos = _parse_repos(cursor.repos)
        if not repos:
            raise AiConfigurationError("Cloud 模式需配置至少一个 Git 仓库地址")
        options_kwargs["cloud"] = CloudAgentOptions(repos=repos)
    else:
        options_kwargs["local"] = LocalAgentOptions(cwd=_resolve_cursor_cwd(cursor))

    return AgentOptions(**options_kwargs)


def _extract_json_text(text: str) -> str:
    """从 Agent 回复中提取 JSON 文本，剥离 markdown 代码块。

    Args:
        text: 原始回复文本。

    Returns:
        可供 ``json.loads`` 解析的 JSON 字符串。
    """
    stripped = text.strip()
    match = _JSON_FENCE_RE.match(stripped)
    if match:
        return match.group(1).strip()
    return stripped


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


def _map_cursor_exception(exc: Exception) -> Exception:
    """将 Cursor SDK 异常映射为统一 AI 异常。

    Args:
        exc: Cursor SDK 抛出的异常。

    Returns:
        对应的 ``Ai*`` 异常实例。
    """
    if isinstance(exc, CursorAgentError):
        message = exc.message or "Cursor Agent 启动失败"
        if "auth" in message.lower() or "401" in message:
            return AiAuthenticationError("Cursor API Key 无效，请检查管理后台配置")
        if exc.status == 502:
            return AiUnavailableError(
                "Cursor Bridge 连接失败（HTTP 502）。"
                "若开启了系统代理/Clash，请为 127.0.0.1 设置 NO_PROXY 或关闭代理后重试",
            )
        if exc.is_retryable:
            return AiConnectionError(message)
        return AiUnavailableError(message)
    return exc


def _cursor_prompt(system_prompt: str, user_prompt: str) -> str:
    """拼装 Cursor Agent 一次性 prompt。

    Args:
        system_prompt: 系统指令。
        user_prompt: 用户输入。

    Returns:
        合并后的完整 prompt 文本。
    """
    return f"{system_prompt.strip()}\n\n{user_prompt.strip()}"


def _invoke_cursor_text(config: AiConfig, prompt: str) -> str:
    """通过 Cursor SDK 执行一次性 prompt 并返回文本结果。

    Args:
        config: 完整 AI 配置。
        prompt: 完整 prompt 文本。

    Returns:
        Agent 最终回复文本。

    Raises:
        AiConfigurationError: 配置无效。
        AiAuthenticationError: API Key 无效。
        AiConnectionError: 连接失败。
        AiUnavailableError: Agent 运行失败。
        AiResponseError: 返回空结果。
    """
    try:
        options = _build_cursor_options(config)
        ensure_cursor_bridge(config)
        result = Agent.prompt(prompt, options, client=get_cursor_client())
    except CursorAgentError as exc:
        raise _map_cursor_exception(exc) from exc
    except AiConfigurationError:
        raise
    except Exception as exc:
        raise _map_cursor_exception(exc) from exc

    if result.status == "error":
        raise AiUnavailableError(f"Cursor Agent 执行失败（run_id={result.id}）")

    text = (result.result or "").strip()
    if not text:
        raise AiResponseError("Cursor Agent 未返回有效内容")
    return text


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
    """按当前提供商生成并解析结构化 JSON 输出。

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

    if config.provider == "cursor_sdk":
        prompt = _cursor_prompt(system_prompt, full_user)
        raw_text = _invoke_cursor_text(config, prompt)
        try:
            payload = json.loads(_extract_json_text(raw_text))
            return output_type.model_validate(payload)
        except (json.JSONDecodeError, ValidationError) as exc:
            logger.warning("Cursor JSON 解析失败: %s", raw_text[:500])
            raise AiResponseError("AI 未返回有效的 JSON 结果") from exc

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


def _format_chat_prompt(messages: list[dict[str, str]]) -> str:
    """将对话历史格式化为 Cursor Agent 可读的纯文本。

    Args:
        messages: API 层消息列表。

    Returns:
        多轮对话文本。
    """
    lines: list[str] = ["请根据以下对话历史，以助手身份回复最后一条用户消息。", "", "对话历史："]
    for item in messages:
        role = item.get("role", "user")
        content = item.get("content", "").strip()
        if not content:
            continue
        label = {"user": "用户", "assistant": "助手", "system": "系统"}.get(role, role)
        lines.append(f"{label}：{content}")
    lines.append("")
    lines.append("请直接输出助手回复正文，不要附加解释或 markdown。")
    return "\n".join(lines)


def invoke_chat(messages: list[dict[str, str]]) -> str:
    """按当前提供商执行多轮聊天补全。

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

    if config.provider == "cursor_sdk":
        prompt = _format_chat_prompt(messages)
        return _invoke_cursor_text(config, prompt)

    lc_messages = _format_chat_messages(messages)
    return _invoke_openai_text(config, lc_messages)
