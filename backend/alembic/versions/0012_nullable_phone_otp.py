"""make phone_otp_hash nullable — phone-less users skip SMS OTP

Revision ID: 0012_nullable_phone_otp
Revises: 0011_remove_device_limits
Create Date: 2025-01-01 00:00:01.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "0012_nullable_phone_otp"
down_revision = "0011_remove_device_limits"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "mysql":
        op.execute(sa.text(
            "ALTER TABLE verification_otps "
            "MODIFY COLUMN phone_otp_hash VARCHAR(64) NULL, "
            "MODIFY COLUMN phone_target VARCHAR(20) NULL"
        ))
    else:
        with op.batch_alter_table("verification_otps") as batch:
            batch.alter_column("phone_otp_hash", existing_type=sa.String(64), nullable=True)
            batch.alter_column("phone_target", existing_type=sa.String(20), nullable=True)


def downgrade() -> None:
    # Backfill NULLs before restoring NOT NULL constraint
    op.execute(sa.text(
        "UPDATE verification_otps SET phone_otp_hash = '' WHERE phone_otp_hash IS NULL"
    ))
    op.execute(sa.text(
        "UPDATE verification_otps SET phone_target = '' WHERE phone_target IS NULL"
    ))
    bind = op.get_bind()
    if bind.dialect.name == "mysql":
        op.execute(sa.text(
            "ALTER TABLE verification_otps "
            "MODIFY COLUMN phone_otp_hash VARCHAR(64) NOT NULL, "
            "MODIFY COLUMN phone_target VARCHAR(20) NOT NULL"
        ))
    else:
        with op.batch_alter_table("verification_otps") as batch:
            batch.alter_column("phone_otp_hash", existing_type=sa.String(64), nullable=False)
            batch.alter_column("phone_target", existing_type=sa.String(20), nullable=False)
