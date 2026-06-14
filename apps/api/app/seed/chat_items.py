import asyncio

from sqlalchemy import func, select

from app.db import async_session, init_db
from app.models.chat_item import ChatItemRow
from app.seed.chat_items_data import SEED_ITEMS


async def seed_chat_items(force: bool = False) -> int:
    """将初始聊天数据写入 MySQL。

    若表内已有数据且未指定 force，则跳过写入。

    Args:
        force: 为 True 时清空现有数据后重新导入。

    Returns:
        本次写入的行数；跳过时返回 0。
    """
    await init_db()

    async with async_session() as session:
        count_result = await session.execute(select(func.count()).select_from(ChatItemRow))
        existing = count_result.scalar_one()

        if existing > 0 and not force:
            print(f"chat_items 已有 {existing} 条记录，跳过 seed（使用 --force 可覆盖）")
            return 0

        if force and existing > 0:
            for row in (await session.execute(select(ChatItemRow))).scalars().all():
                await session.delete(row)
            await session.flush()

        rows = [
            ChatItemRow(kind=kind, text=text, sort_order=index)
            for index, (kind, text) in enumerate(SEED_ITEMS)
        ]
        session.add_all(rows)
        await session.commit()
        print(f"已写入 {len(rows)} 条 chat_items")
        return len(rows)


def main() -> None:
    """CLI 入口：python -m app.seed.chat_items [--force]"""
    import sys

    force = "--force" in sys.argv
    asyncio.run(seed_chat_items(force=force))


if __name__ == "__main__":
    main()
