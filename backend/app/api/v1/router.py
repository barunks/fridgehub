from fastapi import APIRouter

from app.api.v1.endpoints import assistant, auth, cache, devices, family, grocery, meal_plan, notifications, tasks, verification

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(verification.router, prefix="/auth", tags=["auth"])
api_router.include_router(devices.router, prefix="/auth/devices", tags=["devices"])
api_router.include_router(family.router, prefix="/family", tags=["family"])
api_router.include_router(grocery.router, prefix="/grocery", tags=["grocery"])
api_router.include_router(tasks.router, prefix="/tasks", tags=["tasks"])
api_router.include_router(meal_plan.router, prefix="/meal-plan", tags=["meal-plan"])
api_router.include_router(assistant.router, prefix="/assistant", tags=["assistant"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(cache.router, prefix="/cache", tags=["cache"])
