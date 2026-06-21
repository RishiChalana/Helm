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
async def get_budget_status(
    category: str | None = None,
    budget_id: int | None = None,
) -> list[dict] | dict:
    """
    Return current spend, limit, pace projection, and over-budget flag for a budget.
    Prefer passing category (e.g. "Food") — budget_id is an optional override.
    If both are omitted, returns status for ALL budgets in the current month.
    """
    from app.services.budget_service import (
        list_budgets,
        get_budget_status as _get_status,
        get_budget_by_category,
    )

    user_id, db = _ctx()

    if category is not None:
        b = await get_budget_by_category(user_id, category, db)
        s = await _get_status(user_id, b.id, db)
        return _status_to_dict(s)

    if budget_id is not None:
        s = await _get_status(user_id, budget_id, db)
        return _status_to_dict(s)

    budgets = await list_budgets(user_id, db)
    today = date.today()
    results = []
    for b in budgets:
        if b.period_month == today.month and b.period_year == today.year:
            s = await _get_status(user_id, b.id, db)
            results.append(_status_to_dict(s))
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

    total_income = sum(
        (Decimal(str(t.amount)) for t in txs if t.type == TransactionType.income),
        Decimal(0),
    )
    total_expense = sum(
        (Decimal(str(t.amount)) for t in txs if t.type == TransactionType.expense),
        Decimal(0),
    )

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


@tool
async def get_spending_summary(
    start_date: str,
    end_date: str,
    category: str | None = None,
) -> dict:
    """
    Return total expense, total income, net, and a breakdown by category for a date range.
    Use this for questions like 'how much did I spend', 'what did I spend on X'.
    Dates must be ISO format (YYYY-MM-DD).
    Use get_transactions only when individual line items are needed.
    """
    from app.services.transaction_service import get_spending_summary as _summary

    user_id, db = _ctx()
    return await _summary(
        user_id,
        date.fromisoformat(start_date),
        date.fromisoformat(end_date),
        category,
        db,
    )


@tool
async def propose_reallocation(
    from_category: str,
    to_category: str,
    amount: float | None = None,
    percentage: float | None = None,
) -> str:
    """
    Propose redirecting budget from one underspending category to another.
    Provide either amount (absolute ₹ value) or percentage (e.g. 20 = 20% of the source budget).
    to_category can be an existing budget category name or "savings".
    This only proposes — the user must confirm via the app before any change is applied.
    """
    import json
    import uuid as _uuid
    from app.models.audit_log import AuditLog
    from app.services.budget_service import get_budget_by_category, get_budget_status as _get_status

    user_id, db = _ctx()

    try:
        from_budget = await get_budget_by_category(user_id, from_category, db)
    except Exception as exc:
        return f"Could not find an active budget for '{from_category}': {exc}"

    from_old_limit = float(from_budget.limit_amount)

    if percentage is not None and amount is None:
        amount = round(from_old_limit * percentage / 100, 2)

    if amount is None or amount <= 0:
        return "Provide either a positive amount or a percentage to redirect."

    from_new_limit = round(from_old_limit - amount, 2)
    if from_new_limit < 0:
        return (
            f"Cannot reduce {from_category} by ₹{amount:,.0f} — "
            f"its limit is only ₹{from_old_limit:,.0f}."
        )

    to_budget = None
    to_old_limit: float | None = None
    to_new_limit: float | None = None
    is_savings = to_category.lower() in ("savings", "saving")

    if not is_savings:
        try:
            to_budget = await get_budget_by_category(user_id, to_category, db)
            to_old_limit = float(to_budget.limit_amount)
            to_new_limit = round(to_old_limit + amount, 2)
        except Exception as exc:
            return f"Could not find an active budget for '{to_category}': {exc}"

    # Capture remaining spend so the reply is informative
    try:
        from_status = await _get_status(user_id, from_budget.id, db)
        remaining_note = f" (₹{float(from_status.remaining):,.0f} unspent this period)"
    except Exception:
        remaining_note = ""

    proposal_id = str(_uuid.uuid4())
    payload = {
        "from_category": from_category,
        "to_category": to_category,
        "amount": amount,
        "from_budget_id": from_budget.id,
        "to_budget_id": to_budget.id if to_budget else None,
        "from_old_limit": from_old_limit,
        "to_old_limit": to_old_limit,
        "from_new_limit": from_new_limit,
        "to_new_limit": to_new_limit,
    }

    entry = AuditLog(
        user_id=user_id,
        action="reallocation",
        actor="agent",
        payload=payload,
        proposal_id=proposal_id,
        status="proposed",
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)

    # Surface the proposal to the router via tool context so it can be
    # included as a structured field in AgentChatResponse (never LLM-callable).
    _tool_context["pending_proposal"] = {
        "proposal_id": proposal_id,
        "audit_log_id": entry.id,
        "from_category": from_category,
        "to_category": to_category,
        "amount": amount,
        "from_old_limit": from_old_limit,
        "from_new_limit": from_new_limit,
        "to_old_limit": to_old_limit,
        "to_new_limit": to_new_limit,
    }

    if is_savings:
        description = (
            f"Redirect ₹{amount:,.0f}/month from {from_category} "
            f"(₹{from_old_limit:,.0f} → ₹{from_new_limit:,.0f}) towards savings"
        )
    else:
        description = (
            f"Redirect ₹{amount:,.0f}/month from {from_category} "
            f"(₹{from_old_limit:,.0f} → ₹{from_new_limit:,.0f}) "
            f"to {to_category} (₹{to_old_limit:,.0f} → ₹{to_new_limit:,.0f})"
        )
    _tool_context["pending_proposal"]["description"] = description

    return (
        f"Proposal ready: {description}.{remaining_note} "
        f"The user will see a Confirm button in the app. "
        f"Tell them what will change and ask them to confirm."
    )


QUERY_TOOLS = [get_transactions, get_budget_status, get_spending_summary, forecast_cashflow]
PLANNING_TOOLS = [simulate_scenario, propose_reallocation]
# Kept for any external references; equals the union of both groups.
AGENT_TOOLS = QUERY_TOOLS + PLANNING_TOOLS
