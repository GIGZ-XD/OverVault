import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, enum_col, new_id, utcnow


class ProtectionMode(str, enum.Enum):
    none = "none"
    append_only = "append_only"  # new versions ok; no rollback, no delete
    read_only = "read_only"  # frozen: nothing changes


class File(Base):
    __tablename__ = "files"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(120), default="application/octet-stream")
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    protection_mode: Mapped[ProtectionMode] = mapped_column(
        enum_col(ProtectionMode), default=ProtectionMode.none
    )
    current_version: Mapped[int] = mapped_column(Integer, default=0)
    approved_version: Mapped[int | None] = mapped_column(Integer, nullable=True)
    blockchain_tx_hash: Mapped[str | None] = mapped_column(String(66), nullable=True, default=None)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    versions = relationship("FileVersion", back_populates="file", order_by="FileVersion.version_number")
