from fastapi import APIRouter, Depends

from app.core.cache import cache
from app.core.dependencies import CurrentUser, require_parent

router = APIRouter()


@router.get("/stats")
def cache_stats(current_user: CurrentUser = Depends(require_parent)) -> dict:
    return cache.stats()
