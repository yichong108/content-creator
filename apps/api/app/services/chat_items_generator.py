import asyncio
import logging

from pydantic import BaseModel, Field

from app.schemas.chat_item import ChatItem
from app.services.ai_provider import get_active_config, invoke_structured_output

logger = logging.getLogger(__name__)

CHAT_ITEMS_GENERATION_SYSTEM_PROMPT = """\
你是微信聊天 mock 数据生成器。根据用户提供的会话标题，生成一段真实感强的中文微信私聊 JSON 数据。

角色映射（不可颠倒）：
- incoming：豆包（字节跳动豆包 AI，左侧气泡），语气活泼接地气，偶尔接梗
- outgoing：DeepSeek（开源 DeepSeek AI，右侧气泡），偏理性，偶尔技术/开源比喻

输出格式：必须是合法 JSON 对象，顶层字段 items 为数组；每项为 {"kind": "...", "text": "..."}。
kind 只能是 timestamp、system、incoming、outgoing 之一。

示例（仅演示结构，内容需按标题重写）：
{"items":[{"kind":"incoming","text":"在吗"},{"kind":"outgoing","text":"在呢，咋啦"}]}

写作规则：
1. 生成 30–45 条消息（含 timestamp/system）
2. 短句、多气泡，口语化（嗯、哈哈、吧、嘛、～ 等）
3. 同一人可连发 2–4 条；不必每条都回复
4. 插入 1–3 个 timestamp（中文时间，如「下午3:12」「昨天 晚上11:20」）
5. system 消息 0–3 条（如撤回、打招呼提示）
6. text 内不要使用英文双引号；禁止 Markdown、英文对话（除非标题需要）
7. 对话内容围绕标题主题自然展开，像两个 AI 好友在微信里聊天

只输出 JSON 对象，不要 markdown 代码块，不要附加解释。"""


class _ChatItemsOutput(BaseModel):
    """LLM 结构化输出容器。"""

    items: list[ChatItem] = Field(min_length=1, description="按时间正序排列的聊天记录")


def _generate_chat_items_sync(title: str) -> list[ChatItem]:
    """同步调用当前 AI 提供商生成聊天记录。

    Args:
        title: 会话标题，作为对话主题。

    Returns:
        校验通过的 ChatItem 列表。

    Raises:
        AiConfigurationError: 配置无效。
        AiAuthenticationError: API Key 无效。
        AiConnectionError: 无法连接 AI 服务。
        AiUnavailableError: AI 服务返回错误状态。
        AiResponseError: 模型返回空结果。
    """
    result = invoke_structured_output(
        CHAT_ITEMS_GENERATION_SYSTEM_PROMPT,
        f"会话标题：{title}",
        _ChatItemsOutput,
    )

    if len(result.items) == 0:
        raise ValueError("AI 未返回有效的聊天记录")

    return result.items


async def generate_chat_items(title: str) -> list[ChatItem]:
    """根据标题异步生成聊天记录。

    Cursor SDK 的 Bridge 不能在 ``asyncio.to_thread`` 中首次初始化，
    因此 cursor_sdk 提供商在主线程同步执行。

    Args:
        title: 已去除首尾空白的会话标题。

    Returns:
        生成的 ChatItem 列表。

    Raises:
        AiConfigurationError: 配置无效。
        AiAuthenticationError: API Key 无效。
        AiConnectionError: 无法连接 AI 服务。
        AiUnavailableError: AI 服务返回错误状态。
        AiResponseError: 模型返回空结果。
        ValueError: 模型返回空结果。
    """
    if get_active_config().provider == "cursor_sdk":
        return _generate_chat_items_sync(title)
    return await asyncio.to_thread(_generate_chat_items_sync, title)
