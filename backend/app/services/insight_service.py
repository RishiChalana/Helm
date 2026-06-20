from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.insight import Insight
from app.models.user import User
from app.schemas.insight import InsightOut
import httpx


async def list_insights(user_id: int, db: AsyncSession) -> list[Insight]:
    result = await db.execute(
        select(Insight)
        .where(Insight.user_id == user_id)
        .order_by(Insight.generated_at.desc())
        .limit(50)
    )
    return list(result.scalars().all())


async def mark_read(user_id: int, insight_id: int, db: AsyncSession) -> Insight:
    from fastapi import HTTPException, status

    result = await db.execute(
        select(Insight).where(Insight.id == insight_id, Insight.user_id == user_id)
    )
    insight = result.scalar_one_or_none()
    if not insight:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Insight not found")
    insight.is_read = True
    await db.commit()
    await db.refresh(insight)
    return insight


async def push_insight_to_device(insight: Insight, user: User) -> None:
    """Send an Expo push notification for the given insight."""
    if not user.expo_push_token:
        return

    from app.core.config import get_settings

    settings = get_settings()
    payload = {
        "to": user.expo_push_token,
        "title": insight.title,
        "body": insight.body,
        "data": {"insight_id": insight.id},
    }
    async with httpx.AsyncClient() as client:
        await client.post(settings.expo_push_token_base_url, json=payload, timeout=10)
