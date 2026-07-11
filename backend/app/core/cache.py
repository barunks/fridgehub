import json
import logging
import time
from threading import RLock
from typing import Any

from app.core.config import settings

try:
    import redis
except ImportError:  # pragma: no cover - exercised only when dependency is absent
    redis = None


logger = logging.getLogger("familyhub.cache")


class CacheClient:
    def __init__(self) -> None:
        self._memory: dict[str, tuple[float | None, str]] = {}
        self._memory_counters: dict[str, tuple[float, int]] = {}
        self._memory_versions: dict[str, int] = {}
        self._lock = RLock()
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
                if settings.environment == "production" and not settings.allow_memory_cache_in_production:
                    raise RuntimeError("Redis cache is required in production")
                logger.warning("Redis unavailable; using in-memory cache fallback")

    def _prune_memory(self) -> None:
        now = time.time()
        expired_keys = [key for key, (expires_at, _raw) in self._memory.items() if expires_at is not None and expires_at < now]
        for key in expired_keys:
            self._memory.pop(key, None)
        expired_counters = [key for key, (expires_at, _count) in self._memory_counters.items() if expires_at < now]
        for key in expired_counters:
            self._memory_counters.pop(key, None)

    def get(self, key: str) -> Any | None:
        if self._redis:
            raw = self._redis.get(key)
            if raw:
                self._hits += 1
                return json.loads(raw)
            self._misses += 1
            return None

        with self._lock:
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
            return

        with self._lock:
            self._memory[key] = (time.time() + ttl if ttl else None, raw)

    def delete(self, key: str) -> None:
        self._invalidations += 1
        if self._redis:
            self._redis.delete(key)
            return

        with self._lock:
            self._memory.pop(key, None)

    def invalidate_prefix(self, prefix: str) -> int:
        if self._redis:
            deleted = 0
            batch: list[str] = []
            for key in self._redis.scan_iter(match=f"{prefix}*", count=500):
                batch.append(key)
                if len(batch) >= 500:
                    deleted += int(self._redis.delete(*batch))
                    batch = []
            if batch:
                deleted += int(self._redis.delete(*batch))
            self._invalidations += deleted
            return deleted

        with self._lock:
            self._prune_memory()
            keys = [key for key in self._memory if key.startswith(prefix)]
            for key in keys:
                self._memory.pop(key, None)
            self._invalidations += len(keys)
            return len(keys)

    def namespace_version(self, namespace: str) -> int:
        key = cache_key("cache-version", namespace=namespace)
        if self._redis:
            raw = self._redis.get(key)
            return int(raw) if raw and str(raw).isdigit() else 0

        with self._lock:
            return self._memory_versions.get(key, 0)

    def bump_namespace(self, namespace: str) -> int:
        key = cache_key("cache-version", namespace=namespace)
        self._invalidations += 1
        if self._redis:
            return int(self._redis.incr(key))

        with self._lock:
            next_version = self._memory_versions.get(key, 0) + 1
            self._memory_versions[key] = next_version
            return next_version

    def increment_window(self, key: str, ttl_seconds: int) -> int:
        if self._redis:
            pipe = self._redis.pipeline()
            pipe.incr(key)
            pipe.expire(key, ttl_seconds, nx=True)
            count, _ = pipe.execute()
            return int(count)

        with self._lock:
            now = time.time()
            expires_at, count = self._memory_counters.get(key, (now + ttl_seconds, 0))
            if expires_at <= now:
                expires_at, count = now + ttl_seconds, 0
            count += 1
            self._memory_counters[key] = (expires_at, count)
            return count

    def ping(self) -> bool:
        if self._redis:
            return bool(self._redis.ping())
        return True

    def stats(self) -> dict[str, Any]:
        total = self._hits + self._misses
        key_count = 0
        if self._redis:
            key_count = -1
        else:
            with self._lock:
                self._prune_memory()
                key_count = len(self._memory)

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
