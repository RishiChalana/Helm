from fastapi import APIRouter, Depends, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse, RefreshRequest, UserOut, PushTokenUpdate
from app.services import auth_service

limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=201)
@limiter.limit("10/minute")
async def register(request: Request, body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    return await auth_service.register(body, db)


@router.post("/login", response_model=TokenResponse)
@limiter.limit("20/minute")
async def login(request: Request, body: LoginRequest, db: AsyncSession = Depends(get_db)):
    return await auth_service.login(body, db)


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("30/minute")
async def refresh(request: Request, body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    return await auth_service.refresh_tokens(body.refresh_token, db)


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/push-token")
async def update_push_token(
    body: PushTokenUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    current_user.expo_push_token = body.expo_push_token
    await db.commit()
    return {"status": "ok"}
