"""device registration and session tracking

Revision ID: 0005_device_sessions
Revises: 0004_per_member_meal_plans
Create Date: 2026-07-13

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "0005_device_sessions"
down_revision = "0004_per_member_meal_plans"
branch_labels = None
depends_on = None


def _columns(table_name: str) -> set[str]:
    return {column["name"] for column in inspect(op.get_bind()).get_columns(table_name)}


def _tables() -> set[str]:
    return set(inspect(op.get_bind()).get_table_names())


def upgrade() -> None:
    # Extend devices table
    cols = _columns("devices")
    with op.batch_alter_table("devices") as batch:
        if "family_id" not in cols:
            batch.add_column(sa.Column("family_id", sa.Integer(), nullable=True))
        if "device_type" not in cols:
            batch.add_column(sa.Column("device_type", sa.String(30), nullable=False, server_default="browser"))
        if "platform" not in cols:
            batch.add_column(sa.Column("platform", sa.String(100), nullable=True))
        if "last_ip" not in cols:
            batch.add_column(sa.Column("last_ip", sa.String(45), nullable=True))
        if "last_user_agent" not in cols:
            batch.add_column(sa.Column("last_user_agent", sa.String(512), nullable=True))
        if "is_revoked" not in cols:
            batch.add_column(sa.Column("is_revoked", sa.Boolean(), nullable=False, server_default="0"))
        if "is_trusted" not in cols:
            batch.add_column(sa.Column("is_trusted", sa.Boolean(), nullable=False, server_default="0"))
        if "registered_at" not in cols:
            batch.add_column(sa.Column("registered_at", sa.DateTime(), server_default=sa.func.now(), nullable=False))

    # Create device_sessions table
    if "device_sessions" not in _tables():
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
    if "device_sessions" in _tables():
        op.drop_table("device_sessions")

    cols = _columns("devices")
    with op.batch_alter_table("devices") as batch:
        for col in ("family_id", "device_type", "platform", "last_ip", "last_user_agent", "is_revoked", "is_trusted", "registered_at"):
            if col in cols:
                batch.drop_column(col)
