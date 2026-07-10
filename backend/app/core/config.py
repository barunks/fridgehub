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
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    token_revocation_ttl_days: int = 30

    cors_origins: str = "http://localhost:5173,http://localhost:3000,http://localhost:8080"
    cors_allow_credentials: bool = False
    seed_on_startup: bool = True
    login_rate_limit_per_minute: int = 10

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @model_validator(mode="after")
    def validate_production_security(self) -> "Settings":
        if self.environment == "production" and len(self.secret_key) < 32:
            raise ValueError("SECRET_KEY must be set to at least 32 characters in production")
        return self

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
