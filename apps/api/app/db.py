"""
数据库初始化、会话获取、会话移动端展示开关更新、会话删除等操作。
"""

from collections.abc import AsyncGenerator

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings
from app.platform import fix_windows_env

fix_windows_env()

engine = create_async_engine(settings.database_url, echo=False, pool_pre_ping=True)
async_session = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    """SQLAlchemy 声明式基类。"""


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """为 FastAPI 依赖注入提供异步数据库会话。

    Yields:
        当前请求的 AsyncSession，请求结束后自动关闭。
    """
    async with async_session() as session:
        yield session


async def _ensure_mobile_enabled_column() -> None:
    """为已有 deployments 补齐 mobile_enabled 列。"""
    async with engine.begin() as conn:
        result = await conn.execute(
            text(
                """
                SELECT COUNT(*)
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'sessions'
                  AND COLUMN_NAME = 'mobile_enabled'
                """
            )
        )
        if result.scalar_one() == 0:
            await conn.execute(text("ALTER TABLE sessions ADD COLUMN mobile_enabled TINYINT(1) NOT NULL DEFAULT 0"))


async def _ensure_default_mobile_session() -> None:
    """
    处理关于移动端获取一条会话记录的逻辑：
    若库中尚无移动端会话，则启用最近更新的会话。
    """
    # 导入 SessionRow 模型
    from app.models.session import SessionRow

    async with async_session() as session:
        enabled_result = await session.execute(select(SessionRow).where(SessionRow.mobile_enabled.is_(True)).limit(1))
        # 如果存在移动端会话，则直接返回
        if enabled_result.scalar_one_or_none() is not None:
            return

        # 查询最近更新的会话
        latest_result = await session.execute(select(SessionRow).order_by(SessionRow.updated_at.desc()).limit(1))
        row = latest_result.scalar_one_or_none()
        if row is None:
            return

        row.mobile_enabled = True
        # 提交事务
        await session.commit()


async def _ensure_live_session_running_column() -> None:
    """为已有 deployments 补齐 live_sessions.running 列。"""
    async with engine.begin() as conn:
        result = await conn.execute(
            text(
                """
                SELECT COUNT(*)
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'live_sessions'
                  AND COLUMN_NAME = 'running'
                """
            )
        )
        if result.scalar_one() == 0:
            await conn.execute(text("ALTER TABLE live_sessions ADD COLUMN running TINYINT(1) NOT NULL DEFAULT 0"))


async def _reset_stale_live_session_running() -> None:
    """应用重启后将 running 标记清零，避免无后台任务却显示运行中。"""
    from app.models.live_session import LiveSessionRow

    async with async_session() as session:
        result = await session.execute(select(LiveSessionRow).where(LiveSessionRow.running.is_(True)))
        rows = result.scalars().all()
        if not rows:
            return
        for row in rows:
            row.running = False
        await session.commit()


async def _ensure_default_live_session() -> None:
    """
    若库中尚无已开启的直播会话，则启用最近更新的直播会话。
    """
    from app.models.live_session import LiveSessionRow

    async with async_session() as session:
        enabled_result = await session.execute(select(LiveSessionRow).where(LiveSessionRow.enabled.is_(True)).limit(1))
        if enabled_result.scalar_one_or_none() is not None:
            return

        latest_result = await session.execute(
            select(LiveSessionRow).order_by(LiveSessionRow.updated_at.desc()).limit(1)
        )
        row = latest_result.scalar_one_or_none()
        if row is None:
            return

        row.enabled = True
        await session.commit()


async def _ensure_npc_tags_column() -> None:
    """为已有 deployments 补齐 npcs.tags 列。"""
    async with engine.begin() as conn:
        result = await conn.execute(
            text(
                """
                SELECT COUNT(*)
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'npcs'
                  AND COLUMN_NAME = 'tags'
                """
            )
        )
        if result.scalar_one() == 0:
            await conn.execute(text("ALTER TABLE npcs ADD COLUMN tags JSON NOT NULL DEFAULT (JSON_ARRAY())"))


async def _ensure_npc_avatar_url_column() -> None:
    """为已有 deployments 补齐 npcs.avatar_url 列。"""
    async with engine.begin() as conn:
        result = await conn.execute(
            text(
                """
                SELECT COUNT(*)
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'npcs'
                  AND COLUMN_NAME = 'avatar_url'
                """
            )
        )
        if result.scalar_one() == 0:
            await conn.execute(text("ALTER TABLE npcs ADD COLUMN avatar_url VARCHAR(500) NULL"))


async def init_db() -> None:
    """创建尚未存在的数据库表，并应用增量 schema 变更。"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await _ensure_mobile_enabled_column()
    await _ensure_live_session_running_column()
    await _ensure_npc_tags_column()
    await _ensure_npc_avatar_url_column()
    await _ensure_default_mobile_session()
    await _ensure_default_live_session()
    await _reset_stale_live_session_running()
    await _seed_default_npcs()


async def _seed_default_npcs() -> None:
    """写入内置 NPC 种子数据（按名称去重）。"""
    from app.services.npc_seed import seed_default_npcs

    await seed_default_npcs()
