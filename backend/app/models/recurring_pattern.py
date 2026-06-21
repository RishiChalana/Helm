from datetime import datetime, timezone, date
from decimal import Decimal
from sqlalchemy import String, Numeric, Date, DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class RecurringPattern(Base):
    """
    Tracks detected subscription/recurring-charge patterns per user.
    One row per (user, category, merchant) key; updated on each detection run.
    last_flagged_at drives the 60-day re-flag gate.
    """

    __tablename__ = "recurring_patterns"
    __table_args__ = (
        UniqueConstraint("user_id", "category", "merchant", name="uq_recurring_user_cat_merchant"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    merchant: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    avg_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    occurrence_count: Mapped[int] = mapped_column(Integer, nullable=False)
    first_seen: Mapped[date] = mapped_column(Date, nullable=False)
    last_seen: Mapped[date] = mapped_column(Date, nullable=False)
    last_flagged_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user: Mapped["User"] = relationship(back_populates="recurring_patterns")
