import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from sqlalchemy import text

from app.api.v1.router import api_router
from app.core.cache import cache
from app.core.config import settings
from app.core.database import SessionLocal, engine, init_db
from app.core.logging import setup_logging
from app.core.middleware import RequestContextMiddleware
from app.core.rate_limit import LoginRateLimitMiddleware
from app.core.versioning import API_VERSIONS, APIVersionHeaderMiddleware
from app.utils.seed import seed_demo_data

logger = logging.getLogger("fridgehub.app")


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    setup_logging()
    logger.info("Starting FridgeHub API", extra={"version": settings.app_version, "environment": settings.environment})

    import sys
    if settings.run_migrations_on_startup:
        print("DIAG: calling init_db()", file=sys.stderr, flush=True)
        try:
            init_db()
            print("DIAG: init_db() done", file=sys.stderr, flush=True)
        except Exception as exc:
            print(f"DIAG: init_db() FAILED: {type(exc).__name__}: {exc}", file=sys.stderr, flush=True)
            logger.exception("Startup migrations failed")
            raise
    else:
        logger.info("Skipping startup migrations; expecting migrations to be run before the API starts")

    if settings.seed_on_startup:
        print("DIAG: calling seed_demo_data()", file=sys.stderr, flush=True)
        db = SessionLocal()
        try:
            seed_demo_data(db)
            print("DIAG: seed_demo_data() done", file=sys.stderr, flush=True)
            # Warm cache for seeded family
            if settings.cache_enabled:
                from app.services.family_service import bootstrap_state
                from app.models import Family
                families = db.query(Family).all()
                for family in families:
                    try:
                        bootstrap_state(db, family.id)
                    except Exception:
                        pass
                logger.info("Cache warmed for %d families", len(families))
        except Exception:
            logger.exception("Startup seed/cache-warm failed — continuing anyway")
        finally:
            db.close()

    logger.info("FridgeHub API ready")
    yield

    # Graceful shutdown
    logger.info("Shutting down FridgeHub API")
    engine.dispose()
    logger.info("Database connections closed")


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name, version=settings.app_version, lifespan=lifespan)
    app.add_middleware(APIVersionHeaderMiddleware)
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

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(_request: Request, exc: StarletteHTTPException) -> JSONResponse:
        if isinstance(exc.detail, dict):
            detail = exc.detail
            error_detail = str(detail.get("message") or detail.get("detail") or "Request failed")
            error: dict[str, object] = {
                "detail": error_detail,
                "code": str(detail.get("code") or "http_error"),
            }
            if detail.get("field"):
                error["field"] = str(detail["field"])
            extra = {
                key: value
                for key, value in detail.items()
                if key not in {"message", "detail", "code", "field"}
            }
            return JSONResponse(status_code=exc.status_code, content={"error": error, **extra})

        return JSONResponse(
            status_code=exc.status_code,
            content={"error": {"detail": str(exc.detail), "code": "http_error"}},
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
        errors = []
        for err in exc.errors():
            loc = ".".join(str(part) for part in err.get("loc", []) if part != "body")
            raw_msg = err.get("msg", "Invalid value")
            # Strip pydantic's "Value error, " prefix from custom validators
            msg = raw_msg.removeprefix("Value error, ")
            errors.append({"field": loc, "message": msg})
        summary = "; ".join(f"{e['field']}: {e['message']}" for e in errors) if errors else "Validation failed"
        return JSONResponse(
            status_code=422,
            content={
                "error": {"detail": summary, "code": "validation_error"},
                "validationErrors": errors,
            },
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(_request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled exception: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"error": {"detail": "Internal server error", "code": "internal_error"}},
        )

    @app.get("/api/versions")
    def api_versions() -> dict[str, object]:
        return {"versions": API_VERSIONS, "current": "v1"}

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
