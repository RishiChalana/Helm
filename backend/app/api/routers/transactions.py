from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.transaction import TransactionCreate, TransactionUpdate, TransactionOut, TransactionFilter
from app.services import transaction_service

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.post("", response_model=TransactionOut, status_code=201)
async def create(
    body: TransactionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await transaction_service.create_transaction(current_user.id, body, db)


@router.get("", response_model=list[TransactionOut])
async def list_all(
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    category: str | None = Query(None),
    merchant: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    filters = TransactionFilter(
        start_date=start_date, end_date=end_date, category=category, merchant=merchant
    )
    return await transaction_service.list_transactions(current_user.id, filters, db)


@router.get("/{tx_id}", response_model=TransactionOut)
async def get_one(
    tx_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await transaction_service.get_transaction(current_user.id, tx_id, db)


@router.patch("/{tx_id}", response_model=TransactionOut)
async def update(
    tx_id: int,
    body: TransactionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await transaction_service.update_transaction(current_user.id, tx_id, body, db)


@router.delete("/{tx_id}", status_code=204)
async def delete(
    tx_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await transaction_service.delete_transaction(current_user.id, tx_id, db)
