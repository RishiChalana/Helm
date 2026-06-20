from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.insight import InsightOut
from app.services import insight_service

router = APIRouter(prefix="/insights", tags=["insights"])


@router.get("", response_model=list[InsightOut])
async def list_insights(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await insight_service.list_insights(current_user.id, db)


@router.patch("/{insight_id}/read", response_model=InsightOut)
async def mark_read(
    insight_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await insight_service.mark_read(current_user.id, insight_id, db)
