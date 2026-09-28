from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.config import settings
from app.chain.real import RealChainService
from app.workers.outbox_worker import process_pending_events


engine = create_engine(
    settings.database_url.replace("+psycopg", "+psycopg2")
)

with Session(engine) as db:
    chain = RealChainService()

    confirmed, failed = process_pending_events(
        db,
        chain,
    )

    print(
        f"Worker complete: confirmed={confirmed}, failed={failed}"
    )
