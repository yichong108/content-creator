"""add customer_chat_messages table

新增客户聊天消息表，用于持久化客户与 AI 客服的对话记录，
支持按 session_id 归属会话和游标式向上翻历史。

Revision ID: 0003
Revises: 0002
Create Date: 2026-09-05 22:30:00.000000

"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import mysql

from alembic import op

# revision identifiers, used by Alembic.
revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """创建 customer_chat_messages 表。"""
    op.create_table(
        "customer_chat_messages",
        sa.Column("id", mysql.BIGINT(), autoincrement=True, nullable=False),
        sa.Column("session_id", mysql.VARCHAR(length=64), nullable=False),
        sa.Column("role", mysql.VARCHAR(length=20), nullable=False),
        sa.Column("content", mysql.TEXT(), nullable=False),
        sa.Column(
            "created_at",
            mysql.DATETIME(),
            server_default=sa.text("(now())"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        mysql_collate="utf8mb4_0900_ai_ci",
        mysql_default_charset="utf8mb4",
        mysql_engine="InnoDB",
    )
    op.create_index(
        op.f("ix_customer_chat_session_id"),
        "customer_chat_messages",
        ["session_id", "id"],
        unique=False,
    )


def downgrade() -> None:
    """删除 customer_chat_messages 表。"""
    op.drop_index(op.f("ix_customer_chat_session_id"), table_name="customer_chat_messages")
    op.drop_table("customer_chat_messages")
