from datetime import date
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from fastapi import HTTPException, status
from app.models.transaction import Transaction
from app.schemas.transaction import TransactionCreate, TransactionUpdate, TransactionFilter


async def create_transaction(user_id: int, req: TransactionCreate, db: AsyncSession) -> Transaction:
    tx = Transaction(user_id=user_id, **req.model_dump())
    db.add(tx)
    await db.commit()
    await db.refresh(tx)
    return tx


async def list_transactions(
    user_id: int, filters: TransactionFilter, db: AsyncSession
) -> list[Transaction]:
    conditions = [Transaction.user_id == user_id]
    if filters.start_date:
        conditions.append(Transaction.transaction_date >= filters.start_date)
    if filters.end_date:
        conditions.append(Transaction.transaction_date <= filters.end_date)
    if filters.category:
        conditions.append(Transaction.category == filters.category)
    if filters.merchant:
        conditions.append(Transaction.merchant.ilike(f"%{filters.merchant}%"))
    if filters.type:
        conditions.append(Transaction.type == filters.type)

    result = await db.execute(
        select(Transaction).where(and_(*conditions)).order_by(Transaction.transaction_date.desc())
    )
    return list(result.scalars().all())


async def get_transaction(user_id: int, tx_id: int, db: AsyncSession) -> Transaction:
    result = await db.execute(
        select(Transaction).where(Transaction.id == tx_id, Transaction.user_id == user_id)
    )
    tx = result.scalar_one_or_none()
    if not tx:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
    return tx


async def update_transaction(
    user_id: int, tx_id: int, req: TransactionUpdate, db: AsyncSession
) -> Transaction:
    tx = await get_transaction(user_id, tx_id, db)
    for field, value in req.model_dump(exclude_none=True).items():
        setattr(tx, field, value)
    await db.commit()
    await db.refresh(tx)
    return tx


async def delete_transaction(user_id: int, tx_id: int, db: AsyncSession) -> None:
    tx = await get_transaction(user_id, tx_id, db)
    await db.delete(tx)
    await db.commit()


async def get_spend_by_category(
    user_id: int, start_date: date, end_date: date, db: AsyncSession
) -> dict[str, Decimal]:
    from app.models.transaction import TransactionType
    from sqlalchemy import func

    result = await db.execute(
        select(Transaction.category, func.sum(Transaction.amount))
        .where(
            Transaction.user_id == user_id,
            Transaction.type == TransactionType.expense,
            Transaction.transaction_date >= start_date,
            Transaction.transaction_date <= end_date,
        )
        .group_by(Transaction.category)
    )
    return {row[0]: row[1] for row in result.all()}
