"""cleanup legacy tables and add FK constraints

删除已废弃的 sessions / chat_items 表，清理 live_sessions / npcs 上的旧列，
并补齐 ORM 模型声明但数据库缺失的 created_by 外键约束。

Revision ID: 0002
Revises: 0001
Create Date: 2026-09-05 20:10:00.000000

"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import mysql

from alembic import op

# revision identifiers, used by Alembic.
revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """删除旧表、旧列。IF EXISTS 确保全新库安全跳过。

    注意：created_by 外键约束已在 0001 建表时 inline 定义，
    本条迁移不再重复创建。
    """
    op.drop_index(op.f("ix_chat_items_sort_order"), table_name="chat_items", if_exists=True)
    op.drop_table("chat_items", if_exists=True)
    op.drop_table("sessions", if_exists=True)
    op.drop_column("live_sessions", "source_session_id", if_exists=True)
    op.drop_column("live_sessions", "peer_npc_id", if_exists=True)
    op.drop_column("live_sessions", "npc_ids", if_exists=True)
    op.drop_column("npcs", "chat_items", if_exists=True)


def downgrade() -> None:
    """回退：恢复旧表、旧列。

    注意：三个 created_by 外键约束的 drop_constraint 使用了 None 约束名，
    MySQL 下 Alembic autogenerate 无法反推约束名，因此这里跳过 FK 回退。
    如需彻底移除 FK，可手动执行 `ALTER TABLE xxx DROP FOREIGN KEY fk_name`。
    """
    op.add_column(
        "npcs", sa.Column("chat_items", mysql.JSON(), server_default=sa.text("(json_array())"), nullable=False)
    )
    op.add_column(
        "live_sessions", sa.Column("npc_ids", mysql.JSON(), server_default=sa.text("(json_array())"), nullable=False)
    )
    op.add_column("live_sessions", sa.Column("peer_npc_id", mysql.BIGINT(), autoincrement=False, nullable=True))
    op.add_column("live_sessions", sa.Column("source_session_id", mysql.BIGINT(), autoincrement=False, nullable=True))
    op.create_table(
        "sessions",
        sa.Column("id", mysql.BIGINT(), autoincrement=True, nullable=False),
        sa.Column("title", mysql.VARCHAR(length=200), nullable=False),
        sa.Column("description", mysql.TEXT(), nullable=True),
        sa.Column("chat_items", mysql.JSON(), nullable=False),
        sa.Column("created_at", mysql.DATETIME(), server_default=sa.text("(now())"), nullable=False),
        sa.Column("updated_at", mysql.DATETIME(), server_default=sa.text("(now())"), nullable=False),
        sa.Column(
            "mobile_enabled",
            mysql.TINYINT(display_width=1),
            server_default=sa.text("'0'"),
            autoincrement=False,
            nullable=False,
        ),
        sa.Column(
            "live_enabled",
            mysql.TINYINT(display_width=1),
            server_default=sa.text("'0'"),
            autoincrement=False,
            nullable=False,
        ),
        sa.Column("peer_npc_id", mysql.BIGINT(), autoincrement=False, nullable=True),
        sa.Column("self_npc_id", mysql.BIGINT(), autoincrement=False, nullable=True),
        sa.Column("peer_npc_ids", mysql.JSON(), server_default=sa.text("(json_array())"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        mysql_collate="utf8mb4_0900_ai_ci",
        mysql_default_charset="utf8mb4",
        mysql_engine="InnoDB",
    )
    op.create_table(
        "chat_items",
        sa.Column("id", mysql.BIGINT(), autoincrement=True, nullable=False),
        sa.Column("kind", mysql.VARCHAR(length=20), nullable=False),
        sa.Column("text", mysql.TEXT(), nullable=False),
        sa.Column("sort_order", mysql.INTEGER(), autoincrement=False, nullable=False),
        sa.PrimaryKeyConstraint("id"),
        mysql_collate="utf8mb4_0900_ai_ci",
        mysql_default_charset="utf8mb4",
        mysql_engine="InnoDB",
    )
    op.create_index(op.f("ix_chat_items_sort_order"), "chat_items", ["sort_order"], unique=False)
