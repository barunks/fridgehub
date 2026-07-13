"""scope meal plan and template uniqueness

Revision ID: 0007_scoped_meal_templates
Revises: 0006_max_devices_constraint
Create Date: 2026-07-12

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text


revision = "0007_scoped_meal_templates"
down_revision = "0006_max_devices_constraint"
branch_labels = None
depends_on = None


def _columns(table_name: str) -> set[str]:
    return {column["name"] for column in inspect(op.get_bind()).get_columns(table_name)}


def _constraints(table_name: str) -> set[str]:
    return {constraint["name"] for constraint in inspect(op.get_bind()).get_unique_constraints(table_name)}


def _backfill_scopes() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "mysql":
        op.execute(
            text(
                """
                UPDATE meal_plans
                SET meal_plan_scope = IF(assigned_to IS NULL, 'family', CONCAT('user:', assigned_to))
                WHERE meal_plan_scope IS NULL OR meal_plan_scope = ''
                """
            )
        )
        op.execute(
            text(
                """
                UPDATE meal_plan_templates
                SET template_scope = IF(family_id IS NULL, 'global', CONCAT('family:', family_id))
                WHERE template_scope IS NULL OR template_scope = ''
                """
            )
        )
    else:
        op.execute(
            text(
                """
                UPDATE meal_plans
                SET meal_plan_scope = CASE
                    WHEN assigned_to IS NULL THEN 'family'
                    ELSE 'user:' || assigned_to
                END
                WHERE meal_plan_scope IS NULL OR meal_plan_scope = ''
                """
            )
        )
        op.execute(
            text(
                """
                UPDATE meal_plan_templates
                SET template_scope = CASE
                    WHEN family_id IS NULL THEN 'global'
                    ELSE 'family:' || family_id
                END
                WHERE template_scope IS NULL OR template_scope = ''
                """
            )
        )


def upgrade() -> None:
    meal_cols = _columns("meal_plans")
    if "meal_plan_scope" not in meal_cols:
        with op.batch_alter_table("meal_plans") as batch:
            batch.add_column(sa.Column("meal_plan_scope", sa.String(128), nullable=False, server_default="family"))
            batch.create_index("ix_meal_plans_meal_plan_scope", ["meal_plan_scope"])

    template_cols = _columns("meal_plan_templates")
    if "template_scope" not in template_cols:
        with op.batch_alter_table("meal_plan_templates") as batch:
            batch.add_column(sa.Column("template_scope", sa.String(128), nullable=False, server_default="global"))
            batch.create_index("ix_meal_plan_templates_template_scope", ["template_scope"])

    _backfill_scopes()

    meal_constraints = _constraints("meal_plans")
    with op.batch_alter_table("meal_plans") as batch:
        for constraint_name in ("unique_meal", "unique_meal_per_member"):
            if constraint_name in meal_constraints:
                batch.drop_constraint(constraint_name, type_="unique")
        if "unique_meal_scope" not in meal_constraints:
            batch.create_unique_constraint(
                "unique_meal_scope",
                ["family_id", "plan_date", "meal_type", "meal_plan_scope"],
            )

    template_constraints = _constraints("meal_plan_templates")
    with op.batch_alter_table("meal_plan_templates") as batch:
        if "unique_template" in template_constraints:
            batch.drop_constraint("unique_template", type_="unique")
        if "unique_template_scope" not in template_constraints:
            batch.create_unique_constraint(
                "unique_template_scope",
                ["template_scope", "template_name", "day_of_week", "meal_type"],
            )


def downgrade() -> None:
    meal_constraints = _constraints("meal_plans")
    with op.batch_alter_table("meal_plans") as batch:
        if "unique_meal_scope" in meal_constraints:
            batch.drop_constraint("unique_meal_scope", type_="unique")
        if "unique_meal_per_member" not in meal_constraints:
            batch.create_unique_constraint(
                "unique_meal_per_member",
                ["family_id", "plan_date", "meal_type", "assigned_to"],
            )
        if "meal_plan_scope" in _columns("meal_plans"):
            batch.drop_index("ix_meal_plans_meal_plan_scope")
            batch.drop_column("meal_plan_scope")

    template_constraints = _constraints("meal_plan_templates")
    with op.batch_alter_table("meal_plan_templates") as batch:
        if "unique_template_scope" in template_constraints:
            batch.drop_constraint("unique_template_scope", type_="unique")
        if "unique_template" not in template_constraints:
            batch.create_unique_constraint("unique_template", ["template_name", "day_of_week", "meal_type"])
        if "template_scope" in _columns("meal_plan_templates"):
            batch.drop_index("ix_meal_plan_templates_template_scope")
            batch.drop_column("template_scope")
