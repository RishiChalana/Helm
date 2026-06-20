from datetime import datetime
from pydantic import BaseModel


class InsightOut(BaseModel):
    id: int
    title: str
    body: str
    category: str
    is_read: bool
    generated_at: datetime

    model_config = {"from_attributes": True}
