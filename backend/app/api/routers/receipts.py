from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.statement import StatementUploadResponse
from app.services import receipt_service

router = APIRouter(prefix="/receipts", tags=["receipts"])

_MAX_FILE_BYTES = 10 * 1024 * 1024  # 10 MB
_ALLOWED_MIME = {
    "image/jpeg", "image/jpg", "image/png", "image/webp",
    "image/heic", "image/heif",
}


@router.post("/upload", response_model=StatementUploadResponse)
async def upload_receipt(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    mime = (file.content_type or "").lower().split(";")[0].strip()
    if mime not in _ALLOWED_MIME:
        raise HTTPException(status_code=400, detail="Only image files are accepted (JPEG, PNG, WEBP).")

    file_bytes = await file.read()
    if len(file_bytes) > _MAX_FILE_BYTES:
        raise HTTPException(status_code=400, detail="File too large (max 10 MB).")

    try:
        candidates = await receipt_service.analyze_receipt(
            current_user.id, file_bytes, mime, db
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        err = str(exc)
        if "429" in err or "quota" in err.lower() or "rate" in err.lower():
            raise HTTPException(status_code=429, detail="AI rate limit reached. Please try again shortly.")
        raise HTTPException(status_code=500, detail=f"Receipt extraction failed: {err}")

    return StatementUploadResponse(candidates=candidates)
