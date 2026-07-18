"""device registration and session tracking

Revision ID: 0005_device_sessions
Revises: 0004_per_member_meal_plans
Create Date: 2026-07-13

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


revision = "0005_device_sessions"
down_revision = "0004_per_member_meal_plans"
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
    cols_to_add = [
        ("family_id", sa.Column("family_id", sa.Integer(), nullable=True)),
        ("device_type", sa.Column("device_type", sa.String(30), nullable=False, server_default="browser")),
        ("platform", sa.Column("platform", sa.String(100), nullable=True)),
        ("last_ip", sa.Column("last_ip", sa.String(45), nullable=True)),
        ("last_user_agent", sa.Column("last_user_agent", sa.String(512), nullable=True)),
        ("is_revoked", sa.Column("is_revoked", sa.Boolean(), nullable=False, server_default="0")),
        ("is_trusted", sa.Column("is_trusted", sa.Boolean(), nullable=False, server_default="0")),
        ("registered_at", sa.Column("registered_at", sa.DateTime(), server_default=sa.func.now(), nullable=False)),
    ]
    missing = [(name, col) for name, col in cols_to_add if not _has_column("devices", name)]
    if missing:
        with op.batch_alter_table("devices") as batch:
            for _, col in missing:
                batch.add_column(col)

    if not _has_table("device_sessions"):
        op.create_table(
            "device_sessions",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("uuid", sa.String(36), unique=True, nullable=False),
            sa.Column("device_id", sa.Integer(), sa.ForeignKey("devices.id", ondelete="CASCADE"), nullable=False),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("family_id", sa.Integer(), sa.ForeignKey("families.id", ondelete="SET NULL"), nullable=True),
            sa.Column("jti", sa.String(36), nullable=False),
            sa.Column("token_type", sa.String(10), nullable=False),
            sa.Column("issued_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.Column("expires_at", sa.DateTime(), nullable=False),
            sa.Column("revoked_at", sa.DateTime(), nullable=True),
            sa.Column("ip_address", sa.String(45), nullable=True),
            sa.Column("user_agent", sa.String(512), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default="1"),
        )
        op.create_index("idx_device_sessions_device", "device_sessions", ["device_id"])
        op.create_index("idx_device_sessions_jti", "device_sessions", ["jti"], unique=True)


def downgrade() -> None:
    if _has_table("device_sessions"):
        op.drop_table("device_sessions")

    cols = ["family_id", "device_type", "platform", "last_ip", "last_user_agent",
            "is_revoked", "is_trusted", "registered_at"]
    present = [c for c in cols if _has_column("devices", c)]
    if present:
        with op.batch_alter_table("devices") as batch:
            for col in present:
                batch.drop_column(col)
