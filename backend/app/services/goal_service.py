from decimal import Decimal
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.goal import Goal, GoalStatus
from app.schemas.goal import GoalConfirmRequest


async def create_goal(user_id: int, req: GoalConfirmRequest, db: AsyncSession) -> Goal:
    goal = Goal(
        user_id=user_id,
        description=req.description,
        target_amount=Decimal(str(req.target_amount)),
        monthly_amount=Decimal(str(req.monthly_amount)),
        target_date=req.target_date,
        status=GoalStatus.active,
        reasoning=req.reasoning,
    )
    db.add(goal)
    await db.commit()
    await db.refresh(goal)
    return goal


async def list_goals(user_id: int, db: AsyncSession) -> list[Goal]:
    result = await db.execute(
        select(Goal)
        .where(Goal.user_id == user_id)
        .order_by(Goal.created_at.desc())
    )
    return list(result.scalars().all())
