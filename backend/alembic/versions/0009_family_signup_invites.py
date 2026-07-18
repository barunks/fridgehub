"""add family signup invites

Revision ID: 0009_family_signup_invites
Revises: 0008_grocery_extended_frequencies
Create Date: 2026-07-13

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


revision = "0009_family_signup_invites"
down_revision = "0008_grocery_ext_frequencies"
branch_labels = None
depends_on = None


def _has_table(table: str) -> bool:
    bind = op.get_bind()
    if bind.dialect.name == "sqlite":
        rows = bind.execute(text(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=:t"
        ), {"t": table}).fetchall()
        return len(rows) > 0
    result = bind.execute(text(
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = :t"
    ), {"t": table})
    return result.scalar() > 0


def upgrade() -> None:
    if _has_table("family_invites"):
        return
    op.create_table(
        "family_invites",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("uuid", sa.String(length=36), nullable=False),
        sa.Column("family_id", sa.Integer(), nullable=False),
        sa.Column("invited_by", sa.Integer(), nullable=True),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("role", sa.String(length=50), nullable=False, server_default="member"),
        sa.Column("permissions", sa.JSON(), nullable=True),
        sa.Column("max_uses", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("used_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("last_used_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.ForeignKeyConstraint(["family_id"], ["families.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["invited_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("uuid"),
    )
    op.create_index("idx_family_invites_family", "family_invites", ["family_id"])
    op.create_index("idx_family_invites_token_hash", "family_invites", ["token_hash"], unique=True)


def downgrade() -> None:
    if not _has_table("family_invites"):
        return
    op.drop_index("idx_family_invites_token_hash", table_name="family_invites")
    op.drop_index("idx_family_invites_family", table_name="family_invites")
    op.drop_table("family_invites")
