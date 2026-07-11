"""membership permission grants

Revision ID: 0003_membership_permissions
Revises: 0002_auth_membership_cache_fixes
Create Date: 2026-07-11
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "0003_membership_permissions"
down_revision = "0002_auth_membership_cache_fixes"
branch_labels = None
depends_on = None


def _columns(table_name: str) -> set[str]:
    return {column["name"] for column in inspect(op.get_bind()).get_columns(table_name)}


def upgrade() -> None:
    if "permissions" not in _columns("family_members"):
        with op.batch_alter_table("family_members") as batch:
            batch.add_column(sa.Column("permissions", sa.JSON(), nullable=True))


def downgrade() -> None:
    if "permissions" in _columns("family_members"):
        with op.batch_alter_table("family_members") as batch:
            batch.drop_column("permissions")
