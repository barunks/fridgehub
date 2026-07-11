"""enforce max devices per user at DB level

Revision ID: 0006_max_devices_constraint
Revises: 0005_device_sessions
Create Date: 2026-07-13

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text


revision = "0006_max_devices_constraint"
down_revision = "0005_device_sessions"
branch_labels = None
depends_on = None

MAX_DEVICES_DEFAULT = 5


def _columns(table_name: str) -> set[str]:
    return {column["name"] for column in inspect(op.get_bind()).get_columns(table_name)}


def _is_mysql() -> bool:
    return op.get_bind().dialect.name == "mysql"


def upgrade() -> None:
    # Add max_devices column to users table for per-user override
    cols = _columns("users")
    if "max_devices" not in cols:
        with op.batch_alter_table("users") as batch:
            batch.add_column(
                sa.Column("max_devices", sa.Integer(), nullable=False, server_default=str(MAX_DEVICES_DEFAULT))
            )

    # MySQL trigger to enforce device limit on INSERT
    if _is_mysql():
        op.execute(text("""
            CREATE TRIGGER trg_enforce_max_devices
            BEFORE INSERT ON devices
            FOR EACH ROW
            BEGIN
                DECLARE device_count INT;
                DECLARE user_max INT;

                SELECT COUNT(*) INTO device_count
                FROM devices
                WHERE user_id = NEW.user_id AND is_active = 1 AND is_revoked = 0;

                SELECT COALESCE(max_devices, 5) INTO user_max
                FROM users
                WHERE id = NEW.user_id;

                IF device_count >= user_max THEN
                    SIGNAL SQLSTATE '45000'
                    SET MESSAGE_TEXT = 'Maximum number of devices reached for this user';
                END IF;
            END;
        """))


def downgrade() -> None:
    if _is_mysql():
        op.execute(text("DROP TRIGGER IF EXISTS trg_enforce_max_devices"))

    cols = _columns("users")
    if "max_devices" in cols:
        with op.batch_alter_table("users") as batch:
            batch.drop_column("max_devices")
