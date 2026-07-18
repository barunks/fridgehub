"""add country/address/postal_code to families

Revision ID: 0013_family_location_fields
Revises: 0012_nullable_phone_otp
Create Date: 2026-07-18
"""

from alembic import op
import sqlalchemy as sa

revision = "0013_family_location_fields"
down_revision = "0012_nullable_phone_otp"
branch_labels = None
depends_on = None


def _has_column(table: str, column: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return any(c["name"] == column for c in insp.get_columns(table))


def upgrade() -> None:
    if not _has_column("families", "country"):
        op.add_column("families", sa.Column("country", sa.String(100), nullable=False, server_default="Singapore"))
    if not _has_column("families", "address"):
        op.add_column("families", sa.Column("address", sa.String(500), nullable=True))
    if not _has_column("families", "postal_code"):
        op.add_column("families", sa.Column("postal_code", sa.String(20), nullable=True))


def downgrade() -> None:
    if _has_column("families", "postal_code"):
        op.drop_column("families", "postal_code")
    if _has_column("families", "address"):
        op.drop_column("families", "address")
    if _has_column("families", "country"):
        op.drop_column("families", "country")
