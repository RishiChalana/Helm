from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.budget import BudgetCreate, BudgetUpdate, BudgetOut, BudgetStatus
from app.services import budget_service

router = APIRouter(prefix="/budgets", tags=["budgets"])


@router.post("", response_model=BudgetOut, status_code=201)
async def create(
    body: BudgetCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await budget_service.create_budget(current_user.id, body, db)


@router.get("", response_model=list[BudgetOut])
async def list_all(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await budget_service.list_budgets(current_user.id, db)


@router.get("/{budget_id}", response_model=BudgetOut)
async def get_one(
    budget_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await budget_service.get_budget(current_user.id, budget_id, db)


@router.get("/{budget_id}/status", response_model=BudgetStatus)
async def status(
    budget_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await budget_service.get_budget_status(current_user.id, budget_id, db)


@router.patch("/{budget_id}", response_model=BudgetOut)
async def update(
    budget_id: int,
    body: BudgetUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await budget_service.update_budget(current_user.id, budget_id, body, db)


@router.delete("/{budget_id}", status_code=204)
async def delete(
    budget_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await budget_service.delete_budget(current_user.id, budget_id, db)
