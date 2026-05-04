"""Initial schema for backend_proxy

Revision ID: 0001_initial
Revises: 
Create Date: 2025-08-19
"""
from alembic import op
import sqlalchemy as sa

revision = '0001_initial'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Run complete SQL schema file
    here = op.get_context().config.get_main_option("here") or "."
    sql_path = f"{here}/db_schema.sql"
    with open(sql_path, 'r', encoding='utf-8') as f:
        sql = f.read()
    # Execute the full SQL script in one call. The schema contains dollar-quoted
    # blocks and other constructs that may include semicolons, so splitting by
    # ';' is unsafe and breaks statements. Executing the whole file lets the
    # DB parse compound statements correctly.
    op.execute(sql)


def downgrade():
    op.drop_table('prompts', schema='ops')
    op.drop_table('projects', schema='ops')
    op.drop_table('users', schema='ops')
    op.drop_table('organization', schema='ops')
    op.execute("DROP SCHEMA IF EXISTS mart CASCADE")
    op.execute("DROP SCHEMA IF EXISTS ops CASCADE")


