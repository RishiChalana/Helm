from datetime import date, datetime, timedelta
from decimal import Decimal
from calendar import monthrange
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from fastapi import HTTPException, status
from app.models.budget import Budget
from app.models.transaction import Transaction, TransactionType
from app.schemas.budget import BudgetCreate, BudgetUpdate, BudgetStatus


def _resolve_period_dates(budget: Budget) -> tuple[date, date]:
    """Return (period_start, period_end) for a budget based on its period type."""
    today = date.today()
    if budget.period == "monthly":
        anchor = budget.period_start or date(today.year, today.month, 1)
        days_in_month = monthrange(anchor.year, anchor.month)[1]
        return date(anchor.year, anchor.month, 1), date(anchor.year, anchor.month, days_in_month)
    elif budget.period == "weekly":
        anchor = budget.period_start or (today - timedelta(days=today.weekday()))
        return anchor, anchor + timedelta(days=6)
    else:  # custom
        return budget.period_start, budget.period_end  # type: ignore[return-value]


async def create_budget(user_id: int, req: BudgetCreate, db: AsyncSession) -> Budget:
    existing = await db.execute(
        select(Budget).where(
            Budget.user_id == user_id,
            Budget.category == req.category,
            Budget.period == req.period,
            Budget.period_start == req.period_start,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Budget for this category/period already exists",
        )
    budget = Budget(user_id=user_id, **req.model_dump())
    db.add(budget)
    await db.commit()
    await db.refresh(budget)
    return budget


async def list_budgets(user_id: int, db: AsyncSession) -> list[Budget]:
    result = await db.execute(
        select(Budget)
        .where(Budget.user_id == user_id)
        .order_by(Budget.period_start.desc().nullslast())
    )
    return list(result.scalars().all())


async def get_budget_by_category(user_id: int, category: str, db: AsyncSession) -> Budget:
    """Find the active budget for a category in the current cycle."""
    today = date.today()
    result = await db.execute(
        select(Budget).where(
            Budget.user_id == user_id,
            Budget.category.ilike(category),
        )
    )
    budgets = result.scalars().all()
    # Find the budget whose resolved period contains today
    for b in budgets:
        p_start, p_end = _resolve_period_dates(b)
        if p_start <= today <= p_end:
            return b
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"No active budget found for category '{category}'",
    )


async def get_budget(user_id: int, budget_id: int, db: AsyncSession) -> Budget:
    result = await db.execute(
        select(Budget).where(Budget.id == budget_id, Budget.user_id == user_id)
    )
    b = result.scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Budget not found")
    return b


async def update_budget(
    user_id: int, budget_id: int, req: BudgetUpdate, db: AsyncSession
) -> Budget:
    b = await get_budget(user_id, budget_id, db)
    for field, value in req.model_dump(exclude_none=True).items():
        setattr(b, field, value)
    await db.commit()
    await db.refresh(b)
    return b


async def delete_budget(user_id: int, budget_id: int, db: AsyncSession) -> None:
    b = await get_budget(user_id, budget_id, db)
    await db.delete(b)
    await db.commit()


async def get_budget_status(user_id: int, budget_id: int, db: AsyncSession) -> BudgetStatus:
    from app.schemas.budget import BudgetOut

    b = await get_budget(user_id, budget_id, db)
    period_start, period_end = _resolve_period_dates(b)
    total_days = (period_end - period_start).days + 1

    result = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            and_(
                Transaction.user_id == user_id,
                Transaction.category == b.category,
                Transaction.type == TransactionType.expense,
                Transaction.transaction_date >= period_start,
                Transaction.transaction_date <= period_end,
            )
        )
    )
    spent = Decimal(str(result.scalar()))

    today = date.today()
    if period_start <= today <= period_end:
        elapsed_days = (today - period_start).days + 1
    elif today > period_end:
        elapsed_days = total_days
    else:
        elapsed_days = 0

    daily_rate = spent / elapsed_days if elapsed_days > 0 else Decimal("0")
    projected_spend = daily_rate * total_days
    pace_percent = float((spent / b.limit_amount) * 100) if b.limit_amount > 0 else 0.0

    return BudgetStatus(
        budget=BudgetOut.model_validate(b),
        spent=spent,
        remaining=max(b.limit_amount - spent, Decimal("0")),
        pace_percent=pace_percent,
        projected_spend=projected_spend,
        is_over_budget=spent > b.limit_amount,
    )
