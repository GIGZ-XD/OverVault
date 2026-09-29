"""Blockchain operational monitoring and metrics service.

Tracks:
- Pending transactions and queue backlog
- Failed / dead-lettered events and error frequency
- Confirmation metrics and latency estimates
- Gas usage analytics

Owner: Sriganesh (Blockchain & Audit Engineer).
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.chain.base import ChainService
from app.models.audit_outbox import AuditOutbox


def get_pending_transactions(db: Session, limit: int = 100) -> list[dict[str, Any]]:
    """Return outbox transactions currently in pending, processing, submitted, or retry states."""
    stmt = (
        select(AuditOutbox)
        .where(AuditOutbox.status.in_(["pending", "processing", "submitted", "retry"]))
        .order_by(AuditOutbox.created_at.asc())
        .limit(limit)
    )
    rows = list(db.scalars(stmt))
    return [
        {
            "id": row.id,
            "event_type": row.event_type,
            "reference_id": row.reference_id,
            "actor": row.actor,
            "status": row.status,
            "retry_count": row.retry_count,
            "tx_hash": row.tx_hash,
            "last_error": row.last_error,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }
        for row in rows
    ]


def get_failed_transactions(db: Session, limit: int = 100) -> list[dict[str, Any]]:
    """Return permanently failed or dead-lettered transactions for diagnostics."""
    stmt = (
        select(AuditOutbox)
        .where(AuditOutbox.status.in_(["failed", "dead_letter"]))
        .order_by(AuditOutbox.updated_at.desc())
        .limit(limit)
    )
    rows = list(db.scalars(stmt))
    return [
        {
            "id": row.id,
            "event_type": row.event_type,
            "reference_id": row.reference_id,
            "actor": row.actor,
            "status": row.status,
            "retry_count": row.retry_count,
            "last_error": row.last_error,
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "processed_at": row.processed_at.isoformat() if row.processed_at else None,
        }
        for row in rows
    ]


def get_confirmation_metrics(db: Session) -> dict[str, Any]:
    """Calculate confirmation volume, success rates, and average latency metrics."""
    total_confirmed = (
        db.scalar(
            select(func.count(AuditOutbox.id)).where(AuditOutbox.status == "confirmed")
        )
        or 0
    )

    total_failed = (
        db.scalar(
            select(func.count(AuditOutbox.id)).where(
                AuditOutbox.status.in_(["failed", "dead_letter"])
            )
        )
        or 0
    )

    total_pending = (
        db.scalar(
            select(func.count(AuditOutbox.id)).where(
                AuditOutbox.status.in_(["pending", "processing", "submitted", "retry"])
            )
        )
        or 0
    )

    total_all = total_confirmed + total_failed + total_pending
    success_rate = (
        (total_confirmed / (total_confirmed + total_failed) * 100.0)
        if (total_confirmed + total_failed) > 0
        else 100.0
    )

    # Calculate average confirmation duration (processed_at - created_at)
    confirmed_rows = list(
        db.scalars(
            select(AuditOutbox)
            .where(
                AuditOutbox.status == "confirmed", AuditOutbox.processed_at.is_not(None)
            )
            .limit(500)
        )
    )

    durations: list[float] = []
    for r in confirmed_rows:
        if r.processed_at and r.created_at:
            dur = (r.processed_at - r.created_at).total_seconds()
            if dur >= 0:
                durations.append(dur)

    avg_confirmation_seconds = (sum(durations) / len(durations)) if durations else 0.0

    return {
        "total_transactions": total_all,
        "confirmed_count": total_confirmed,
        "failed_count": total_failed,
        "pending_count": total_pending,
        "success_rate_percent": round(success_rate, 2),
        "average_confirmation_seconds": round(avg_confirmation_seconds, 2),
    }


def get_gas_metrics(db: Session, chain: ChainService | None = None) -> dict[str, Any]:
    """Return gas estimation benchmarks across OverVault transaction types."""
    # Standard EVM baseline gas consumption profiles
    standard_gas_estimates = {
        "Audit.logAudit": 45000,
        "Integrity.commitHash": 55000,
        "Ownership.registerOwnership": 58000,
        "Permission.grantPermission": 50000,
    }

    confirmed_count = (
        db.scalar(
            select(func.count(AuditOutbox.id)).where(AuditOutbox.status == "confirmed")
        )
        or 0
    )

    estimated_total_gas = confirmed_count * 52000

    return {
        "benchmark_gas_estimates": standard_gas_estimates,
        "confirmed_events_count": confirmed_count,
        "estimated_total_gas_consumed": estimated_total_gas,
        "safety_gas_buffer": 50000,
    }
