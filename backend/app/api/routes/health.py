from fastapi import APIRouter

from app.config import get_settings

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    s = get_settings()
    return {"status": "ok", "env": s.app_env, "auth_mode": s.auth_mode, "chain_mode": s.chain_mode}
