import secrets
from functools import lru_cache
from typing import Literal

from pydantic import AliasChoices, Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "FamilyHub API"
    app_version: str = "1.0.0"
    environment: Literal["local", "test", "development", "production"] = "local"
    debug: bool = Field(default=False, validation_alias=AliasChoices("APP_DEBUG", "FAMILYHUB_DEBUG"))

    database_url: str = "sqlite:///./familyhub.db"
    db_pool_size: int = 20
    db_pool_recycle: int = 3600

    redis_url: str = "redis://localhost:6379/0"
    cache_enabled: bool = True
    cache_default_ttl_seconds: int = 300

    secret_key: str = Field(default_factory=lambda: secrets.token_urlsafe(48))
    algorithm: str = "HS256"
    jwt_issuer: str = "familyhub-api"
    jwt_audience: str = "familyhub-web"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    token_revocation_ttl_days: int = 30
    auth_refresh_cookie_name: str = "familyhub_refresh"
    auth_cookie_secure: bool = False
    auth_cookie_samesite: Literal["lax", "strict", "none"] = "lax"
    auth_cookie_domain: str | None = None
    auth_expose_refresh_token_in_body: bool = False

    cors_origins: str = (
        "http://localhost:5173,http://localhost:3000,http://localhost:8080,"
        "http://127.0.0.1:5173,http://127.0.0.1:3000,http://127.0.0.1:8080"
    )
    cors_allow_credentials: bool = True
    seed_on_startup: bool = True
    run_migrations_on_startup: bool = True
    login_rate_limit_per_minute: int = 10
    require_device_id_on_login: bool = False
    allow_memory_cache_in_production: bool = False

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @model_validator(mode="after")
    def validate_production_security(self) -> "Settings":
        if self.environment == "production" and len(self.secret_key) < 32:
            raise ValueError("SECRET_KEY must be set to at least 32 characters in production")
        if self.environment == "production" and not self.auth_cookie_secure:
            raise ValueError("AUTH_COOKIE_SECURE must be enabled in production")
        if self.environment == "production" and self.seed_on_startup:
            raise ValueError("SEED_ON_STARTUP must be disabled in production")
        if self.auth_cookie_samesite == "none" and not self.auth_cookie_secure:
            raise ValueError("AUTH_COOKIE_SAMESITE=none requires AUTH_COOKIE_SECURE=true")
        return self

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
