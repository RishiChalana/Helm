"""
Regression test: supervisor architecture.
Calls run_agent() for each query and reads the chain from structured log output.
"""
import asyncio
import logging
import sys

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s  %(message)s",
    stream=sys.stdout,
)


async def _setup():
    from app.core.database import AsyncSessionLocal
    from app.models.user import User
    from sqlalchemy import select

    db = AsyncSessionLocal()
    result = await db.execute(select(User).where(User.email == "test@helm.app"))
    user = result.scalar_one()

    from app.agents.tools import set_tool_context
    set_tool_context(user.id, db)
    return db


async def run_query(label: str, message: str, history: list | None = None):
    from app.agents.graph import run_agent

    sep = "=" * 72
    print(f"\n{sep}")
    print(f"TEST : {label}")
    print(f"MSG  : {message}")
    print("-" * 72)

    reply = await run_agent(history or [], message)

    print("REPLY:")
    print(reply)
    print(sep)
    return reply


async def main():
    db = await _setup()
    try:
        # 1. PRIMARY REGRESSION — compound query: must route "both" and chain
        #    query_agent (get_budget_status) → planning_agent (hypothetical)
        await run_query(
            label="Compound: budget pace + dining cut hypothetical  [expected chain: query→planning]",
            message="What's my budget pace this month, and what would happen if I cut dining by 20%?",
        )

        # 2. Pure query: category budget lookup
        await run_query(
            label="Category budget lookup  [expected: query]",
            message="What is my Dining budget status?",
        )

        # 3. Pure query: spending summary with relative date
        await run_query(
            label="Monthly spending summary  [expected: query]",
            message="How much have I spent this month in total?",
        )

        # 4. Pure planning: savings simulation with all params provided
        await run_query(
            label="Savings simulation — all params supplied  [expected: planning]",
            message=(
                "If I save ₹5,000 per month and my goal is ₹1,00,000, "
                "how long will it take? What if I increase savings to ₹8,000/month?"
            ),
        )

        # 5. Pure query: cashflow forecast
        await run_query(
            label="Cashflow forecast  [expected: query]",
            message="What is my projected cashflow over the next 30 days?",
        )

    finally:
        await db.close()


if __name__ == "__main__":
    asyncio.run(main())
