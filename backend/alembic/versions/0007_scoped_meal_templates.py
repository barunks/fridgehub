"""scope meal plan and template uniqueness

Revision ID: 0007_scoped_meal_templates
Revises: 0006_max_devices_constraint
Create Date: 2026-07-12

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


revision = "0007_scoped_meal_templates"
down_revision = "0006_max_devices_constraint"
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


def _backfill_scopes() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "mysql":
        op.execute(text("""
            UPDATE meal_plans
            SET meal_plan_scope = IF(assigned_to IS NULL, 'family', CONCAT('user:', assigned_to))
            WHERE meal_plan_scope IS NULL OR meal_plan_scope = ''
        """))
        op.execute(text("""
            UPDATE meal_plan_templates
            SET template_scope = IF(family_id IS NULL, 'global', CONCAT('family:', family_id))
            WHERE template_scope IS NULL OR template_scope = ''
        """))
    else:
        op.execute(text("""
            UPDATE meal_plans
            SET meal_plan_scope = CASE
                WHEN assigned_to IS NULL THEN 'family'
                ELSE 'user:' || CAST(assigned_to AS VARCHAR)
            END
            WHERE meal_plan_scope IS NULL OR meal_plan_scope = ''
        """))
        op.execute(text("""
            UPDATE meal_plan_templates
            SET template_scope = CASE
                WHEN family_id IS NULL THEN 'global'
                ELSE 'family:' || CAST(family_id AS VARCHAR)
            END
            WHERE template_scope IS NULL OR template_scope = ''
        """))


def upgrade() -> None:
    if not _has_column("meal_plans", "meal_plan_scope"):
        with op.batch_alter_table("meal_plans") as batch:
            batch.add_column(sa.Column("meal_plan_scope", sa.String(128), nullable=False, server_default="family"))
            batch.create_index("ix_meal_plans_meal_plan_scope", ["meal_plan_scope"])

    if not _has_column("meal_plan_templates", "template_scope"):
        with op.batch_alter_table("meal_plan_templates") as batch:
            batch.add_column(sa.Column("template_scope", sa.String(128), nullable=False, server_default="global"))
            batch.create_index("ix_meal_plan_templates_template_scope", ["template_scope"])

    _backfill_scopes()

    with op.batch_alter_table("meal_plans") as batch:
        for c in ("unique_meal", "unique_meal_per_member"):
            if _has_constraint("meal_plans", c):
                batch.drop_constraint(c, type_="unique")
        if not _has_constraint("meal_plans", "unique_meal_scope"):
            batch.create_unique_constraint(
                "unique_meal_scope",
                ["family_id", "plan_date", "meal_type", "meal_plan_scope"],
            )

    with op.batch_alter_table("meal_plan_templates") as batch:
        if _has_constraint("meal_plan_templates", "unique_template"):
            batch.drop_constraint("unique_template", type_="unique")
        if not _has_constraint("meal_plan_templates", "unique_template_scope"):
            batch.create_unique_constraint(
                "unique_template_scope",
                ["template_scope", "template_name", "day_of_week", "meal_type"],
            )


def downgrade() -> None:
    with op.batch_alter_table("meal_plans") as batch:
        if _has_constraint("meal_plans", "unique_meal_scope"):
            batch.drop_constraint("unique_meal_scope", type_="unique")
        if not _has_constraint("meal_plans", "unique_meal_per_member"):
            batch.create_unique_constraint(
                "unique_meal_per_member",
                ["family_id", "plan_date", "meal_type", "assigned_to"],
            )
        if _has_column("meal_plans", "meal_plan_scope"):
            batch.drop_index("ix_meal_plans_meal_plan_scope")
            batch.drop_column("meal_plan_scope")

    with op.batch_alter_table("meal_plan_templates") as batch:
        if _has_constraint("meal_plan_templates", "unique_template_scope"):
            batch.drop_constraint("unique_template_scope", type_="unique")
        if not _has_constraint("meal_plan_templates", "unique_template"):
            batch.create_unique_constraint("unique_template", ["template_name", "day_of_week", "meal_type"])
        if _has_column("meal_plan_templates", "template_scope"):
            batch.drop_index("ix_meal_plan_templates_template_scope")
            batch.drop_column("template_scope")
