from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.file import DashboardSummary
from app.services import approvals

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
def summary(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return approvals.dashboard_summary(db, user)
