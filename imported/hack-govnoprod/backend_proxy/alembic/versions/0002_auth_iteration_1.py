"""Auth Iteration 1: passwords + refresh tokens

Revision ID: 0002_auth_iter1
Revises: 0001_initial
Create Date: 2025-08-19
"""
from alembic import op
import sqlalchemy as sa


revision = "0002_auth_iter1"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade():
    # users.password_hash
    with op.batch_alter_table("users", schema="ops") as batch_op:
        batch_op.add_column(sa.Column("password_hash", sa.Text(), nullable=True))

    # refresh_token table
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS ops.refresh_token (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES ops.users(id) ON DELETE CASCADE,
            token_hash TEXT NOT NULL UNIQUE,
            issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            expires_at TIMESTAMPTZ NOT NULL,
            revoked BOOLEAN NOT NULL DEFAULT FALSE,
            replaced_by UUID NULL REFERENCES ops.refresh_token(id) ON DELETE SET NULL,
            meta JSONB NOT NULL DEFAULT '{}'::jsonb
        );
        """
    )


def downgrade():
    op.drop_table("refresh_token", schema="ops")
    with op.batch_alter_table("users", schema="ops") as batch_op:
        batch_op.drop_column("password_hash")


