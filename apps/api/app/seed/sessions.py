import asyncio

from sqlalchemy import func, select

from app.db import async_session, init_db
from app.models.session import SessionRow
from app.seed.chat_items_data import SEED_ITEMS


def _seed_chat_items_json() -> list[dict[str, str]]:
    """将种子 tuple 数据转换为 JSON 存储格式。

    Returns:
        ``{ kind, text }`` 字典列表。
    """
    return [{"kind": kind, "text": text} for kind, text in SEED_ITEMS]


async def seed_sessions(force: bool = False) -> int:
    """将初始会话数据写入 MySQL。

    若表内已有数据且未指定 force，则跳过写入。

    Args:
        force: 为 True 时清空现有数据后重新导入。

    Returns:
        本次写入的行数；跳过时返回 0。
    """
    await init_db()

    async with async_session() as session:
        count_result = await session.execute(select(func.count()).select_from(SessionRow))
        existing = count_result.scalar_one()

        if existing > 0 and not force:
            print(f"sessions 已有 {existing} 条记录，跳过 seed（使用 --force 可覆盖）")
            return 0

        if force and existing > 0:
            for row in (await session.execute(select(SessionRow))).scalars().all():
                await session.delete(row)
            await session.flush()

        row = SessionRow(
            title="豆包 × DeepSeek 练车记",
            description="科目二挂科后的微信聊天记录",
            chat_items=_seed_chat_items_json(),
        )
        session.add(row)
        await session.commit()
        print("已写入 1 条 sessions")
        return 1


def main() -> None:
    """CLI 入口：python -m app.seed.sessions [--force]"""
    import sys

    force = "--force" in sys.argv
    asyncio.run(seed_sessions(force=force))


if __name__ == "__main__":
    main()
