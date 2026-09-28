from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models.approval import ApprovalStatus
from app.models.user import User
from app.schemas.approval import ApprovalDecision, ApprovalOut, ApprovalSubmit
from app.services import approvals, versioning

router = APIRouter(tags=["approvals"])


@router.post("/files/{file_id}/approvals", response_model=ApprovalOut, status_code=201)
def submit_approval(
    file_id: str, body: ApprovalSubmit, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    f = versioning.get_file(db, file_id)
    return approvals.submit(db, f, user, version_number=body.version_number, comment=body.comment)


@router.get("/approvals", response_model=list[ApprovalOut])
def list_approvals(
    scope: str | None = None,
    status: ApprovalStatus | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return approvals.list_for(db, user, scope, status)


@router.get("/approvals/{approval_id}", response_model=ApprovalOut)
def get_approval(approval_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return approvals.get(db, approval_id, user)


@router.post("/approvals/{approval_id}/approve", response_model=ApprovalOut)
def approve(
    approval_id: str,
    body: ApprovalDecision | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    b = body or ApprovalDecision()
    return approvals.decide(db, approval_id, user, approve=True, comment=b.comment, signature=b.signature)


@router.post("/approvals/{approval_id}/reject", response_model=ApprovalOut)
def reject(
    approval_id: str,
    body: ApprovalDecision | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    b = body or ApprovalDecision()
    return approvals.decide(db, approval_id, user, approve=False, comment=b.comment, signature=b.signature)
