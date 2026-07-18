"""add extended grocery frequency options

Revision ID: 0008_grocery_extended_frequencies
Revises: 0007_scoped_meal_templates
Create Date: 2026-07-13

"""

from alembic import op
from sqlalchemy import text


revision = "0008_grocery_ext_frequencies"
down_revision = "0007_scoped_meal_templates"
branch_labels = None
depends_on = None


EXTENDED_FREQUENCIES = (
    ("semi_annually", 182, 5),
    ("yearly", 365, 6),
)


def upgrade() -> None:
    bind = op.get_bind()
    for name, days, display_order in EXTENDED_FREQUENCIES:
        exists = bind.execute(
            text("SELECT id FROM frequency_types WHERE frequency_name = :name"),
            {"name": name},
        ).scalar()
        if exists is None:
            bind.execute(
                text(
                    """
                    INSERT INTO frequency_types (frequency_name, days_interval, display_order)
                    VALUES (:name, :days, :display_order)
                    """
                ),
                {"name": name, "days": days, "display_order": display_order},
            )


def downgrade() -> None:
    op.execute(
        text(
            """
            DELETE FROM frequency_types
            WHERE frequency_name IN ('semi_annually', 'yearly')
            """
        )
    )
