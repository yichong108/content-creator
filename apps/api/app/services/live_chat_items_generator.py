import asyncio
import json
import logging

from pydantic import BaseModel, Field

from app.schemas.chat_item import ChatItem
from app.services.ai_provider import get_active_config, invoke_structured_output

logger = logging.getLogger(__name__)

LIVE_CHAT_ITEM_CONTINUATION_SYSTEM_PROMPT = """\
你是微信聊天 mock 数据续写器。根据会话标题与已有聊天记录，继续生成恰好 1 条新消息。

角色映射（不可颠倒）：
- incoming：非己方（对方侧）消息，左侧气泡
- outgoing：己方发送的消息，右侧气泡

输出格式：必须是合法 JSON 对象，顶层字段 item 为 {"kind": "...", "text": "..."}。
kind 只能是 timestamp、system、incoming、outgoing 之一。

续写规则：
1. 每次只生成 1 条新消息，自然承接上文，不要重复已有内容
2. 优先 incoming/outgoing 对话气泡；偶尔可插入 timestamp 或 system
3. 短句、口语化
4. text 内不要使用英文双引号；禁止 Markdown
5. 可使用微信表情别名，如 [微笑]、[捂脸]

只输出 JSON 对象，不要 markdown 代码块，不要附加解释。"""


class _LiveChatItemOutput(BaseModel):
    """LLM 结构化输出容器。"""

    item: ChatItem = Field(description="续写的单条新消息")


def _format_history_for_prompt(title: str, existing_items: list[ChatItem]) -> str:
    """将会话标题与已有记录格式化为 LLM 用户提示。

    Args:
        title: 直播会话标题。
        existing_items: 已有聊天记录，按时间正序。

    Returns:
        供 LLM 续写的用户提示文本。
    """
    recent_items = existing_items[-20:]
    history_json = json.dumps(
        [item.model_dump() for item in recent_items],
        ensure_ascii=False,
    )
    return f"会话标题：{title}\n已有聊天记录（最近 {len(recent_items)} 条）：{history_json}"


def _generate_live_chat_item_sync(title: str, existing_items: list[ChatItem]) -> ChatItem:
    """同步调用当前 AI 提供商续写单条聊天记录。

    Args:
        title: 会话标题。
        existing_items: 已有聊天记录。

    Returns:
        新生成的 ChatItem。

    Raises:
        AiConfigurationError: 配置无效。
        AiAuthenticationError: API Key 无效。
        AiConnectionError: 无法连接 AI 服务。
        AiUnavailableError: AI 服务返回错误状态。
        AiResponseError: 模型返回空结果。
        ValueError: 模型未返回有效消息。
    """
    user_prompt = _format_history_for_prompt(title, existing_items)
    result = invoke_structured_output(
        LIVE_CHAT_ITEM_CONTINUATION_SYSTEM_PROMPT,
        user_prompt,
        _LiveChatItemOutput,
    )

    return result.item


async def generate_live_chat_item(title: str, existing_items: list[ChatItem]) -> ChatItem:
    """根据标题与已有记录异步续写单条新消息。

    Cursor SDK 的 Bridge 不能在 ``asyncio.to_thread`` 中首次初始化，
    因此 cursor_sdk 提供商在主线程同步执行。

    Args:
        title: 已去除首尾空白的会话标题。
        existing_items: 当前会话已有聊天记录。

    Returns:
        新生成的 ChatItem。

    Raises:
        AiConfigurationError: 配置无效。
        AiAuthenticationError: API Key 无效。
        AiConnectionError: 无法连接 AI 服务。
        AiUnavailableError: AI 服务返回错误状态。
        AiResponseError: 模型返回空结果。
        ValueError: 模型未返回有效消息。
    """
    if get_active_config().provider == "cursor_sdk":
        return _generate_live_chat_item_sync(title, existing_items)
    return await asyncio.to_thread(_generate_live_chat_item_sync, title, existing_items)
