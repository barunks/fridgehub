from datetime import timedelta

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.cache import cache
from app.core.config import settings
from app.core.dependencies import CurrentUser, token_revocation_key
from app.core.security import create_access_token, create_refresh_token, decode_token, verify_password
from app.models import User


def login(db: Session, username: str, password: str) -> dict[str, str]:
    user = db.query(User).filter((User.username == username) | (User.email == username)).first()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    return {
        "accessToken": create_access_token(str(user.id), extra={"username": user.username}),
        "refreshToken": create_refresh_token(str(user.id)),
        "tokenType": "bearer",
    }


def refresh(db: Session, refresh_token: str) -> dict[str, str]:
    try:
        payload = decode_token(refresh_token)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid refresh token") from exc

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Refresh token required")

    jti = payload.get("jti")
    if jti and cache.get(token_revocation_key(str(jti))):
        raise HTTPException(status_code=401, detail="Refresh token has been revoked")

    user_id = payload.get("sub")
    user = db.get(User, int(user_id)) if user_id and str(user_id).isdigit() else None
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    if jti:
        cache.set(
            token_revocation_key(str(jti)),
            True,
            ttl_seconds=settings.refresh_token_expire_days * 24 * 60 * 60,
        )

    return {
        "accessToken": create_access_token(str(user.id), extra={"username": user.username}),
        "refreshToken": create_refresh_token(str(user.id)),
        "tokenType": "bearer",
    }


def logout(current_user: CurrentUser, token_jti: str | None = None) -> dict[str, str]:
    if token_jti:
        cache.set(
            token_revocation_key(token_jti),
            True,
            ttl_seconds=int(timedelta(days=settings.token_revocation_ttl_days).total_seconds()),
        )
    return {"status": "logged_out", "user": current_user.user.username}
