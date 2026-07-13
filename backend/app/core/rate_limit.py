import time
from collections import defaultdict, deque
from collections.abc import Awaitable, Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.core.cache import cache
from app.core.config import settings
from app.core.database import SessionLocal
from app.services.audit_service import write_security_audit_log


_RATE_LIMITED_PATHS = {
    "/api/v1/auth/login",
    "/api/v1/auth/signup",
    "/api/v1/auth/signup/bootstrap",
}


class LoginRateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, limit_per_minute: int | None = None) -> None:
        super().__init__(app)
        self.limit = limit_per_minute or settings.login_rate_limit_per_minute
        self.window_seconds = 60
        self.attempts: dict[str, deque[float]] = defaultdict(deque)

    async def dispatch(self, request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        if request.method != "POST" or request.url.path not in _RATE_LIMITED_PATHS:
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        key = f"{client_ip}:{request.url.path}"
        shared_key = f"familyhub:rate-limit:auth:{key}"
        try:
            if cache.increment_window(shared_key, self.window_seconds) > self.limit:
                self._audit_rate_limit(request)
                return JSONResponse(status_code=429, content={"error": {"detail": "Too many attempts. Try again later.", "code": "rate_limited"}})
            return await call_next(request)
        except Exception:
            pass

        now = time.monotonic()
        bucket = self.attempts[key]
        while bucket and bucket[0] <= now - self.window_seconds:
            bucket.popleft()
        if len(bucket) >= self.limit:
            self._audit_rate_limit(request)
            return JSONResponse(status_code=429, content={"error": {"detail": "Too many attempts. Try again later.", "code": "rate_limited"}})
        bucket.append(now)
        return await call_next(request)

    def _audit_rate_limit(self, request: Request) -> None:
        db = SessionLocal()
        try:
            write_security_audit_log(
                db,
                request,
                action="login_rate_limited",
                entity_id=request.client.host if request.client else "unknown",
                changes={"path": request.url.path},
            )
            db.commit()
        except Exception:
            db.rollback()
        finally:
            db.close()
