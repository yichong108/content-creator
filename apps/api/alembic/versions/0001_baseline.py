"""initial schema — 创建全部当前表

首次接入 Alembic 时对存量数据库已 stamp 为 0001，因此 upgrade 用
IF NOT EXISTS 兼容已有数据库；全新空库首次 upgrade 时才会真正建表。

Revision ID: 0001
Revises:
Create Date: 2026-09-05 20:00:00.000000

"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import mysql

from alembic import op

# revision identifiers, used by Alembic.
revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """创建全部当前表，IF NOT EXISTS 兼容存量库。"""
    # admin_users 先建（被后续三张表 FK 引用）
    op.create_table(
        "admin_users",
        sa.Column("id", mysql.BIGINT(), autoincrement=True, nullable=False),
        sa.Column("username", mysql.VARCHAR(length=64), nullable=False),
        sa.Column("password_hash", mysql.VARCHAR(length=255), nullable=False),
        sa.Column("is_active", mysql.BOOLEAN(), nullable=False),
        sa.Column("created_at", mysql.DATETIME(), server_default=sa.text("(now())"), nullable=False),
        sa.Column("updated_at", mysql.DATETIME(), server_default=sa.text("(now())"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("username"),
        mysql_collate="utf8mb4_0900_ai_ci",
        mysql_default_charset="utf8mb4",
        mysql_engine="InnoDB",
        prefixes=["IF NOT EXISTS"],
    )

    op.create_table(
        "documents",
        sa.Column("id", mysql.BIGINT(), autoincrement=True, nullable=False),
        sa.Column("filename", mysql.VARCHAR(length=255), nullable=False),
        sa.Column("extension", mysql.VARCHAR(length=16), nullable=False),
        sa.Column("file_size", mysql.INTEGER(), autoincrement=False, nullable=False),
        sa.Column("created_by", mysql.BIGINT(), autoincrement=False, nullable=True),
        sa.Column("created_at", mysql.DATETIME(), server_default=sa.text("(now())"), nullable=False),
        sa.Column("updated_at", mysql.DATETIME(), server_default=sa.text("(now())"), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["admin_users.id"]),
        sa.PrimaryKeyConstraint("id"),
        mysql_collate="utf8mb4_0900_ai_ci",
        mysql_default_charset="utf8mb4",
        mysql_engine="InnoDB",
        prefixes=["IF NOT EXISTS"],
    )

    op.create_table(
        "live_sessions",
        sa.Column("id", mysql.BIGINT(), autoincrement=True, nullable=False),
        sa.Column("title", mysql.VARCHAR(length=200), nullable=False),
        sa.Column("description", mysql.TEXT(), nullable=True),
        sa.Column("chat_items", mysql.JSON(), nullable=False),
        sa.Column("peer_npc_ids", mysql.JSON(), nullable=False),
        sa.Column("self_npc_id", mysql.BIGINT(), autoincrement=False, nullable=True),
        sa.Column("created_by", mysql.BIGINT(), autoincrement=False, nullable=True),
        sa.Column("enabled", mysql.BOOLEAN(), server_default=sa.text("'0'"), nullable=False),
        sa.Column("mobile_enabled", mysql.BOOLEAN(), server_default=sa.text("'0'"), nullable=False),
        sa.Column("running", mysql.BOOLEAN(), server_default=sa.text("'0'"), nullable=False),
        sa.Column("created_at", mysql.DATETIME(), server_default=sa.text("(now())"), nullable=False),
        sa.Column("updated_at", mysql.DATETIME(), server_default=sa.text("(now())"), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["admin_users.id"]),
        sa.PrimaryKeyConstraint("id"),
        mysql_collate="utf8mb4_0900_ai_ci",
        mysql_default_charset="utf8mb4",
        mysql_engine="InnoDB",
        prefixes=["IF NOT EXISTS"],
    )

    op.create_table(
        "npcs",
        sa.Column("id", mysql.BIGINT(), autoincrement=True, nullable=False),
        sa.Column("name", mysql.VARCHAR(length=200), nullable=False),
        sa.Column("persona_description", mysql.TEXT(), nullable=False),
        sa.Column("tags", mysql.JSON(), nullable=False),
        sa.Column("avatar_url", mysql.VARCHAR(length=500), nullable=True),
        sa.Column("created_by", mysql.BIGINT(), autoincrement=False, nullable=True),
        sa.Column("created_at", mysql.DATETIME(), server_default=sa.text("(now())"), nullable=False),
        sa.Column("updated_at", mysql.DATETIME(), server_default=sa.text("(now())"), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["admin_users.id"]),
        sa.PrimaryKeyConstraint("id"),
        mysql_collate="utf8mb4_0900_ai_ci",
        mysql_default_charset="utf8mb4",
        mysql_engine="InnoDB",
        prefixes=["IF NOT EXISTS"],
    )


def downgrade() -> None:
    """删除全部表。"""
    op.drop_table("npcs")
    op.drop_table("live_sessions")
    op.drop_table("documents")
    op.drop_table("admin_users")
