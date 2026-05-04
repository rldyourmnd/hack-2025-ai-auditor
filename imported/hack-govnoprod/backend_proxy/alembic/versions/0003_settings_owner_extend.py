"""Extend settings owner enum with client_app and device

Revision ID: 0003_settings_owner_extend
Revises: 0002_auth_iter1
Create Date: 2025-08-19
"""
from alembic import op


revision = "0003_settings_owner_extend"
down_revision = "0002_auth_iter1"
branch_labels = None
depends_on = None


def upgrade():
    # Add enum values if not present
    # In Postgres, adding existing value raises error; use a safe guard in a DO block
    op.execute(
        """
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_type t
                JOIN pg_enum e ON t.oid = e.enumtypid
                WHERE t.typname = 'settings_owner_enum' AND e.enumlabel = 'client_app'
            ) THEN
                ALTER TYPE ops.settings_owner_enum ADD VALUE 'client_app';
            END IF;
        END $$;
        """
    )
    op.execute(
        """
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_type t
                JOIN pg_enum e ON t.oid = e.enumtypid
                WHERE t.typname = 'settings_owner_enum' AND e.enumlabel = 'device'
            ) THEN
                ALTER TYPE ops.settings_owner_enum ADD VALUE 'device';
            END IF;
        END $$;
        """
    )


def downgrade():
    # Postgres cannot drop enum values easily; no-op downgrade
    pass


