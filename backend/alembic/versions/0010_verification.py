"""family and user verification fields

Revision ID: 0010_verification
Revises: 0009_family_signup_invites
Create Date: 2026-07-18

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


revision = "0010_verification"
down_revision = "0009_family_signup_invites"
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
    # --- users: add phone, email_verified, phone_verified, max_families ---
    user_cols = {
        "phone": sa.Column("phone", sa.String(20), nullable=True),
        "email_verified": sa.Column("email_verified", sa.Boolean(), nullable=False, server_default=sa.false()),
        "phone_verified": sa.Column("phone_verified", sa.Boolean(), nullable=False, server_default=sa.false()),
        "max_families": sa.Column("max_families", sa.Integer(), nullable=False, server_default="5"),
    }
    missing_user = [col for name, col in user_cols.items() if not _has_column("users", name)]
    if missing_user:
        with op.batch_alter_table("users") as batch:
            for col in missing_user:
                batch.add_column(col)

    op.create_index("idx_users_phone", "users", ["phone"], unique=True, if_not_exists=True)

    # --- families: add contact_email, contact_phone, pincode, verified flags ---
    family_cols = {
        "contact_email": sa.Column("contact_email", sa.String(255), nullable=True),
        "contact_phone": sa.Column("contact_phone", sa.String(20), nullable=True),
        "pincode": sa.Column("pincode", sa.String(6), nullable=True),
        "email_verified": sa.Column("email_verified", sa.Boolean(), nullable=False, server_default=sa.false()),
        "phone_verified": sa.Column("phone_verified", sa.Boolean(), nullable=False, server_default=sa.false()),
        "slug": sa.Column("slug", sa.String(100), nullable=True),
    }
    missing_family = [col for name, col in family_cols.items() if not _has_column("families", name)]
    if missing_family:
        with op.batch_alter_table("families") as batch:
            for col in missing_family:
                batch.add_column(col)

    op.create_index("idx_families_contact_email", "families", ["contact_email"], unique=True, if_not_exists=True)
    op.create_index("idx_families_contact_phone", "families", ["contact_phone"], unique=True, if_not_exists=True)
    op.create_index("idx_families_slug", "families", ["slug"], unique=True, if_not_exists=True)

    # --- verification_otps table ---
    if not _has_table("verification_otps"):
        op.create_table(
            "verification_otps",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("uuid", sa.String(36), unique=True, nullable=False),
            sa.Column("entity_type", sa.String(10), nullable=False),   # user | family
            sa.Column("entity_id", sa.Integer(), nullable=False),
            sa.Column("email_otp_hash", sa.String(64), nullable=False),
            sa.Column("phone_otp_hash", sa.String(64), nullable=False),
            sa.Column("email_target", sa.String(255), nullable=False),
            sa.Column("phone_target", sa.String(20), nullable=False),
            sa.Column("expires_at", sa.DateTime(), nullable=False),
            sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("is_used", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        )
        op.create_index("idx_otps_entity", "verification_otps", ["entity_type", "entity_id"])
        op.create_index("idx_otps_expires", "verification_otps", ["expires_at"])

    # Pre-verify all existing users and families so live accounts aren't locked out
    op.execute(text("UPDATE users SET email_verified = TRUE, phone_verified = TRUE"))
    op.execute(text("UPDATE families SET email_verified = TRUE, phone_verified = TRUE"))


def downgrade() -> None:
    if _has_table("verification_otps"):
        op.drop_table("verification_otps")

    bind = op.get_bind()
    dialect = bind.dialect.name

    # Drop indexes safely — SQLite doesn't support IF EXISTS on DROP INDEX via Alembic
    for idx, table in [
        ("idx_families_slug", "families"),
        ("idx_families_contact_phone", "families"),
        ("idx_families_contact_email", "families"),
        ("idx_users_phone", "users"),
    ]:
        try:
            op.drop_index(idx, table_name=table)
        except Exception:
            pass

    family_drop = ["contact_email", "contact_phone", "pincode", "email_verified", "phone_verified", "slug"]
    present_family = [c for c in family_drop if _has_column("families", c)]
    if present_family:
        with op.batch_alter_table("families") as batch:
            for col in present_family:
                batch.drop_column(col)

    user_drop = ["phone", "email_verified", "phone_verified", "max_families"]
    present_user = [c for c in user_drop if _has_column("users", c)]
    if present_user:
        with op.batch_alter_table("users") as batch:
            for col in present_user:
                batch.drop_column(col)
