from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.dependencies import CurrentUser, get_current_user
from app.core.database import get_db
from app.core.security import decode_token
from app.schemas.familyhub import LoginRequest, RefreshRequest, TokenResponse
from app.services.auth_service import login, logout, refresh

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


@router.post("/login", response_model=TokenResponse)
def login_endpoint(payload: LoginRequest, db: Session = Depends(get_db)) -> dict[str, str]:
    return login(db, payload.username, payload.password)


@router.post("/refresh", response_model=TokenResponse)
def refresh_endpoint(payload: RefreshRequest, db: Session = Depends(get_db)) -> dict[str, str]:
    return refresh(db, payload.refreshToken)


@router.post("/logout")
def logout_endpoint(
    token: str = Depends(oauth2_scheme),
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, str]:
    payload = decode_token(token)
    return logout(current_user, token_jti=payload.get("jti"))
