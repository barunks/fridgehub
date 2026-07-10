from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.v1.router import api_router
from app.core.cache import cache
from app.core.config import settings
from app.core.database import SessionLocal, engine, init_db
from app.core.middleware import RequestContextMiddleware
from app.core.rate_limit import LoginRateLimitMiddleware
from app.utils.seed import seed_demo_data


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    init_db()
    if settings.seed_on_startup:
        db = SessionLocal()
        try:
            seed_demo_data(db)
        finally:
            db.close()
    yield


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name, version=settings.app_version, lifespan=lifespan)
    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(LoginRateLimitMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=settings.cors_allow_credentials,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    )
    app.include_router(api_router, prefix="/api/v1")

    @app.get("/health")
    def health() -> dict[str, object]:
        db_ok = False
        try:
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
            db_ok = True
        except Exception:
            db_ok = False

        cache_ok = False
        try:
            cache_ok = cache.ping()
        except Exception:
            cache_ok = False

        status = "ok" if db_ok and cache_ok else "degraded"
        return {
            "status": status,
            "app": settings.app_name,
            "version": settings.app_version,
            "dependencies": {"database": db_ok, "cache": cache_ok},
        }

    return app


app = create_app()
