from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.goal import GoalConfirmRequest, GoalOut
from app.services.goal_service import create_goal, list_goals

router = APIRouter(prefix="/goals", tags=["goals"])


@router.post("/confirm", response_model=GoalOut, status_code=201)
async def confirm_goal(
    body: GoalConfirmRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await create_goal(current_user.id, body, db)


@router.get("", response_model=list[GoalOut])
async def get_goals(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await list_goals(current_user.id, db)
