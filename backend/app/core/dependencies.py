from dataclasses import dataclass

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.cache import cache
from app.core.database import get_db
from app.core.security import decode_token
from app.models import FamilyMember, User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

PARENT_ROLES = {"admin", "parent", "mom", "dad", "guardian"}


@dataclass(frozen=True)
class CurrentUser:
    user: User
    family_id: int
    role: str

    @property
    def user_id(self) -> int:
        return self.user.id

    @property
    def is_parent(self) -> bool:
        return self.role.lower() in PARENT_ROLES


def token_revocation_key(jti: str) -> str:
    return f"familyhub:revoked-token:{jti}"


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> CurrentUser:
    try:
        payload = decode_token(token)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    if payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Access token required")

    jti = payload.get("jti")
    if jti and cache.get(token_revocation_key(str(jti))):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has been revoked")

    user_id = payload.get("sub")
    user = db.get(User, int(user_id)) if user_id and str(user_id).isdigit() else None
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

    membership = (
        db.query(FamilyMember)
        .filter(FamilyMember.user_id == user.id)
        .order_by(FamilyMember.id)
        .first()
    )
    if not membership:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User has no family membership")

    return CurrentUser(user=user, family_id=membership.family_id, role=membership.role)


def require_parent(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if not current_user.is_parent:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Parent role required")
    return current_user
