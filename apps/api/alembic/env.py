"""Alembic 环境配置

关键处理：
- 从 app.config.settings 读取 database_url，避免在 alembic.ini 硬编码连接串
- 将 async 驱动 (aiomysql) 自动替换为同步驱动 (pymysql)，因为 Alembic 运行在同步上下文
- 导入 app.models 触发 Base.metadata 的表注册，为 autogenerate 提供 target_metadata
"""

from __future__ import annotations

import sys
from logging.config import fileConfig
from pathlib import Path

from sqlalchemy import engine_from_config, pool

from alembic import context

# ---------------------------------------------------------------------------
# 确保 alembic 脚本可导入 app 包
# ---------------------------------------------------------------------------
_API_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_API_ROOT))

# ---------------------------------------------------------------------------
# 配置 SQLAlchemy URL — 从项目 settings 读取，并把 async 驱动换成同步驱动
# ---------------------------------------------------------------------------
from app.config import settings  # noqa: E402

# aiomysql -> pymysql, 因为 Alembic 本身运行在同步上下文
_sync_database_url = settings.database_url.replace("mysql+aiomysql", "mysql+pymysql")

# ---------------------------------------------------------------------------
# 导入所有模型，触发 Base.metadata 表注册
# ---------------------------------------------------------------------------
from app.db import Base  # noqa: E402
from app.models import admin_user, customer_chat, document, live_session, npc  # noqa: E402,F401

target_metadata = Base.metadata

# ---------------------------------------------------------------------------
# Alembic Config — 写入替换后的同步 URL
# ---------------------------------------------------------------------------
config = context.config
config.set_main_option("sqlalchemy.url", _sync_database_url)

# 加载日志配置
if config.config_file_name is not None:
    fileConfig(config.config_file_name)


def run_migrations_offline() -> None:
    """离线迁移：不连数据库，生成纯 SQL 脚本。"""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """在线迁移：连接数据库执行迁移。"""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
