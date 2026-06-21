from datetime import datetime, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog
from app.models.budget import Budget
from app.schemas.budget import BudgetUpdate


async def execute_reallocation(
    user_id: int,
    proposal_id: str,
    db: AsyncSession,
) -> AuditLog:
    result = await db.execute(
        select(AuditLog).where(
            AuditLog.proposal_id == proposal_id,
            AuditLog.user_id == user_id,
            AuditLog.status == "proposed",
        )
    )
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Proposal not found or already actioned",
        )

    payload = log.payload
    from_budget_id: int = payload["from_budget_id"]
    to_budget_id: int | None = payload.get("to_budget_id")
    from_new_limit: float = payload["from_new_limit"]
    to_new_limit: float | None = payload.get("to_new_limit")

    # Apply from-budget change
    from_result = await db.execute(
        select(Budget).where(Budget.id == from_budget_id, Budget.user_id == user_id)
    )
    from_budget = from_result.scalar_one_or_none()
    if not from_budget:
        raise HTTPException(status_code=404, detail="Source budget no longer exists")
    from_budget.limit_amount = Decimal(str(from_new_limit))

    # Apply to-budget change (if it's a budget-to-budget reallocation, not savings)
    if to_budget_id is not None and to_new_limit is not None:
        to_result = await db.execute(
            select(Budget).where(Budget.id == to_budget_id, Budget.user_id == user_id)
        )
        to_budget = to_result.scalar_one_or_none()
        if not to_budget:
            raise HTTPException(status_code=404, detail="Target budget no longer exists")
        to_budget.limit_amount = Decimal(str(to_new_limit))

    log.status = "executed"
    log.executed_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(log)
    return log


async def undo_reallocation(
    user_id: int,
    audit_log_id: int,
    db: AsyncSession,
) -> None:
    result = await db.execute(
        select(AuditLog).where(
            AuditLog.id == audit_log_id,
            AuditLog.user_id == user_id,
            AuditLog.status == "executed",
        )
    )
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Executed reallocation not found or already undone",
        )

    payload = log.payload
    from_budget_id: int = payload["from_budget_id"]
    to_budget_id: int | None = payload.get("to_budget_id")
    from_old_limit: float = payload["from_old_limit"]
    to_old_limit: float | None = payload.get("to_old_limit")

    from_result = await db.execute(
        select(Budget).where(Budget.id == from_budget_id, Budget.user_id == user_id)
    )
    from_budget = from_result.scalar_one_or_none()
    if not from_budget:
        raise HTTPException(status_code=404, detail="Source budget no longer exists")
    from_budget.limit_amount = Decimal(str(from_old_limit))

    if to_budget_id is not None and to_old_limit is not None:
        to_result = await db.execute(
            select(Budget).where(Budget.id == to_budget_id, Budget.user_id == user_id)
        )
        to_budget = to_result.scalar_one_or_none()
        if to_budget:
            to_budget.limit_amount = Decimal(str(to_old_limit))

    log.status = "undone"
    log.undone_at = datetime.now(timezone.utc)

    await db.commit()
