from fastapi import APIRouter, Depends

from app.core.cache import cache
from app.core.dependencies import CurrentUser, require_permission
from app.core.permissions import Permission

router = APIRouter()


@router.get("/stats")
def cache_stats(current_user: CurrentUser = Depends(require_permission(Permission.VIEW_CACHE_STATS))) -> dict:
    return cache.stats()
