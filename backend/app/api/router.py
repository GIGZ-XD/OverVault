from fastapi import APIRouter
from app.api.routes import health, auth, users, files, versions, permissions, approvals, audit, dashboard

api_router = APIRouter()
for module in (health, auth, users, files, versions, permissions, approvals, audit, dashboard):
    api_router.include_router(module.router)
