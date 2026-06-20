from datetime import date
from decimal import Decimal
from typing import Literal
from pydantic import BaseModel, field_validator, model_validator
from typing_extensions import Annotated
from pydantic import PlainSerializer

# Serialize Decimal as float in JSON responses so clients receive numeric values, not strings.
NumericDecimal = Annotated[Decimal, PlainSerializer(lambda v: float(v), return_type=float)]

PeriodType = Literal["monthly", "weekly", "custom"]


class BudgetCreate(BaseModel):
    category: str
    limit_amount: Decimal
    period: PeriodType = "monthly"
    period_start: date | None = None
    period_end: date | None = None

    @field_validator("limit_amount")
    @classmethod
    def positive_limit(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Limit must be positive")
        return v

    @model_validator(mode="after")
    def custom_requires_dates(self) -> "BudgetCreate":
        if self.period == "custom":
            if not self.period_start or not self.period_end:
                raise ValueError("Custom period requires both period_start and period_end")
            if self.period_end <= self.period_start:
                raise ValueError("period_end must be after period_start")
        return self


class BudgetUpdate(BaseModel):
    limit_amount: Decimal | None = None
    period_end: date | None = None


class BudgetOut(BaseModel):
    id: int
    user_id: int
    category: str
    limit_amount: NumericDecimal
    period: PeriodType
    period_start: date | None
    period_end: date | None

    model_config = {"from_attributes": True}


class BudgetStatus(BaseModel):
    budget: BudgetOut
    spent: NumericDecimal
    remaining: NumericDecimal
    pace_percent: float
    projected_spend: NumericDecimal
    is_over_budget: bool
