"""
Daily job: run agent in insight mode per user, filter for material insights,
persist, and push notifications. Avoids notification fatigue by only pushing
insights where budget pace deviation > 15% or projected overspend > 20%.
"""
import logging
from datetime import date
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.user import User
from app.models.insight import Insight
from app.models.audit_log import AuditLog
from app.services.budget_service import list_budgets, get_budget_status
from app.services.insight_service import push_insight_to_device

logger = logging.getLogger(__name__)

MATERIALITY_PACE_THRESHOLD = 15.0   # % above expected pace
MATERIALITY_OVERSPEND_THRESHOLD = 20.0  # % over budget limit


async def _generate_insights_for_user(user_id: int) -> None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user or not user.is_active:
            return

        budgets = await list_budgets(user_id, db)
        today = date.today()

        from app.services.budget_service import _resolve_period_dates

        for budget in budgets:
            period_start, period_end = _resolve_period_dates(budget)
            if not (period_start <= today <= period_end):
                continue

            status = await get_budget_status(user_id, budget.id, db)

            total_days = (period_end - period_start).days + 1
            elapsed_days = (today - period_start).days + 1
            expected_pace = (elapsed_days / total_days) * 100
            actual_pace = status.pace_percent
            deviation = actual_pace - expected_pace

            if deviation < MATERIALITY_PACE_THRESHOLD and not status.is_over_budget:
                continue

            # Check overspend threshold
            overspend_pct = float(
                (status.projected_spend - budget.limit_amount) / budget.limit_amount * 100
            )
            if overspend_pct < MATERIALITY_OVERSPEND_THRESHOLD and not status.is_over_budget:
                continue

            title = f"{budget.category} spending is running {deviation:.0f}% ahead of pace"
            body = (
                f"You've spent ₹{status.spent} of your ₹{budget.limit_amount} "
                f"{budget.category} budget. At this rate you'll spend ₹{status.projected_spend:.0f} "
                f"by end of month."
            )

            insight = Insight(
                user_id=user_id,
                title=title,
                body=body,
                category=budget.category,
            )
            db.add(insight)
            db.add(AuditLog(user_id=user_id, action="insight_generated", actor="agent"))
            await db.flush()

            await push_insight_to_device(insight, user)
            insight.is_pushed = True

        await db.commit()


async def run_daily_insights() -> None:
    """Entry point called by APScheduler. Processes all active users."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User.id).where(User.is_active == True))
        user_ids = list(result.scalars().all())

    for user_id in user_ids:
        try:
            await _generate_insights_for_user(user_id)
        except Exception:
            logger.exception("Insight job failed for user %s", user_id)
