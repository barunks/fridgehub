"""remove hard-coded device limits — limits now config-driven

Revision ID: 0011_remove_device_limits
Revises: 0010_verification
Create Date: 2025-01-01 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "0011_remove_device_limits"
down_revision = "0010_verification"
branch_labels = None
depends_on = None


def _is_mysql() -> bool:
    return op.get_bind().dialect.name == "mysql"


def upgrade() -> None:
    # Make max_devices nullable (NULL = no limit); drop the MySQL trigger if present
    if _is_mysql():
        op.execute(sa.text("DROP TRIGGER IF EXISTS trg_enforce_max_devices"))
        op.execute(sa.text("ALTER TABLE users MODIFY COLUMN max_devices INT NULL DEFAULT NULL"))
        op.execute(sa.text("UPDATE users SET max_devices = NULL"))
    else:
        with op.batch_alter_table("users") as batch:
            batch.alter_column("max_devices", existing_type=sa.Integer(), nullable=True, server_default=None)
        op.execute(sa.text("UPDATE users SET max_devices = NULL"))


def downgrade() -> None:
    if _is_mysql():
        op.execute(sa.text("UPDATE users SET max_devices = 5 WHERE max_devices IS NULL"))
        op.execute(sa.text("ALTER TABLE users MODIFY COLUMN max_devices INT NOT NULL DEFAULT 5"))
    else:
        op.execute(sa.text("UPDATE users SET max_devices = 5 WHERE max_devices IS NULL"))
        with op.batch_alter_table("users") as batch:
            batch.alter_column("max_devices", existing_type=sa.Integer(), nullable=False, server_default="5")
