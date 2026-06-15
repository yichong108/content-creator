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
            await conn.execute(
                text("ALTER TABLE sessions ADD COLUMN mobile_enabled TINYINT(1) NOT NULL DEFAULT 0")
            )


async def _ensure_default_mobile_session() -> None:
    """若库中尚无移动端会话，则启用最近更新的会话。"""
    from app.models.session import SessionRow

    async with async_session() as session:
        enabled_result = await session.execute(
            select(SessionRow).where(SessionRow.mobile_enabled.is_(True)).limit(1)
        )
        if enabled_result.scalar_one_or_none() is not None:
            return

        latest_result = await session.execute(
            select(SessionRow).order_by(SessionRow.updated_at.desc()).limit(1)
        )
        row = latest_result.scalar_one_or_none()
        if row is None:
            return

        row.mobile_enabled = True
        await session.commit()


async def init_db() -> None:
    """创建尚未存在的数据库表，并应用增量 schema 变更。"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await _ensure_mobile_enabled_column()
    await _ensure_default_mobile_session()
