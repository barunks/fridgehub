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

        # Stats counters
        self._hits = 0
        self._misses = 0
        self._sets = 0
        self._invalidations = 0

        if redis and settings.cache_enabled:
            try:
                self._redis = redis.Redis.from_url(settings.redis_url, decode_responses=True)
                self._redis.ping()
            except Exception:
                self._redis = None

    def get(self, key: str) -> Any | None:
        if self._redis:
            raw = self._redis.get(key)
            if raw:
                self._hits += 1
                return json.loads(raw)
            self._misses += 1
            return None

        item = self._memory.get(key)
        if not item:
            self._misses += 1
            return None

        expires_at, raw = item
        if expires_at is not None and expires_at < time.time():
            self._memory.pop(key, None)
            self._misses += 1
            return None

        self._hits += 1
        return json.loads(raw)

    def set(self, key: str, value: Any, ttl_seconds: int | None = None) -> None:
        ttl = ttl_seconds or settings.cache_default_ttl_seconds
        raw = json.dumps(value, default=str)
        self._sets += 1

        if self._redis:
            self._redis.setex(key, ttl, raw)
            self._redis.sadd(self._tracked_keys_set, key)
            return

        self._memory[key] = (time.time() + ttl if ttl else None, raw)
        self._memory_keys.add(key)

    def delete(self, key: str) -> None:
        self._invalidations += 1
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
                self._invalidations += deleted
                return deleted
            return 0

        keys = [key for key in self._memory_keys if key.startswith(prefix)]
        for key in keys:
            self._memory.pop(key, None)
            self._memory_keys.discard(key)
        self._invalidations += len(keys)
        return len(keys)

    def ping(self) -> bool:
        if self._redis:
            return bool(self._redis.ping())
        return True

    def stats(self) -> dict[str, Any]:
        total = self._hits + self._misses
        key_count = 0
        if self._redis:
            key_count = self._redis.scard(self._tracked_keys_set) or 0
        else:
            key_count = len(self._memory_keys)

        return {
            "backend": "redis" if self._redis else "memory",
            "enabled": settings.cache_enabled,
            "keys": key_count,
            "hits": self._hits,
            "misses": self._misses,
            "sets": self._sets,
            "invalidations": self._invalidations,
            "hitRate": round(self._hits / total * 100, 1) if total > 0 else 0.0,
        }


cache = CacheClient()


def cache_key(entity: str, **parts: Any) -> str:
    ordered = ":".join(f"{key}:{parts[key]}" for key in sorted(parts))
    return f"familyhub:{entity}:{ordered}" if ordered else f"familyhub:{entity}"
