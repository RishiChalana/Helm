from pydantic import BaseModel
from typing import Literal


class TransactionCandidate(BaseModel):
    idx: int
    transaction_date: str  # YYYY-MM-DD
    description: str
    merchant: str | None
    amount: float
    type: Literal["debit", "credit"]
    category: str
    is_duplicate: bool
    duplicate_detail: str | None


class StatementUploadResponse(BaseModel):
    candidates: list[TransactionCandidate]


class ApprovedCandidate(BaseModel):
    transaction_date: str
    merchant: str | None = None
    amount: float
    type: Literal["debit", "credit"]
    category: str


class StatementConfirmRequest(BaseModel):
    approved: list[ApprovedCandidate]


class StatementConfirmResponse(BaseModel):
    created: int
    transaction_ids: list[int]
