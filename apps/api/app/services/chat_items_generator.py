import asyncio
import logging
from typing import Literal

from pydantic import BaseModel, Field

from app.models.npc import NpcRow
from app.schemas.chat_item import ChatItem
from app.services.ai_provider import invoke_structured_output
from app.services.chat_item_npc import enrich_chat_items_with_npc_info
from app.services.chat_npc_persona import build_chat_items_user_prompt, personas_from_npc_rows

logger = logging.getLogger(__name__)

CHAT_ITEMS_GENERATION_SYSTEM_PROMPT = """\
你是微信聊天 mock 数据生成器。根据用户提供的会话标题与角色人设，生成一段真实感强的中文微信私聊 JSON 数据。

角色映射（不可颠倒）：
- incoming：非己方（对方侧）消息，左侧气泡
- outgoing：己方发送的消息，右侧气泡

输出格式：必须是合法 JSON 对象，顶层字段 items 为数组。
每项字段：
- kind：timestamp、system、incoming、outgoing 之一
- text：展示文本
- npc_id：整数，仅 incoming/outgoing 必填，必须与用户提示中的 npc_id 一致
- timestamp/system 不要 npc_id

示例（仅演示结构，内容需按标题与人设重写）：
{"items":[{"kind":"incoming","text":"在吗","npc_id":1},{"kind":"outgoing","text":"在呢，咋啦","npc_id":2}]}

写作规则：
1. 生成 30–45 条消息（含 timestamp/system）
2. 短句、多气泡，口语化（嗯、哈哈、吧、嘛、～ 等）
3. 同一人可连发 2–4 条；不必每条都回复
4. 插入 1–3 个 timestamp（中文时间，如「下午3:12」「昨天 晚上11:20」）
5. system 消息 0–3 条（如撤回、打招呼提示）；撤回消息可使用角色名称
6. text 内不要使用英文双引号；禁止 Markdown、英文对话（除非标题需要）
7. 可使用微信经典表情别名，格式为方括号中文名，如 [微笑]、[捂脸]、[旺柴]，每条 0–3 个即可，自然融入口语
8. 对话内容围绕标题主题自然展开，像两个好友在微信里聊天
9. 若提供了角色人设，incoming 必须符合对应 npc_id 的人设语气，outgoing 必须符合己方 npc_id 的人设
10. 多个对方 NPC 时，incoming 必须填写正确的 npc_id 以区分发言者

只输出 JSON 对象，不要 markdown 代码块，不要附加解释。"""


class _GeneratedChatItem(BaseModel):
    """LLM 生成阶段的聊天项，允许暂缺 npc_name / npc_avatar_url。"""

    kind: Literal["timestamp", "system", "incoming", "outgoing"]
    text: str
    npc_id: int | None = None
    npc_name: str | None = None
    npc_avatar_url: str | None = None


class _ChatItemsOutput(BaseModel):
    """LLM 结构化输出容器。"""

    items: list[_GeneratedChatItem] = Field(min_length=1, description="按时间正序排列的聊天记录")


def _generate_chat_items_sync(
    title: str,
    description: str | None = None,
    peer_npc_rows: list[NpcRow] | None = None,
    self_npc_row: NpcRow | None = None,
) -> list[ChatItem]:
    """同步调用当前 AI 提供商生成聊天记录。

    Args:
        title: 会话标题，作为对话主题。
        description: 可选会话描述，补充场景信息。
        peer_npc_rows: 对方侧 NPC 行列表。
        self_npc_row: 己方 NPC 行。

    Returns:
        校验通过的 ChatItem 列表。

    Raises:
        AiConfigurationError: 配置无效。
        AiAuthenticationError: API Key 无效。
        AiConnectionError: 无法连接 AI 服务。
        AiUnavailableError: AI 服务返回错误状态。
        AiResponseError: 模型返回空结果。
    """
    peer_rows = peer_npc_rows or []
    peer_personas, self_persona = personas_from_npc_rows(peer_rows, self_npc_row)
    user_prompt = build_chat_items_user_prompt(title, description, peer_personas, self_persona)
    result = invoke_structured_output(
        CHAT_ITEMS_GENERATION_SYSTEM_PROMPT,
        user_prompt,
        _ChatItemsOutput,
    )

    if len(result.items) == 0:
        raise ValueError("AI 未返回有效的聊天记录")

    draft_items = [
        ChatItem.model_construct(
            kind=item.kind,
            text=item.text,
            npc_id=item.npc_id,
            npc_name=item.npc_name,
            npc_avatar_url=item.npc_avatar_url,
        )
        for item in result.items
    ]
    enriched = enrich_chat_items_with_npc_info(draft_items, peer_rows, self_npc_row)
    return [ChatItem.model_validate(item.model_dump()) for item in enriched]


async def generate_chat_items(
    title: str,
    description: str | None = None,
    peer_npc_rows: list[NpcRow] | None = None,
    self_npc_row: NpcRow | None = None,
) -> list[ChatItem]:
    """根据标题与人设异步生成聊天记录。

    Args:
        title: 已去除首尾空白的会话标题。
        description: 可选会话描述。
        peer_npc_rows: 对方侧 NPC 行列表。
        self_npc_row: 己方 NPC 行。

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
    return await asyncio.to_thread(
        _generate_chat_items_sync,
        title,
        description,
        peer_npc_rows,
        self_npc_row,
    )
