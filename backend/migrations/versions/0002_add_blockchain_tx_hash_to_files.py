"""add blockchain_tx_hash to files

Revision ID: 0002
Revises: 0001
Create Date: 2026-09-29

Adds the blockchain_tx_hash column to the files table so that MST Testnet
transaction hashes produced during file upload can be persisted alongside file
metadata.  The column is nullable so existing rows are unaffected (no data loss).
"""
from alembic import op
import sqlalchemy as sa


revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('files', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                'blockchain_tx_hash',
                sa.String(length=66),
                nullable=True,
                comment='MST Testnet transaction hash from Integrity contract commit_hash call',
            )
        )


def downgrade() -> None:
    with op.batch_alter_table('files', schema=None) as batch_op:
        batch_op.drop_column('blockchain_tx_hash')
