"""membership permission grants

Revision ID: 0003_membership_permissions
Revises: 0002_auth_membership_cache_fixes
Create Date: 2026-07-11
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


revision = "0003_membership_permissions"
down_revision = "0002_auth_membership_cache_fixes"
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
    if not _has_column("family_members", "permissions"):
        with op.batch_alter_table("family_members") as batch:
            batch.add_column(sa.Column("permissions", sa.JSON(), nullable=True))


def downgrade() -> None:
    if _has_column("family_members", "permissions"):
        with op.batch_alter_table("family_members") as batch:
            batch.drop_column("permissions")
