from datetime import datetime, timezone
from sqlalchemy import String, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # Stores the current valid refresh token hash; rotation invalidates old tokens
    refresh_token_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    expo_push_token: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    transactions: Mapped[list["Transaction"]] = relationship(back_populates="user", lazy="select")
    budgets: Mapped[list["Budget"]] = relationship(back_populates="user", lazy="select")
    conversations: Mapped[list["Conversation"]] = relationship(back_populates="user", lazy="select")
    insights: Mapped[list["Insight"]] = relationship(back_populates="user", lazy="select")
    recurring_patterns: Mapped[list["RecurringPattern"]] = relationship(back_populates="user", lazy="select")
    goals: Mapped[list["Goal"]] = relationship(back_populates="user", lazy="select")
