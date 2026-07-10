"""API versioning utilities.

Supports mounting multiple API version routers side-by-side and adds
response headers indicating the active API version and deprecation status.
"""

from fastapi import APIRouter, Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

# Registry of mounted API versions and their deprecation status
API_VERSIONS: dict[str, dict] = {
    "v1": {"status": "stable", "deprecated": False, "sunset": None},
}


class APIVersionHeaderMiddleware(BaseHTTPMiddleware):
    """Adds X-API-Version and Sunset headers to responses."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        response = await call_next(request)
        path = request.url.path
        for version, meta in API_VERSIONS.items():
            if f"/api/{version}" in path:
                response.headers["X-API-Version"] = version
                if meta["deprecated"]:
                    response.headers["Deprecation"] = "true"
                    if meta.get("sunset"):
                        response.headers["Sunset"] = meta["sunset"]
                break
        return response


def register_version(version: str, *, deprecated: bool = False, sunset: str | None = None) -> None:
    """Register a new API version in the global registry."""
    API_VERSIONS[version] = {"status": "deprecated" if deprecated else "stable", "deprecated": deprecated, "sunset": sunset}


def create_versioned_router(version: str) -> APIRouter:
    """Create a router for a specific API version prefix."""
    return APIRouter(prefix=f"/api/{version}")
