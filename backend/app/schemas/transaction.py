from datetime import date
from decimal import Decimal
from pydantic import BaseModel, field_validator
from app.models.transaction import TransactionType


class TransactionCreate(BaseModel):
    amount: Decimal
    type: TransactionType
    category: str
    merchant: str | None = None
    note: str | None = None
    transaction_date: date

    @field_validator("amount")
    @classmethod
    def positive_amount(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Amount must be positive")
        return v

    @field_validator("category")
    @classmethod
    def non_empty_category(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Category cannot be empty")
        return v.strip()


class TransactionUpdate(BaseModel):
    amount: Decimal | None = None
    category: str | None = None
    merchant: str | None = None
    note: str | None = None
    transaction_date: date | None = None


class TransactionOut(BaseModel):
    id: int
    user_id: int
    amount: Decimal
    type: TransactionType
    category: str
    merchant: str | None
    note: str | None
    transaction_date: date

    model_config = {"from_attributes": True}


class TransactionFilter(BaseModel):
    start_date: date | None = None
    end_date: date | None = None
    category: str | None = None
    merchant: str | None = None
    type: TransactionType | None = None
