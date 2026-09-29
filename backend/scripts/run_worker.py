from app.db import SessionLocal
from app.deps import get_chain_service
from app.workers.outbox_worker import process_pending_events

with SessionLocal() as db:
    chain = get_chain_service()

    confirmed, failed = process_pending_events(
        db,
        chain,
    )

    print(
        f"Worker complete: confirmed={confirmed}, failed={failed}"
    )
