"""auth and membership hardening

Revision ID: 0002_auth_membership_cache_fixes
Revises: 0001_initial_schema
Create Date: 2026-07-11
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "0002_auth_membership_cache_fixes"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None


def _columns(table_name: str) -> set[str]:
    return {column["name"] for column in inspect(op.get_bind()).get_columns(table_name)}


def _unique_columns(table_name: str, constraint_name: str) -> list[str]:
    for constraint in inspect(op.get_bind()).get_unique_constraints(table_name):
        if constraint.get("name") == constraint_name:
            return list(constraint.get("column_names") or [])
    return []


def upgrade() -> None:
    if "token_version" not in _columns("users"):
        with op.batch_alter_table("users") as batch:
            batch.add_column(sa.Column("token_version", sa.Integer(), nullable=False, server_default="0"))

    if "is_active" not in _columns("family_members"):
        with op.batch_alter_table("family_members") as batch:
            batch.add_column(sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()))

    if _unique_columns("meal_plans", "unique_meal") == ["family_id", "plan_date", "meal_type", "assigned_to"]:
        with op.batch_alter_table("meal_plans") as batch:
            batch.drop_constraint("unique_meal", type_="unique")
            batch.create_unique_constraint("unique_meal", ["family_id", "plan_date", "meal_type"])


def downgrade() -> None:
    if _unique_columns("meal_plans", "unique_meal") == ["family_id", "plan_date", "meal_type"]:
        with op.batch_alter_table("meal_plans") as batch:
            batch.drop_constraint("unique_meal", type_="unique")
            batch.create_unique_constraint("unique_meal", ["family_id", "plan_date", "meal_type", "assigned_to"])

    if "is_active" in _columns("family_members"):
        with op.batch_alter_table("family_members") as batch:
            batch.drop_column("is_active")

    if "token_version" in _columns("users"):
        with op.batch_alter_table("users") as batch:
            batch.drop_column("token_version")
