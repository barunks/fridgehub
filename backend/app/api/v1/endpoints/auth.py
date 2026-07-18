from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.dependencies import CurrentUser, get_current_user, require_permission
from app.core.database import get_db
from app.core.permissions import Permission
from app.core.security import decode_token
from app.schemas.fridgehub import (
    BootstrapSignupRequest,
    ChangePasswordRequest,
    ErrorResponse,
    InviteSignupRequest,
    LoginRequest,
    RefreshRequest,
    SignupInviteCreate,
    SignupInviteOut,
    SignupInvitePreviewOut,
    SignupStatusOut,
    TokenResponse,
)
from app.services.audit_service import write_security_audit_log
from app.services.auth_service import (
    bootstrap_signup,
    change_password,
    create_signup_invite,
    list_signup_invites,
    login,
    logout_by_token,
    preview_signup_invite,
    refresh,
    revoke_signup_invite,
    signup_status,
    signup_with_invite,
)

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
    if settings.require_device_id_on_login and not payload.deviceId:
        raise HTTPException(status_code=400, detail="Device registration is required. Provide deviceId, deviceName, and deviceType.")
    try:
        tokens = login(
            db,
            payload.username,
            payload.password,
            payload.familyId,
            payload.deviceId,
            payload.deviceName,
            payload.deviceType,
            payload.platform,
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


@router.get("/signup/status", response_model=SignupStatusOut)
def signup_status_endpoint(db: Session = Depends(get_db)) -> dict[str, bool]:
    return signup_status(db)


@router.post(
    "/signup/bootstrap",
    response_model=TokenResponse,
    response_model_exclude_none=True,
    responses={409: {"model": ErrorResponse}},
)
def bootstrap_signup_endpoint(
    payload: BootstrapSignupRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> dict[str, str | None]:
    tokens = bootstrap_signup(
        db,
        payload,
        request.headers.get("user-agent"),
        request.client.host if request.client else None,
    )
    _set_refresh_cookie(response, tokens["refreshToken"])
    return _public_token_response(tokens)


@router.get("/invites", response_model=list[SignupInviteOut])
def list_invites_endpoint(
    current_user: CurrentUser = Depends(require_permission(Permission.MANAGE_FAMILY)),
    db: Session = Depends(get_db),
) -> list[dict[str, object]]:
    return list_signup_invites(db, current_user.family_id)


@router.post("/invites", response_model=SignupInviteOut, status_code=201)
def create_invite_endpoint(
    payload: SignupInviteCreate,
    request: Request,
    current_user: CurrentUser = Depends(require_permission(Permission.MANAGE_FAMILY)),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    base_url = str(request.base_url).rstrip("/")
    return create_signup_invite(db, payload, current_user.family_id, current_user.user_id, base_url)


@router.delete("/invites/{invite_id}", status_code=204, responses={404: {"model": ErrorResponse}})
def revoke_invite_endpoint(
    invite_id: int,
    current_user: CurrentUser = Depends(require_permission(Permission.MANAGE_FAMILY)),
    db: Session = Depends(get_db),
) -> None:
    revoke_signup_invite(db, invite_id, current_user.family_id, current_user.user_id)


@router.get("/invites/{invite_token}", response_model=SignupInvitePreviewOut, responses={404: {"model": ErrorResponse}})
def preview_invite_endpoint(invite_token: str, db: Session = Depends(get_db)) -> dict[str, object]:
    return preview_signup_invite(db, invite_token)


@router.post(
    "/signup",
    response_model=TokenResponse,
    response_model_exclude_none=True,
    responses={403: {"model": ErrorResponse}, 404: {"model": ErrorResponse}, 409: {"model": ErrorResponse}},
)
def signup_endpoint(
    payload: InviteSignupRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> dict[str, str | None]:
    tokens = signup_with_invite(
        db,
        payload,
        request.headers.get("user-agent"),
        request.client.host if request.client else None,
    )
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
