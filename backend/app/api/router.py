from fastapi import APIRouter

from app.api.routes import (
    approvals,
    audit,
    auth,
    dashboard,
    files,
    health,
    permissions,
    transaction,
    users,
    versions,
)

api_router = APIRouter()
for module in (health, auth, users, files, versions, permissions, approvals, audit, transaction, dashboard):
    api_router.include_router(module.router)
