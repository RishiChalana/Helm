from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class AuditLog(Base):
    """Records every agent-initiated action per the spec's security requirements."""

    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    actor: Mapped[str] = mapped_column(String(50), nullable=False)  # "user" | "agent"
    payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # Reallocation-specific fields
    proposal_id: Mapped[str | None] = mapped_column(String(36), nullable=True, unique=True, index=True)
    status: Mapped[str | None] = mapped_column(String(20), nullable=True)  # proposed/executed/undone
    executed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    undone_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )
