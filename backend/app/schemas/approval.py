from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.models.approval import ApprovalStatus


class ApprovalSubmit(BaseModel):
    file_id: str  # path is now flat (POST /approvals) so file_id travels in the body
    version_number: int | None = None  # defaults to the current version
    comment: str = ""


class ApprovalDecisionRequest(BaseModel):
    """Matches POST /approvals/{id}/decision in the mock (one endpoint, not two)."""

    decision: Literal["approved", "rejected"]
    comment: str = ""
    signature: str | None = None  # wallet signature, recorded in the audit event


class ApprovalOut(BaseModel):
    id: str
    file_id: str
    version_number: int
    submitted_by: str  # was requested_by - renamed to match the mock
    reviewer_id: str | None = None
    status: ApprovalStatus
    comment: str  # == request_comment, surfaced under the mock's field name

    # Additive fields the mock doesn't return but the app needs later.
    request_comment: str
    decision_comment: str
    created_at: datetime
    decided_at: datetime | None = None
