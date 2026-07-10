import time
from collections import defaultdict, deque
from collections.abc import Awaitable, Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.core.config import settings


class LoginRateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, limit_per_minute: int | None = None) -> None:
        super().__init__(app)
        self.limit = limit_per_minute or settings.login_rate_limit_per_minute
        self.window_seconds = 60
        self.attempts: dict[str, deque[float]] = defaultdict(deque)

    async def dispatch(self, request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        if request.url.path != "/api/v1/auth/login" or request.method != "POST":
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        key = f"{client_ip}:{request.url.path}"
        now = time.monotonic()
        bucket = self.attempts[key]
        while bucket and bucket[0] <= now - self.window_seconds:
            bucket.popleft()
        if len(bucket) >= self.limit:
            return JSONResponse(status_code=429, content={"detail": "Too many login attempts"})
        bucket.append(now)
        return await call_next(request)
