"""per-member meal plans

Revision ID: 0004_per_member_meal_plans
Revises: 0003_membership_permissions
Create Date: 2026-07-12

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


revision = "0004_per_member_meal_plans"
down_revision = "0003_membership_permissions"
branch_labels = None
depends_on = None


def _has_constraint(table: str, constraint: str) -> bool:
    bind = op.get_bind()
    if bind.dialect.name == "sqlite":
        rows = bind.execute(text(
            "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name=:t AND name=:c"
        ), {"t": table, "c": constraint}).fetchall()
        return len(rows) > 0
    result = bind.execute(text(
        "SELECT COUNT(*) FROM information_schema.table_constraints "
        "WHERE table_name = :t AND constraint_name = :c"
    ), {"t": table, "c": constraint})
    return result.scalar() > 0


def upgrade() -> None:
    with op.batch_alter_table("meal_plans") as batch:
        if _has_constraint("meal_plans", "unique_meal"):
            batch.drop_constraint("unique_meal", type_="unique")
        if not _has_constraint("meal_plans", "unique_meal_per_member"):
            batch.create_unique_constraint(
                "unique_meal_per_member",
                ["family_id", "plan_date", "meal_type", "assigned_to"],
            )


def downgrade() -> None:
    with op.batch_alter_table("meal_plans") as batch:
        if _has_constraint("meal_plans", "unique_meal_per_member"):
            batch.drop_constraint("unique_meal_per_member", type_="unique")
        if not _has_constraint("meal_plans", "unique_meal"):
            batch.create_unique_constraint(
                "unique_meal",
                ["family_id", "plan_date", "meal_type"],
            )
