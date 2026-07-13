from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.dependencies import CurrentUser, get_current_user
from app.core.database import get_db
from app.core.security import decode_token
from app.schemas.familyhub import ChangePasswordRequest, ErrorResponse, LoginRequest, RefreshRequest, TokenResponse
from app.services.audit_service import write_security_audit_log
from app.services.auth_service import change_password, login, logout_by_token, refresh

router = APIRouter()


def _refresh_cookie_args() -> dict[str, object]:
    args: dict[str, object] = {
        "httponly": True,
        "secure": settings.auth_cookie_secure,
        "samesite": settings.auth_cookie_samesite,
        "path": "/api/v1/auth",
        "max_age": settings.refresh_token_expire_days * 24 * 60 * 60,
    }
    if settings.auth_cookie_domain:
        args["domain"] = settings.auth_cookie_domain
    return args


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    response.set_cookie(settings.auth_refresh_cookie_name, refresh_token, **_refresh_cookie_args())


def _clear_refresh_cookie(response: Response) -> None:
    args = _refresh_cookie_args()
    args["max_age"] = 0
    response.delete_cookie(settings.auth_refresh_cookie_name, path=str(args["path"]), domain=settings.auth_cookie_domain)


def _public_token_response(tokens: dict[str, str]) -> dict[str, str | None]:
    return {
        "accessToken": tokens["accessToken"],
        "refreshToken": tokens["refreshToken"] if settings.auth_expose_refresh_token_in_body else None,
        "tokenType": tokens["tokenType"],
    }


def _token_audit_context(token: str | None) -> dict[str, object | None]:
    if not token:
        return {"user_id": None, "family_id": None, "jti": None}
    try:
        payload = decode_token(token, verify_exp=False)
    except ValueError:
        return {"user_id": None, "family_id": None, "jti": None}

    user_id = payload.get("sub")
    family_id = payload.get("family_id")
    return {
        "user_id": int(user_id) if user_id and str(user_id).isdigit() else None,
        "family_id": int(family_id) if family_id and str(family_id).isdigit() else None,
        "jti": str(payload.get("jti")) if payload.get("jti") else None,
    }


@router.post(
    "/login",
    response_model=TokenResponse,
    response_model_exclude_none=True,
    responses={401: {"model": ErrorResponse}, 429: {"model": ErrorResponse}},
)
def login_endpoint(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> dict[str, str | None]:
    try:
        tokens = login(
            db,
            payload.username,
            payload.password,
            payload.familyId,
            payload.deviceId,
            payload.deviceName,
            request.headers.get("user-agent"),
            request.client.host if request.client else None,
        )
    except HTTPException as exc:
        write_security_audit_log(
            db,
            request,
            action="login_failed",
            entity_id=payload.username,
            changes={"reason": exc.detail, "familyId": payload.familyId},
        )
        db.commit()
        raise
    context = _token_audit_context(tokens["accessToken"])
    write_security_audit_log(
        db,
        request,
        action="login_succeeded",
        user_id=context["user_id"],  # type: ignore[arg-type]
        family_id=context["family_id"],  # type: ignore[arg-type]
        entity_id=context["user_id"],
    )
    db.commit()
    _set_refresh_cookie(response, tokens["refreshToken"])
    return _public_token_response(tokens)


@router.post("/refresh", response_model=TokenResponse, response_model_exclude_none=True, responses={401: {"model": ErrorResponse}})
def refresh_endpoint(
    request: Request,
    response: Response,
    payload: RefreshRequest | None = None,
    db: Session = Depends(get_db),
) -> dict[str, str | None]:
    refresh_token = payload.refreshToken if payload and payload.refreshToken else request.cookies.get(settings.auth_refresh_cookie_name)
    if not refresh_token:
        write_security_audit_log(db, request, action="refresh_failed", changes={"reason": "Refresh token required"})
        db.commit()
        raise HTTPException(status_code=401, detail="Refresh token required")
    old_context = _token_audit_context(refresh_token)
    try:
        tokens = refresh(
            db,
            refresh_token,
            payload.familyId if payload else None,
            request.headers.get("user-agent"),
            request.client.host if request.client else None,
        )
    except HTTPException as exc:
        write_security_audit_log(
            db,
            request,
            action="refresh_failed",
            user_id=old_context["user_id"],  # type: ignore[arg-type]
            family_id=old_context["family_id"],  # type: ignore[arg-type]
            entity_id=old_context["jti"],
            changes={"reason": exc.detail},
        )
        db.commit()
        raise
    new_context = _token_audit_context(tokens["accessToken"])
    write_security_audit_log(
        db,
        request,
        action="refresh_rotated",
        user_id=new_context["user_id"],  # type: ignore[arg-type]
        family_id=new_context["family_id"],  # type: ignore[arg-type]
        entity_id=old_context["jti"],
    )
    db.commit()
    _set_refresh_cookie(response, tokens["refreshToken"])
    return _public_token_response(tokens)


@router.post("/logout")
def logout_endpoint(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    auth_header = request.headers.get("authorization", "")
    bearer_token = auth_header.removeprefix("Bearer ").strip() if auth_header.lower().startswith("bearer ") else None
    refresh_token = request.cookies.get(settings.auth_refresh_cookie_name)
    token = bearer_token or refresh_token
    context = _token_audit_context(token)
    result = logout_by_token(db, token)
    write_security_audit_log(
        db,
        request,
        action="logout",
        user_id=context["user_id"],  # type: ignore[arg-type]
        family_id=context["family_id"],  # type: ignore[arg-type]
        entity_id=context["jti"],
    )
    db.commit()
    _clear_refresh_cookie(response)
    return result


@router.post("/change-password", responses={400: {"model": ErrorResponse}, 401: {"model": ErrorResponse}})
def change_password_endpoint(
    payload: ChangePasswordRequest,
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    try:
        result = change_password(db, current_user, payload.currentPassword, payload.newPassword)
    except HTTPException as exc:
        write_security_audit_log(
            db,
            request,
            action="password_change_failed",
            user_id=current_user.user_id,
            family_id=current_user.family_id,
            entity_id=current_user.user_id,
            changes={"reason": exc.detail},
        )
        db.commit()
        raise
    write_security_audit_log(
        db,
        request,
        action="password_changed",
        user_id=current_user.user_id,
        family_id=current_user.family_id,
        entity_id=current_user.user_id,
    )
    db.commit()
    return result
