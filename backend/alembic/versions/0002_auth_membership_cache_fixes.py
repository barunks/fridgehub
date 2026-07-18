"""auth and membership hardening

Revision ID: 0002_auth_membership_cache_fixes
Revises: 0001_initial_schema
Create Date: 2026-07-11
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


revision = "0002_auth_membership_cache_fixes"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None


def _has_column(table: str, column: str) -> bool:
    bind = op.get_bind()
    if bind.dialect.name == "sqlite":
        rows = bind.execute(text(f"PRAGMA table_info({table})")).fetchall()
        return any(r[1] == column for r in rows)
    result = bind.execute(text(
        "SELECT COUNT(*) FROM information_schema.columns "
        "WHERE table_name = :t AND column_name = :c"
    ), {"t": table, "c": column})
    return result.scalar() > 0


def upgrade() -> None:
    if not _has_column("users", "token_version"):
        with op.batch_alter_table("users") as batch:
            batch.add_column(sa.Column("token_version", sa.Integer(), nullable=False, server_default="0"))

    if not _has_column("family_members", "is_active"):
        with op.batch_alter_table("family_members") as batch:
            batch.add_column(sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()))


def downgrade() -> None:
    if _has_column("family_members", "is_active"):
        with op.batch_alter_table("family_members") as batch:
            batch.drop_column("is_active")

    if _has_column("users", "token_version"):
        with op.batch_alter_table("users") as batch:
            batch.drop_column("token_version")
