"""
Agent tools. All tools call the service layer — the LLM never writes raw SQL.
Each tool receives an injected AsyncSession via tool_context set before graph invocation.
"""
from datetime import date, timedelta
from decimal import Decimal
from typing import Any
from langchain_core.tools import tool
from sqlalchemy.ext.asyncio import AsyncSession

# Thread-local-style context holder populated per-request before running the graph
_tool_context: dict[str, Any] = {}


def set_tool_context(user_id: int, db: AsyncSession) -> None:
    _tool_context["user_id"] = user_id
    _tool_context["db"] = db


def _ctx() -> tuple[int, AsyncSession]:
    return _tool_context["user_id"], _tool_context["db"]


@tool
async def get_transactions(
    start_date: str | None = None,
    end_date: str | None = None,
    category: str | None = None,
    merchant: str | None = None,
) -> list[dict]:
    """
    Retrieve the user's transactions with optional filters.
    Dates must be ISO format (YYYY-MM-DD). Returns a list of transaction dicts.
    """
    from app.services.transaction_service import list_transactions
    from app.schemas.transaction import TransactionFilter

    user_id, db = _ctx()
    filters = TransactionFilter(
        start_date=date.fromisoformat(start_date) if start_date else None,
        end_date=date.fromisoformat(end_date) if end_date else None,
        category=category,
        merchant=merchant,
    )
    txs = await list_transactions(user_id, filters, db)
    return [
        {
            "id": t.id,
            "amount": str(t.amount),
            "type": t.type.value,
            "category": t.category,
            "merchant": t.merchant,
            "date": t.transaction_date.isoformat(),
        }
        for t in txs
    ]


@tool
async def get_budget_status(budget_id: int | None = None) -> list[dict] | dict:
    """
    Return current spend, limit, pace projection, and over-budget flag.
    If budget_id is omitted, returns status for all budgets in the current month.
    """
    from app.services.budget_service import list_budgets, get_budget_status as _get_status

    user_id, db = _ctx()

    if budget_id is not None:
        status = await _get_status(user_id, budget_id, db)
        return _status_to_dict(status)

    budgets = await list_budgets(user_id, db)
    today = date.today()
    results = []
    for b in budgets:
        if b.period_month == today.month and b.period_year == today.year:
            status = await _get_status(user_id, b.id, db)
            results.append(_status_to_dict(status))
    return results


def _status_to_dict(s: Any) -> dict:
    return {
        "budget_id": s.budget.id,
        "category": s.budget.category,
        "limit": str(s.budget.limit_amount),
        "spent": str(s.spent),
        "remaining": str(s.remaining),
        "pace_percent": round(s.pace_percent, 1),
        "projected_spend": str(s.projected_spend),
        "is_over_budget": s.is_over_budget,
    }


@tool
async def simulate_scenario(
    monthly_savings_increase: float,
    current_monthly_savings: float,
    goal_amount: float,
) -> dict:
    """
    Simulate how saving more per month changes the timeline to reach a savings goal.
    All amounts in the user's currency (no conversion). Returns months_current and months_new.
    """
    if current_monthly_savings <= 0 or goal_amount <= 0:
        return {"error": "savings and goal must be positive"}

    new_savings = current_monthly_savings + monthly_savings_increase
    months_current = goal_amount / current_monthly_savings if current_monthly_savings > 0 else None
    months_new = goal_amount / new_savings if new_savings > 0 else None

    return {
        "goal_amount": goal_amount,
        "current_monthly_savings": current_monthly_savings,
        "increased_monthly_savings": new_savings,
        "months_to_goal_current": round(months_current, 1) if months_current else None,
        "months_to_goal_new": round(months_new, 1) if months_new else None,
        "months_saved": (
            round(months_current - months_new, 1)
            if months_current and months_new
            else None
        ),
    }


@tool
async def forecast_cashflow(horizon_days: int = 30) -> dict:
    """
    Project net cashflow over the next horizon_days based on the trailing 30-day average.
    Returns projected_income, projected_expense, and projected_net.
    """
    from app.services.transaction_service import list_transactions
    from app.schemas.transaction import TransactionFilter
    from app.models.transaction import TransactionType

    user_id, db = _ctx()
    end = date.today()
    start = end - timedelta(days=30)

    txs = await list_transactions(user_id, TransactionFilter(start_date=start, end_date=end), db)

    total_income = sum(Decimal(str(t.amount)) for t in txs if t.type == TransactionType.income)
    total_expense = sum(Decimal(str(t.amount)) for t in txs if t.type == TransactionType.expense)

    daily_income = total_income / 30
    daily_expense = total_expense / 30

    projected_income = daily_income * horizon_days
    projected_expense = daily_expense * horizon_days
    projected_net = projected_income - projected_expense

    return {
        "horizon_days": horizon_days,
        "projected_income": str(projected_income.quantize(Decimal("0.01"))),
        "projected_expense": str(projected_expense.quantize(Decimal("0.01"))),
        "projected_net": str(projected_net.quantize(Decimal("0.01"))),
        "based_on_trailing_days": 30,
    }


AGENT_TOOLS = [get_transactions, get_budget_status, simulate_scenario, forecast_cashflow]
