import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

password_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


def hash_password(password: str) -> str:
    return password_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return password_context.verify(password, password_hash)


def _registered_claims(expires: datetime) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    return {
        "iss": settings.jwt_issuer,
        "aud": settings.jwt_audience,
        "iat": now,
        "exp": expires,
        "jti": str(uuid.uuid4()),
    }


def create_access_token(subject: str, expires_delta: timedelta | None = None, extra: dict[str, Any] | None = None) -> str:
    expires = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    payload: dict[str, Any] = {"sub": subject, "type": "access", **_registered_claims(expires)}
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def create_refresh_token(subject: str, extra: dict[str, Any] | None = None) -> str:
    expires = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    payload = {"sub": subject, "type": "refresh", **_registered_claims(expires)}
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def decode_token(token: str, *, verify_exp: bool = True) -> dict[str, Any]:
    try:
        return jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.algorithm],
            audience=settings.jwt_audience,
            issuer=settings.jwt_issuer,
            options={"verify_exp": verify_exp},
        )
    except JWTError as exc:
        raise ValueError("Invalid token") from exc
