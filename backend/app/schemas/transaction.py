"""Pydantic schemas for transaction queries.

Provides response schemas for on-chain transaction metadata:
- ``TransactionDetailsResponse`` — full transaction details including confirmation status, block number, gas used, confirmations, chain ID, timestamp.

Owner: Sriganesh (Blockchain & Audit Engineer).
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class TransactionDetailsResponse(BaseModel):
    """Schema representing full transaction metadata and confirmation status."""

    tx_hash: str = Field(..., description="EVM transaction hash.")
    contract: str | None = Field(
        default=None,
        description="Smart contract name or address involved in transaction.",
    )
    event: str | None = Field(
        default=None, description="Emitted blockchain event name."
    )
    status: str = Field(
        ..., description="Confirmation status: 'confirmed', 'pending', or 'failed'."
    )
    block_number: int | None = Field(
        default=None, description="Block number where transaction was mined."
    )
    gas_used: int | None = Field(
        default=None, description="Gas units consumed by the transaction."
    )
    confirmations: int | None = Field(
        default=None, description="Number of block confirmations."
    )
    chain_id: int | None = Field(default=None, description="EVM network chain ID.")
    timestamp: int | None = Field(
        default=None, description="Unix timestamp of the transaction."
    )
