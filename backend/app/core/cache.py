import json
import time
from typing import Any

from app.core.config import settings

try:
    import redis
except ImportError:  # pragma: no cover - exercised only when dependency is absent
    redis = None


class CacheClient:
    def __init__(self) -> None:
        self._memory: dict[str, tuple[float | None, str]] = {}
        self._memory_keys: set[str] = set()
        self._tracked_keys_set = "familyhub:cache-keys"
        self._redis = None

        if redis and settings.cache_enabled:
            try:
                self._redis = redis.Redis.from_url(settings.redis_url, decode_responses=True)
                self._redis.ping()
            except Exception:
                self._redis = None

    def get(self, key: str) -> Any | None:
        if self._redis:
            raw = self._redis.get(key)
            return json.loads(raw) if raw else None

        item = self._memory.get(key)
        if not item:
            return None

        expires_at, raw = item
        if expires_at is not None and expires_at < time.time():
            self._memory.pop(key, None)
            return None

        return json.loads(raw)

    def set(self, key: str, value: Any, ttl_seconds: int | None = None) -> None:
        ttl = ttl_seconds or settings.cache_default_ttl_seconds
        raw = json.dumps(value, default=str)

        if self._redis:
            self._redis.setex(key, ttl, raw)
            self._redis.sadd(self._tracked_keys_set, key)
            return

        self._memory[key] = (time.time() + ttl if ttl else None, raw)
        self._memory_keys.add(key)

    def delete(self, key: str) -> None:
        if self._redis:
            self._redis.delete(key)
            self._redis.srem(self._tracked_keys_set, key)
            return

        self._memory.pop(key, None)
        self._memory_keys.discard(key)

    def invalidate_prefix(self, prefix: str) -> int:
        if self._redis:
            tracked_keys = self._redis.smembers(self._tracked_keys_set)
            keys = [key for key in tracked_keys if str(key).startswith(prefix)]
            if keys:
                deleted = int(self._redis.delete(*keys))
                self._redis.srem(self._tracked_keys_set, *keys)
                return deleted
            return 0

        keys = [key for key in self._memory_keys if key.startswith(prefix)]
        for key in keys:
            self._memory.pop(key, None)
            self._memory_keys.discard(key)
        return len(keys)

    def ping(self) -> bool:
        if self._redis:
            return bool(self._redis.ping())
        return True


cache = CacheClient()


def cache_key(entity: str, **parts: Any) -> str:
    ordered = ":".join(f"{key}:{parts[key]}" for key in sorted(parts))
    return f"familyhub:{entity}:{ordered}" if ordered else f"familyhub:{entity}"
