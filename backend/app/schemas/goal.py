from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel
from typing import Annotated
from pydantic import PlainSerializer

NumericDecimal = Annotated[Decimal, PlainSerializer(lambda v: float(v), return_type=float)]


class GoalConfirmRequest(BaseModel):
    description: str
    target_amount: float
    monthly_amount: float
    target_date: date | None = None
    reasoning: str | None = None


class GoalOut(BaseModel):
    id: int
    user_id: int
    description: str
    target_amount: NumericDecimal
    monthly_amount: NumericDecimal
    target_date: date | None
    status: str
    reasoning: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
