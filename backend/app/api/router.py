from fastapi import APIRouter

from app.api.routes import approvals, auth, dashboard, files, health, nodes, permissions, users, versions

api_router = APIRouter()
for module in (health, auth, users, files, versions, permissions, approvals, dashboard, nodes):
    api_router.include_router(module.router)

# Sriganesh's audit route plugs in here once it exists:
#   from app.api.routes import audit; api_router.include_router(audit.router)
try:
    from app.api.routes import audit  # type: ignore

    api_router.include_router(audit.router)
except ImportError:
    pass
