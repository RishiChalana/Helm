from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.statement import (
    StatementConfirmRequest,
    StatementConfirmResponse,
    StatementUploadResponse,
)
from app.services import statement_service

router = APIRouter(prefix="/statements", tags=["statements"])

_MAX_FILE_BYTES = 10 * 1024 * 1024  # 10 MB


@router.post("/upload", response_model=StatementUploadResponse)
async def upload_statement(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    file_bytes = await file.read()
    if len(file_bytes) > _MAX_FILE_BYTES:
        raise HTTPException(status_code=400, detail="File too large (max 10 MB).")

    try:
        candidates = await statement_service.extract_and_analyze(
            current_user.id, file_bytes, db
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        err = str(exc)
        if "429" in err or "rate" in err.lower() or "quota" in err.lower():
            raise HTTPException(
                status_code=429,
                detail="AI provider rate limit reached. Please try again shortly.",
            )
        raise HTTPException(status_code=500, detail=f"Extraction failed: {err}")

    return StatementUploadResponse(candidates=candidates)


@router.post("/confirm", response_model=StatementConfirmResponse, status_code=201)
async def confirm_statement(
    body: StatementConfirmRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not body.approved:
        raise HTTPException(status_code=400, detail="No transactions to import.")

    return await statement_service.create_approved_transactions(
        current_user.id, body.approved, db
    )
