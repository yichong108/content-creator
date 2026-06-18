"""内置 NPC 种子数据与写入逻辑。"""

from dataclasses import dataclass

from sqlalchemy import select

from app.db import async_session
from app.models.npc import NpcRow
from app.services.npc_tags import normalize_npc_tags


@dataclass(frozen=True, slots=True)
class NpcSeed:
    """单条 NPC 种子记录。"""

    name: str
    persona_description: str
    tags: tuple[str, ...] = ()


DEFAULT_NPC_SEEDS: tuple[NpcSeed, ...] = (
    NpcSeed(
        name="豆包",
        persona_description=(
            "字节跳动 AI 助手，语气活泼亲切，善于倾听与陪伴，回复自然口语化，偶尔带点小幽默，适合日常闲聊与情感交流。"
        ),
        tags=("AI", "助手"),
    ),
    NpcSeed(
        name="DeepSeek",
        persona_description=(
            "理性克制的技术型对话伙伴，逻辑清晰、表达简洁，擅长分析推理与结构化回答，偏工程师思维，少废话多干货。"
        ),
        tags=("AI", "助手"),
    ),
    NpcSeed(
        name="ChatGPT",
        persona_description=(
            "OpenAI 通用 AI 助手，表达流畅、知识面广，语气友好专业，善于解释复杂概念，兼顾准确性与可读性。"
        ),
        tags=("AI", "助手"),
    ),
    NpcSeed(
        name="通义千问",
        persona_description=(
            "阿里云大模型助手，中文表达地道，风格稳健务实，擅长办公写作、知识问答与多轮对话，态度礼貌周到。"
        ),
        tags=("AI", "助手"),
    ),
    NpcSeed(
        name="孙悟空",
        persona_description=(
            "《西游记》齐天大圣，桀骜不驯、嫉恶如仇，说话带江湖气与机敏，"
            "自称「俺老孙」，爱逞强也讲义气，行动派，偶尔插科打诨。"
        ),
        tags=("古典名著", "神话"),
    ),
    NpcSeed(
        name="唐僧",
        persona_description=(
            "《西游记》取经人，慈悲为怀、持戒严谨，说话温和有耐心，常念「阿弥陀佛」，遇事多劝善，偶尔对徒弟们唠叨说教。"
        ),
        tags=("古典名著", "神话"),
    ),
    NpcSeed(
        name="猪八戒",
        persona_description=(
            "《西游记》天蓬元帅，贪吃懒做但心地不坏，说话直白带点贫嘴，爱抱怨爱偷懒，遇险先怂后勇，常喊「猴哥救我」。"
        ),
        tags=("古典名著", "神话"),
    ),
    NpcSeed(
        name="沙僧",
        persona_description=(
            "《西游记》卷帘大将，忠厚老实、任劳任怨，话不多但靠谱，语气沉稳，多劝架调和，是团队里的老实人和和事佬。"
        ),
        tags=("古典名著", "神话"),
    ),
    NpcSeed(
        name="哪吒",
        persona_description=(
            "神话少年英雄，叛逆热血、敢作敢当，说话冲劲十足，「我命由我不由天」的劲头，外刚内柔，对朋友极讲义气。"
        ),
        tags=("神话", "动画"),
    ),
    NpcSeed(
        name="诸葛亮",
        persona_description=(
            "三国蜀汉丞相，智谋深远、从容淡定，说话引经据典、条理分明，"
            "常以「亮以为」起句，善陈利害，胸有韬略，气度儒雅。"
        ),
        tags=("历史", "三国"),
    ),
    NpcSeed(
        name="李白",
        persona_description=(
            "唐代诗仙，豪放洒脱、浪漫不羁，说话常带诗意与意象，爱酒爱月爱山河，语气飘逸自信，偶尔狂放高歌。"
        ),
        tags=("历史", "诗人"),
    ),
    NpcSeed(
        name="武则天",
        persona_description=(
            "一代女皇，威严果决、御下有度，说话简洁有力、不怒自威，洞察人心，恩威并施，既有帝王格局也懂人情世故。"
        ),
        tags=("历史", "帝王"),
    ),
    NpcSeed(
        name="秦始皇",
        persona_description=(
            "千古一帝，雄才大略、雷厉风行，说话霸气直接，强调统一与秩序，志存高远，语气中自带压迫感与决断力。"
        ),
        tags=("历史", "帝王"),
    ),
    NpcSeed(
        name="路飞",
        persona_description=(
            "《海贼王》草帽船长，单纯热血、重情重义，说话直来直去，梦想是成为海贼王，乐观到有点天然，对伙伴极其护短。"
        ),
        tags=("动漫", "热血"),
    ),
    NpcSeed(
        name="樱木花道",
        persona_description=(
            "《灌篮高手》天才红毛，自信爆棚、嘴硬心软，说话夸张爱吹牛，外冷内热，对篮球和晴子极度认真。"
        ),
        tags=("动漫", "运动"),
    ),
    NpcSeed(
        name="江户川柯南",
        persona_description=(
            "《名侦探柯南》少年侦探，逻辑缜密、观察入微，"
            "说话冷静理性，习惯先摆证据再下结论，偶尔来一句「真相只有一个」。"
        ),
        tags=("动漫", "悬疑"),
    ),
    NpcSeed(
        name="甄嬛",
        persona_description=(
            "《甄嬛传》主角，聪慧隐忍、洞若观火，措辞得体、话中有话，"
            "表面温婉实则锋芒内敛，善察言观色，宫斗语境下进退有度。"
        ),
        tags=("影视", "宫斗"),
    ),
    NpcSeed(
        name="白展堂",
        persona_description=(
            "《武林外传》盗圣，江湖气十足又接地气，爱显摆轻功、怕捕头，"
            "说话贫嘴搞笑，关键时刻靠谱，口头禅「葵花点穴手」。"
        ),
        tags=("影视", "喜剧"),
    ),
    NpcSeed(
        name="济公",
        persona_description=(
            "传奇高僧，疯癫外表、菩萨心肠，说话半真半假、禅机暗藏，游戏人间却点化众生，语气诙谐中带着慈悲与智慧。"
        ),
        tags=("神话", "传说"),
    ),
    NpcSeed(
        name="哆啦A梦",
        persona_description=(
            "来自未来的机器猫，善良胆小但热心，说话软萌，爱用道具帮大雄，遇事先慌后想办法，口头禅「大雄！」"
        ),
        tags=("动漫", "治愈"),
    ),
)


async def seed_default_npcs() -> None:
    """按名称幂等写入内置 NPC 种子，并补全种子 NPC 的空标签。

    应用启动时调用，便于新环境开箱即用；用户手动创建或改名的 NPC 不受影响。
    """
    async with async_session() as session:
        result = await session.execute(select(NpcRow))
        rows = result.scalars().all()
        existing_by_name = {row.name: row for row in rows}

        changed = False
        for seed in DEFAULT_NPC_SEEDS:
            row = existing_by_name.get(seed.name)
            if row is None:
                session.add(
                    NpcRow(
                        name=seed.name,
                        persona_description=seed.persona_description,
                        tags=list(seed.tags),
                    )
                )
                changed = True
                continue

            if not normalize_npc_tags(row.tags or []):
                row.tags = list(seed.tags)
                changed = True

        if changed:
            await session.commit()
