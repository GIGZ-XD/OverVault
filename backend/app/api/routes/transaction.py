"""Transaction metadata and verification queries.

Exposes endpoint:
- ``GET /transaction/{tx_hash}`` — retrieve blockchain confirmation status and metadata

Owner: Sriganesh (Blockchain & Audit Engineer).
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.chain.base import ChainService
from app.deps import get_chain_service
from app.schemas.transaction import TransactionDetailsResponse

router = APIRouter(prefix="/transaction", tags=["transaction"])

ChainDep = Annotated[ChainService, Depends(get_chain_service)]


@router.get(
    "/{tx_hash}",
    response_model=TransactionDetailsResponse,
    summary="Get transaction metadata and confirmation status",
    description=(
        "Retrieves on-chain details for a transaction hash, including confirmation "
        "status, block number, gas used, confirmations, and timestamp."
    ),
)
def get_transaction_details(
    tx_hash: str,
    chain: ChainDep,
) -> TransactionDetailsResponse:
    """GET /transaction/{tx_hash}

    Queries the active ChainService implementation for transaction status and metadata.
    """
    details = chain.get_transaction_details(tx_hash)
    return TransactionDetailsResponse(**details)
