from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.approval import ApprovalStatus


class ApprovalSubmit(BaseModel):
    version_number: int | None = None  # defaults to the current version
    comment: str = ""


class ApprovalDecision(BaseModel):
    comment: str = ""
    signature: str | None = None  # wallet signature, recorded in the audit event


class ApprovalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    file_id: str
    version_number: int
    requested_by: str
    reviewer_id: str | None = None
    status: ApprovalStatus
    request_comment: str
    decision_comment: str
    created_at: datetime
    decided_at: datetime | None = None
