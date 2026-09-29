from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models.approval import Approval, ApprovalStatus
from app.models.user import User
from app.schemas.approval import ApprovalDecisionRequest, ApprovalOut, ApprovalSubmit
from app.services import approvals, versioning

router = APIRouter(tags=["approvals"])


def approval_out(a: Approval) -> ApprovalOut:
    return ApprovalOut(
        id=a.id,
        file_id=a.file_id,
        version_number=a.version_number,
        submitted_by=a.requested_by,
        reviewer_id=a.reviewer_id,
        status=a.status,
        comment=a.request_comment,
        request_comment=a.request_comment,
        decision_comment=a.decision_comment,
        created_at=a.created_at,
        decided_at=a.decided_at,
    )


@router.post("/approvals", response_model=ApprovalOut, status_code=201)
def submit_approval(body: ApprovalSubmit, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    # Path is now flat (POST /approvals, file_id in the body) to match the mock,
    # instead of nested under /files/{file_id}/approvals.
    f = versioning.get_file(db, body.file_id)
    a = approvals.submit(db, f, user, version_number=body.version_number, comment=body.comment)
    return approval_out(a)


@router.get("/approvals", response_model=list[ApprovalOut])
def list_approvals(
    scope: str | None = None,
    status: ApprovalStatus | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return [approval_out(a) for a in approvals.list_for(db, user, scope, status)]


@router.get("/approvals/{approval_id}", response_model=ApprovalOut)
def get_approval(approval_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return approval_out(approvals.get(db, approval_id, user))


@router.post("/approvals/{approval_id}/decision", response_model=ApprovalOut)
def decide_approval(
    approval_id: str, body: ApprovalDecisionRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    # One endpoint with a decision field, matching the mock, instead of separate
    # /approve and /reject endpoints.
    a = approvals.decide(
        db, approval_id, user, approve=(body.decision == "approved"), comment=body.comment, signature=body.signature
    )
    return approval_out(a)
