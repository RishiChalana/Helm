from decimal import Decimal
from pydantic import BaseModel, field_validator


class BudgetCreate(BaseModel):
    category: str
    limit_amount: Decimal
    period_month: int
    period_year: int

    @field_validator("limit_amount")
    @classmethod
    def positive_limit(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Limit must be positive")
        return v

    @field_validator("period_month")
    @classmethod
    def valid_month(cls, v: int) -> int:
        if not 1 <= v <= 12:
            raise ValueError("Month must be 1–12")
        return v


class BudgetUpdate(BaseModel):
    limit_amount: Decimal | None = None


class BudgetOut(BaseModel):
    id: int
    user_id: int
    category: str
    limit_amount: Decimal
    period_month: int
    period_year: int

    model_config = {"from_attributes": True}


class BudgetStatus(BaseModel):
    budget: BudgetOut
    spent: Decimal
    remaining: Decimal
    pace_percent: float
    projected_spend: Decimal
    is_over_budget: bool
