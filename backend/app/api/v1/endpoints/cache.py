from fastapi import APIRouter, Depends

from app.core.cache import cache
from app.core.config import settings
from app.core.dependencies import CurrentUser, require_permission
from app.core.permissions import Permission

router = APIRouter()


@router.get("/stats")
def cache_stats(current_user: CurrentUser = Depends(require_permission(Permission.VIEW_CACHE_STATS))) -> dict:
    return cache.stats()


@router.get("/sms-config")
def sms_config(current_user: CurrentUser = Depends(require_permission(Permission.VIEW_CACHE_STATS))) -> dict:
    """Temporary: show masked Twilio config so we can confirm env vars are loaded."""
    sid = settings.twilio_account_sid
    token = settings.twilio_auth_token
    from_num = settings._twilio_from
    return {
        "sms_enabled": settings.twilio_direct_sms_enabled,
        "account_sid": f"{sid[:6]}...{sid[-4:]}" if sid else "unset",
        "auth_token": f"{token[:4]}...{token[-4:]}" if token else "unset",
        "from_number": repr(from_num) if from_num else "unset",
    }
