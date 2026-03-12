"""Add chat sessions and messages

Revision ID: 50c0fa74a505
Revises: 001_full_schema
Create Date: 2026-03-12 21:27:28.284801

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '50c0fa74a505'
down_revision: Union[str, Sequence[str], None] = '001_full_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema.

    Note: For SQLite compatibility, we skip ALTER COLUMN operations.
    Column types are already correct in the models and the schema
    is managed by SQLAlchemy. This migration is a no-op for SQLite
    but preserves the migration history.
    """
    pass


def downgrade() -> None:
    """Downgrade schema.

    Note: For SQLite compatibility, we skip ALTER COLUMN operations.
    This is a no-op migration.
    """
    pass
