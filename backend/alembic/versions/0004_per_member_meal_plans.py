"""per-member meal plans

Revision ID: 0004_per_member_meal_plans
Revises: 0003_membership_permissions
Create Date: 2026-07-12

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "0004_per_member_meal_plans"
down_revision = "0003_membership_permissions"
branch_labels = None
depends_on = None


def _constraints(table_name: str) -> set[str]:
    return {c["name"] for c in inspect(op.get_bind()).get_unique_constraints(table_name)}


def upgrade() -> None:
    with op.batch_alter_table("meal_plans") as batch:
        if "unique_meal" in _constraints("meal_plans"):
            batch.drop_constraint("unique_meal", type_="unique")
        batch.create_unique_constraint(
            "unique_meal_per_member",
            ["family_id", "plan_date", "meal_type", "assigned_to"],
        )


def downgrade() -> None:
    with op.batch_alter_table("meal_plans") as batch:
        if "unique_meal_per_member" in _constraints("meal_plans"):
            batch.drop_constraint("unique_meal_per_member", type_="unique")
        batch.create_unique_constraint(
            "unique_meal",
            ["family_id", "plan_date", "meal_type"],
        )
