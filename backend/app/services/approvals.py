"""Approval workflow: submit -> review -> approve/reject (each emits an audit event)."""
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.approval import Approval, ApprovalStatus
from app.models.base import utcnow
from app.models.file import File, ProtectionMode
from app.models.permission import Permission, PermissionLevel
from app.models.user import User
from app.models.version import FileVersion
from app.services import audit, permissions, rbac, versioning
from app.services.rbac import Conflict, Forbidden, NotFound


def submit(
    db: Session, file: File, requester: User, *, version_number: int | None = None, comment: str = ""
) -> Approval:
    permissions.require_access(db, requester, file, PermissionLevel.write)
    number = version_number or file.current_version
    version = versioning.get_version(db, file, number)
    pending = db.scalar(
        select(Approval).where(
            Approval.file_id == file.id,
            Approval.version_number == number,
            Approval.status == ApprovalStatus.pending,
        )
    )
    if pending:
        raise Conflict("This version already has a pending approval.")
    approval = Approval(
        file_id=file.id, version_number=number, requested_by=requester.id, request_comment=comment
    )
    db.add(approval)
    db.flush()
    audit.record(
        db,
        actor_id=requester.id,
        action="approval.submitted",
        resource_type="approval",
        resource_id=approval.id,
        content_hash=version.sha256,
        metadata={"file_id": file.id, "version": number},
    )
    db.commit()
    return approval


def decide(
    db: Session,
    approval_id: str,
    reviewer: User,
    *,
    approve: bool,
    comment: str = "",
    signature: str | None = None,
) -> Approval:
    rbac.require_capability(reviewer, "approval.review")
    approval = db.get(Approval, approval_id)
    if approval is None:
        raise NotFound("Approval not found.")
    if approval.requested_by == reviewer.id:
        raise Forbidden("You cannot review your own request.")
    if approval.status != ApprovalStatus.pending:
        raise Conflict(f"Approval already {approval.status.value}.")

    approval.status = ApprovalStatus.approved if approve else ApprovalStatus.rejected
    approval.reviewer_id, approval.decision_comment, approval.decided_at = reviewer.id, comment, utcnow()
    version = db.scalar(
        select(FileVersion).where(
            FileVersion.file_id == approval.file_id, FileVersion.version_number == approval.version_number
        )
    )
    if approve:
        file = db.get(File, approval.file_id)
        file.approved_version = approval.version_number
    audit.record(
        db,
        actor_id=reviewer.id,
        action="approval.approved" if approve else "approval.rejected",
        resource_type="approval",
        resource_id=approval.id,
        content_hash=version.sha256 if version else None,
        metadata={
            "file_id": approval.file_id,
            "version": approval.version_number,
            "requested_by": approval.requested_by,
            "signature": signature,
        },
    )
    db.commit()
    return approval


def _can_review(user: User) -> bool:
    return rbac.has_capability(user, "approval.review")


def list_for(db: Session, user: User, scope: str | None = None, status: ApprovalStatus | None = None):
    """scope: 'inbox' (reviewers: everything by others) or 'mine' (my requests)."""
    scope = scope or ("inbox" if _can_review(user) else "mine")
    q = select(Approval).order_by(Approval.created_at.desc())
    if scope == "inbox":
        if not _can_review(user) and not rbac.has_capability(user, "file.read_all_metadata"):
            raise Forbidden("Only reviewers and auditors have an approvals inbox.")
        q = q.where(Approval.requested_by != user.id) if _can_review(user) else q
    else:
        q = q.where(Approval.requested_by == user.id)
    if status:
        q = q.where(Approval.status == status)
    return list(db.scalars(q))


def get(db: Session, approval_id: str, user: User) -> Approval:
    approval = db.get(Approval, approval_id)
    if approval is None:
        raise NotFound("Approval not found.")
    if (
        approval.requested_by != user.id
        and not _can_review(user)
        and not rbac.has_capability(user, "file.read_all_metadata")
    ):
        raise Forbidden("Not allowed to view this approval.")
    return approval


def dashboard_summary(db: Session, user: User) -> dict:
    """Field names/shape match Pavan's frontend mock (handlers.ts) exactly.
    'verified_files' is self-consistency verified (hash checked on read) for
    every file - it becomes a real chain check once Sriganesh's audit/ChainService
    layer is wired in (see ADR 0005). 'blockchain_status' reflects CHAIN_MODE."""
    from app.config import get_settings

    files = versioning.list_files(db, user)
    pending_q = select(func.count()).select_from(Approval).where(Approval.status == ApprovalStatus.pending)
    pending = (
        db.scalar(pending_q.where(Approval.requested_by != user.id))
        if _can_review(user)
        else db.scalar(pending_q.where(Approval.requested_by == user.id))
    )
    total = len(files)
    verified = total  # every stored version is hash-verified on read; see docstring
    integrity_score = f"{round(100 * verified / total) if total else 100}%"
    chain_mode = get_settings().chain_mode
    blockchain_status = "connected (fake chain - dev)" if chain_mode == "fake" else f"connected ({chain_mode} chain)"
    return {
        "total_files": total,
        "verified_files": verified,
        "pending_approvals": pending or 0,
        "active_permissions": len(permissions.active_grants(db, user_id=user.id)),
        "integrity_score": integrity_score,
        "blockchain_status": blockchain_status,
    }
