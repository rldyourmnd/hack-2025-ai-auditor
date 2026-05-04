from __future__ import annotations
from alembic import op
import sqlalchemy as sa


revision = "0004_entropy_tables"
down_revision = "0003_settings_owner_extend"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "entropy_upload",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("repo_id", sa.Text(), nullable=True),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("received_at", sa.DateTime(timezone=False), nullable=False),
        sa.Column("last_update_at", sa.DateTime(timezone=False), nullable=False),
        sa.Column("manifest_json", sa.JSON(), nullable=True),
        sa.Column("error_code", sa.Text(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("error_details", sa.JSON(), nullable=True),
        sa.Column("archive_size_bytes", sa.BigInteger(), nullable=True),
    )

    op.create_table(
        "entropy_progress",
        sa.Column("upload_id", sa.String(), primary_key=True),
        sa.Column("profiles_read_lines", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("profiles_bad_lines", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("profiles_bytes_gz", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("findings_read_lines", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("findings_bad_lines", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("findings_bytes_gz", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("groups_json", sa.JSON(), nullable=True),
        sa.Column("file_index_count", sa.Integer(), nullable=True),
    )

    op.create_table(
        "entropy_result",
        sa.Column("upload_id", sa.String(), primary_key=True),
        sa.Column("result_json", sa.JSON(), nullable=False),
        sa.Column("weights_version", sa.Text(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("entropy_result")
    op.drop_table("entropy_progress")
    op.drop_table("entropy_upload")


