import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.router import api_router
from app.auth import dev_auth
from app.config import get_settings
from app.db import SessionLocal, engine
from app.models import Base
from app.services.rbac import DomainError
from app.workers import expiry_job


@asynccontextmanager
async def lifespan(app: FastAPI):
    s = get_settings()
    if s.auto_create_tables:
        Base.metadata.create_all(engine)
    if s.auth_mode == "dev":
        with SessionLocal() as db:
            dev_auth.seed_dev_users(db)
    task = asyncio.create_task(expiry_job.run_forever(s.expiry_job_interval_seconds)) if s.run_expiry_job else None
    yield
    if task:
        task.cancel()


def create_app() -> FastAPI:
    s = get_settings()
    app = FastAPI(title="OverVault API", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=s.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Content-SHA256", "X-File-Version", "Content-Disposition"],
    )

    @app.exception_handler(DomainError)
    async def domain_error_handler(_: Request, exc: DomainError):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.message, "code": exc.code})

    app.include_router(api_router, prefix=s.api_prefix)
    return app


app = create_app()
