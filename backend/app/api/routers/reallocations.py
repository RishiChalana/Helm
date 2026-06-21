from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.services.reallocation_service import execute_reallocation, undo_reallocation

router = APIRouter(prefix="/reallocations", tags=["reallocations"])


class ExecuteRequest(BaseModel):
    proposal_id: str


class UndoRequest(BaseModel):
    audit_log_id: int


class ReallocationResult(BaseModel):
    audit_log_id: int
    status: str


@router.post("/execute", response_model=ReallocationResult)
async def execute(
    body: ExecuteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    log = await execute_reallocation(current_user.id, body.proposal_id, db)
    return ReallocationResult(audit_log_id=log.id, status=log.status)


@router.post("/undo", status_code=204)
async def undo(
    body: UndoRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await undo_reallocation(current_user.id, body.audit_log_id, db)
