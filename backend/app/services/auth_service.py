from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User
from app.models.audit_log import AuditLog
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse
from jose import JWTError
import hashlib


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def register(req: RegisterRequest, db: AsyncSession) -> TokenResponse:
    result = await db.execute(select(User).where(User.email == req.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    refresh = create_refresh_token(0)  # temp id; replaced after flush
    user = User(
        email=req.email,
        hashed_password=hash_password(req.password),
        full_name=req.full_name,
    )
    db.add(user)
    await db.flush()  # get the real id

    access = create_access_token(user.id)
    refresh = create_refresh_token(user.id)
    user.refresh_token_hash = _hash_token(refresh)

    db.add(AuditLog(user_id=user.id, action="register", actor="user"))
    await db.commit()
    return TokenResponse(access_token=access, refresh_token=refresh)


async def login(req: LoginRequest, db: AsyncSession) -> TokenResponse:
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")

    access = create_access_token(user.id)
    refresh = create_refresh_token(user.id)
    user.refresh_token_hash = _hash_token(refresh)

    db.add(AuditLog(user_id=user.id, action="login", actor="user"))
    await db.commit()
    return TokenResponse(access_token=access, refresh_token=refresh)


async def refresh_tokens(refresh_token: str, db: AsyncSession) -> TokenResponse:
    try:
        payload = decode_token(refresh_token)
        if payload.get("type") != "refresh":
            raise JWTError("wrong type")
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or user.refresh_token_hash != _hash_token(refresh_token):
        # Token reuse detected — invalidate session
        if user:
            user.refresh_token_hash = None
            await db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token reused")

    new_access = create_access_token(user.id)
    new_refresh = create_refresh_token(user.id)
    user.refresh_token_hash = _hash_token(new_refresh)
    await db.commit()
    return TokenResponse(access_token=new_access, refresh_token=new_refresh)
