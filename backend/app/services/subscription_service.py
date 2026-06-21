"""
Subscription / recurring-charge detection.

Heuristic:
  - Group expense transactions by (category, merchant).
  - Within each group, find chains of ≥3 transactions where each consecutive
    pair is 23–38 days apart AND the amount is within ±10% of the chain's
    first transaction.
  - A chain that passes both criteria is flagged as a recurring pattern.

60-day de-duplication gate:
  - RecurringPattern rows store last_flagged_at.
  - run_subscription_check() only generates a new Insight when
    last_flagged_at is NULL or > 60 days ago.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from statistics import median

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog
from app.models.insight import Insight
from app.models.recurring_pattern import RecurringPattern
from app.models.transaction import Transaction, TransactionType

log = logging.getLogger(__name__)

INTERVAL_MIN_DAYS = 23
INTERVAL_MAX_DAYS = 38
AMOUNT_TOLERANCE = 0.10     # ±10 %
MIN_OCCURRENCES = 3
LOOKBACK_DAYS = 120          # 4 months; covers 3 monthly cycles with calendar variance
REFLAG_AFTER_DAYS = 60


@dataclass
class DetectedPattern:
    category: str
    merchant: str            # "" when no merchant info
    avg_amount: Decimal
    occurrence_count: int
    first_seen: date
    last_seen: date
    transaction_ids: list[int]


def _find_chains(
    txs: list[Transaction],
) -> list[list[Transaction]]:
    """
    Given transactions already sorted by date (same category/merchant group),
    return every chain of length ≥ MIN_OCCURRENCES that satisfies the
    interval and amount criteria.
    """
    chains: list[list[Transaction]] = []
    used: set[int] = set()

    for i, seed in enumerate(txs):
        if i in used:
            continue
        chain: list[Transaction] = [seed]
        used.add(i)
        ref_amount = float(seed.amount)

        for j in range(i + 1, len(txs)):
            prev = chain[-1]
            curr = txs[j]
            days_gap = (curr.transaction_date - prev.transaction_date).days

            if days_gap < INTERVAL_MIN_DAYS:
                continue
            if days_gap > INTERVAL_MAX_DAYS:
                # Transactions are sorted; no future tx can be within window of prev
                break

            curr_amount = float(curr.amount)
            if ref_amount > 0 and abs(curr_amount - ref_amount) / ref_amount <= AMOUNT_TOLERANCE:
                chain.append(curr)
                used.add(j)

        if len(chain) >= MIN_OCCURRENCES:
            chains.append(chain)

    return chains


async def detect_recurring_transactions(
    user_id: int,
    db: AsyncSession,
    lookback_days: int = LOOKBACK_DAYS,
) -> list[DetectedPattern]:
    """
    Pure detection — no DB writes.  Safe to call from the agent tool.
    Returns a list of DetectedPattern for all recurring charges found.
    """
    cutoff = date.today() - timedelta(days=lookback_days)

    result = await db.execute(
        select(Transaction).where(
            and_(
                Transaction.user_id == user_id,
                Transaction.type == TransactionType.expense,
                Transaction.transaction_date >= cutoff,
            )
        ).order_by(Transaction.transaction_date)
    )
    txs = list(result.scalars().all())

    # Group by (category_lower, merchant_lower)
    groups: dict[tuple[str, str], list[Transaction]] = {}
    for tx in txs:
        key = (tx.category.lower(), (tx.merchant or "").lower())
        groups.setdefault(key, []).append(tx)

    patterns: list[DetectedPattern] = []
    for (cat_lower, merch_lower), group in groups.items():
        if len(group) < MIN_OCCURRENCES:
            continue
        chains = _find_chains(group)
        for chain in chains:
            amounts = [float(t.amount) for t in chain]
            avg = Decimal(str(round(median(amounts), 2)))
            patterns.append(
                DetectedPattern(
                    category=chain[0].category,
                    merchant=chain[0].merchant or "",
                    avg_amount=avg,
                    occurrence_count=len(chain),
                    first_seen=chain[0].transaction_date,
                    last_seen=chain[-1].transaction_date,
                    transaction_ids=[t.id for t in chain],
                )
            )

    return patterns


async def run_subscription_check(user_id: int, db: AsyncSession) -> list[Insight]:
    """
    Full pipeline: detect patterns → upsert RecurringPattern rows →
    generate Insights for patterns not flagged in the last 60 days.
    Returns the newly created Insight objects.
    """
    patterns = await detect_recurring_transactions(user_id, db)
    now = datetime.now(timezone.utc)
    new_insights: list[Insight] = []

    for p in patterns:
        # Upsert the RecurringPattern tracking row
        rp_result = await db.execute(
            select(RecurringPattern).where(
                and_(
                    RecurringPattern.user_id == user_id,
                    RecurringPattern.category == p.category.lower(),
                    RecurringPattern.merchant == p.merchant.lower(),
                )
            )
        )
        rp = rp_result.scalar_one_or_none()

        if rp is None:
            rp = RecurringPattern(
                user_id=user_id,
                category=p.category.lower(),
                merchant=p.merchant.lower(),
                avg_amount=p.avg_amount,
                occurrence_count=p.occurrence_count,
                first_seen=p.first_seen,
                last_seen=p.last_seen,
            )
            db.add(rp)
            await db.flush()
        else:
            rp.avg_amount = p.avg_amount
            rp.occurrence_count = p.occurrence_count
            rp.last_seen = p.last_seen

        # 60-day gate
        if rp.last_flagged_at is not None:
            days_since = (now - rp.last_flagged_at).days
            if days_since < REFLAG_AFTER_DAYS:
                log.debug(
                    "Skipping recurring pattern %s/%s — flagged %d days ago",
                    p.category, p.merchant, days_since,
                )
                continue

        # Build insight text
        display_name = p.merchant if p.merchant else p.category
        months = p.occurrence_count
        title = f"Recurring charge detected: {display_name}"
        body = (
            f"You've been charged ₹{p.avg_amount:,.0f} for {display_name} "
            f"for the past {months} month{'s' if months != 1 else ''} — "
            f"review if you still need it."
        )

        insight = Insight(
            user_id=user_id,
            title=title,
            body=body,
            category=p.category,
        )
        db.add(insight)
        new_insights.append(insight)

        rp.last_flagged_at = now
        db.add(AuditLog(
            user_id=user_id,
            action="subscription_insight_generated",
            actor="agent",
            payload={
                "category": p.category,
                "merchant": p.merchant,
                "avg_amount": str(p.avg_amount),
                "occurrences": p.occurrence_count,
            },
        ))

    await db.commit()
    return new_insights
