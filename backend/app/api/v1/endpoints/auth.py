from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.dependencies import CurrentUser, get_current_user
from app.core.database import get_db
from app.core.security import decode_token
from app.schemas.familyhub import ChangePasswordRequest, ErrorResponse, LoginRequest, RefreshRequest, TokenResponse
from app.services.auth_service import change_password, login, logout, refresh

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


@router.post("/login", response_model=TokenResponse, responses={401: {"model": ErrorResponse}, 429: {"model": ErrorResponse}})
def login_endpoint(payload: LoginRequest, db: Session = Depends(get_db)) -> dict[str, str]:
    return login(db, payload.username, payload.password)


@router.post("/refresh", response_model=TokenResponse, responses={401: {"model": ErrorResponse}})
def refresh_endpoint(payload: RefreshRequest, db: Session = Depends(get_db)) -> dict[str, str]:
    return refresh(db, payload.refreshToken)


@router.post("/logout")
def logout_endpoint(
    token: str = Depends(oauth2_scheme),
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, str]:
    payload = decode_token(token)
    return logout(current_user, token_jti=payload.get("jti"))


@router.post("/change-password", responses={400: {"model": ErrorResponse}, 401: {"model": ErrorResponse}})
def change_password_endpoint(
    payload: ChangePasswordRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    return change_password(db, current_user, payload.currentPassword, payload.newPassword)
