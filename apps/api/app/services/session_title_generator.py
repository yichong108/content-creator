import asyncio
import logging

from pydantic import BaseModel, Field

from app.schemas.chat_item import ChatItem
from app.services.ai_provider import invoke_structured_output

logger = logging.getLogger(__name__)

SESSION_TITLE_GENERATION_SYSTEM_PROMPT = """\
你是会话标题生成器。为豆包（字节跳动豆包 AI）与 DeepSeek（开源 DeepSeek AI）\
的微信私聊 mock 数据生成简短中文标题。

标题风格示例：
- 豆包 × DeepSeek 练车记
- 豆包 × DeepSeek 摸鱼周记
- 豆包 × DeepSeek 火锅局翻车现场

规则：
1. 10–30 字，口语化、有场景感
2. 可含「豆包 × DeepSeek」或简称，但不强制
3. 若用户提供描述或聊天记录片段，标题应贴合内容
4. 若无参考信息，随机生成一个有趣日常/技术/生活场景
5. 只输出 JSON 对象：{"title": "..."}，不要 markdown 代码块，不要附加解释"""


class _SessionTitleOutput(BaseModel):
    """LLM 结构化输出容器。"""

    title: str = Field(min_length=1, max_length=200, description="生成的会话标题")


def _format_chat_items_excerpt(items: list[ChatItem], max_lines: int = 12) -> str:
    """将聊天记录压缩为供 LLM 参考的文本摘要。

    Args:
        items: 聊天记录数组。
        max_lines: 最多保留的消息条数。

    Returns:
        多行文本，每行一条消息的 kind 与 text。
    """
    lines: list[str] = []
    for item in items[:max_lines]:
        lines.append(f"[{item.kind}] {item.text}")
    if len(items) > max_lines:
        lines.append(f"... 共 {len(items)} 条消息")
    return "\n".join(lines)


def _build_user_prompt(description: str | None, chat_items: list[ChatItem] | None) -> str:
    """组装发给 LLM 的用户提示词。

    Args:
        description: 可选会话描述。
        chat_items: 可选聊天记录。

    Returns:
        含可用上下文的提示文本。
    """
    parts: list[str] = ["请生成一个会话标题。"]

    if description and description.strip():
        parts.append(f"会话描述：{description.strip()}")

    if chat_items:
        parts.append("聊天记录片段：")
        parts.append(_format_chat_items_excerpt(chat_items))

    if len(parts) == 1:
        parts.append("无额外参考信息，请随机生成一个有趣场景。")

    return "\n".join(parts)


def _generate_session_title_sync(
    description: str | None,
    chat_items: list[ChatItem] | None,
) -> str:
    """同步调用当前 AI 提供商生成会话标题。

    Args:
        description: 可选会话描述。
        chat_items: 可选聊天记录。

    Returns:
        校验通过的标题字符串。

    Raises:
        AiConfigurationError: 配置无效。
        AiAuthenticationError: API Key 无效。
        AiConnectionError: 无法连接 AI 服务。
        AiUnavailableError: AI 服务返回错误状态。
        AiResponseError: 模型返回空结果。
        ValueError: 模型返回空结果。
    """
    result = invoke_structured_output(
        SESSION_TITLE_GENERATION_SYSTEM_PROMPT,
        _build_user_prompt(description, chat_items),
        _SessionTitleOutput,
    )

    title = result.title.strip()
    if not title:
        raise ValueError("AI 未返回有效的会话标题")

    return title


async def generate_session_title(
    description: str | None = None,
    chat_items: list[ChatItem] | None = None,
) -> str:
    """根据可选上下文异步生成会话标题。

    Args:
        description: 可选会话描述。
        chat_items: 可选聊天记录。

    Returns:
        生成的标题字符串。

    Raises:
        AiConfigurationError: 配置无效。
        AiAuthenticationError: API Key 无效。
        AiConnectionError: 无法连接 AI 服务。
        AiUnavailableError: AI 服务返回错误状态。
        AiResponseError: 模型返回空结果。
        ValueError: 模型返回空结果。
    """
    return await asyncio.to_thread(_generate_session_title_sync, description, chat_items)
