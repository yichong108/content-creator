"""
数据库初始化、会话获取。

注意：schema 变更已迁移到 Alembic，见 alembic/versions/ 下的迁移脚本。
"""

from collections.abc import AsyncGenerator

from sqlalchemy import select
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


async def init_db() -> None:
    """应用启动时的数据初始化。

    仅负责数据 seed（管理员账号、默认 NPC）和运行状态重置（清 running 标记）。
    Schema 变更已由 Alembic 迁移体系接管，不再使用 create_all 或手动 ALTER TABLE。

    Raises:
        Exception: 若 seed_default_admin / _seed_default_npcs 失败，异常会向上冒泡，
                   阻止服务启动，保证运行时数据库处于一致状态。
    """
    from app.services.auth_security import seed_default_admin

    await seed_default_admin()
    await _ensure_default_live_session()
    await _ensure_default_live_mobile_session()
    await _reset_stale_live_session_running()
    await _seed_default_npcs()


async def _ensure_default_live_session() -> None:
    """若库中尚无已开启的桌面端直播会话，则启用最近更新的那条。"""
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


async def _ensure_default_live_mobile_session() -> None:
    """若库中尚无移动端直播会话，则启用最近更新的那条。"""
    from app.models.live_session import LiveSessionRow

    async with async_session() as session:
        enabled_result = await session.execute(
            select(LiveSessionRow).where(LiveSessionRow.mobile_enabled.is_(True)).limit(1)
        )
        if enabled_result.scalar_one_or_none() is not None:
            return

        latest_result = await session.execute(
            select(LiveSessionRow).order_by(LiveSessionRow.updated_at.desc()).limit(1)
        )
        row = latest_result.scalar_one_or_none()
        if row is None:
            return

        row.mobile_enabled = True
        await session.commit()


async def _reset_stale_live_session_running() -> None:
    """应用重启后将所有 running 标记清零，避免无后台任务却显示运行中。"""
    from app.models.live_session import LiveSessionRow

    async with async_session() as session:
        result = await session.execute(select(LiveSessionRow).where(LiveSessionRow.running.is_(True)))
        rows = result.scalars().all()
        if not rows:
            return
        for row in rows:
            row.running = False
        await session.commit()


async def _seed_default_npcs() -> None:
    """写入内置 NPC 种子数据（按名称去重）。"""
    from app.services.npc_seed import seed_default_npcs

    await seed_default_npcs()
