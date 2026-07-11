from dataclasses import dataclass

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.cache import cache
from app.core.database import get_db
from app.core.permissions import Permission, effective_permissions
from app.core.security import decode_token
from app.models import FamilyMember, User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


@dataclass(frozen=True)
class CurrentUser:
    user: User
    family_id: int
    role: str
    membership_id: int
    permissions: frozenset[str]

    @property
    def user_id(self) -> int:
        return self.user.id

    @property
    def is_parent(self) -> bool:
        return Permission.MANAGE_FAMILY.value in self.permissions

    def has_permission(self, permission: Permission | str) -> bool:
        value = permission.value if isinstance(permission, Permission) else permission
        return value in self.permissions


def current_user_payload(current_user: CurrentUser) -> dict[str, object]:
    return {
        "userId": current_user.user_id,
        "familyId": current_user.family_id,
        "role": current_user.role,
        "capabilities": sorted(current_user.permissions),
    }


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

    token_version = payload.get("ver")
    if token_version is None or not str(token_version).isdigit() or int(token_version) != int(user.token_version or 0):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session has been revoked")

    family_id = payload.get("family_id")
    if not family_id or not str(family_id).isdigit():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token is missing family context")

    membership = (
        db.query(FamilyMember)
        .filter(
            FamilyMember.user_id == user.id,
            FamilyMember.family_id == int(family_id),
            FamilyMember.is_active.is_(True),
        )
        .first()
    )
    if not membership:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User has no active family membership")

    return CurrentUser(
        user=user,
        family_id=membership.family_id,
        role=membership.role,
        membership_id=membership.id,
        permissions=effective_permissions(membership.role, membership.permissions),
    )


def require_permission(permission: Permission):
    def dependency(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if not current_user.has_permission(permission):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Required permission missing: {permission.value}")
        return current_user

    return dependency
