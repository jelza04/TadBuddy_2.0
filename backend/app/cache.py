"""Tiny cache abstraction: Redis if REDIS_URL is set, in-process dict otherwise.

In-process works for a single API replica. Once you run 2+ replicas, use
Redis so they share the cache and the rate-limit counters.
"""

import json
import time
from typing import Any

from .config import settings


class MemoryCache:
    def __init__(self):
        self._data: dict[str, tuple[float, str]] = {}

    async def get(self, key: str) -> Any | None:
        item = self._data.get(key)
        if not item:
            return None
        expires, raw = item
        if expires < time.time():
            self._data.pop(key, None)
            return None
        return json.loads(raw)

    async def set(self, key: str, value: Any, ttl: int) -> None:
        self._data[key] = (time.time() + ttl, json.dumps(value))

    async def incr(self, key: str, ttl: int) -> int:
        current = await self.get(key) or 0
        current += 1
        expires = self._data.get(key, (time.time() + ttl, ""))[0]
        self._data[key] = (expires, json.dumps(current))
        return current


class RedisCache:
    def __init__(self, url: str):
        import redis.asyncio as redis

        self._r = redis.from_url(url, decode_responses=True)

    async def get(self, key: str) -> Any | None:
        raw = await self._r.get(key)
        return json.loads(raw) if raw else None

    async def set(self, key: str, value: Any, ttl: int) -> None:
        await self._r.set(key, json.dumps(value), ex=ttl)

    async def incr(self, key: str, ttl: int) -> int:
        pipe = self._r.pipeline()
        pipe.incr(key)
        pipe.expire(key, ttl, nx=True)
        count, _ = await pipe.execute()
        return int(count)


cache = RedisCache(settings.redis_url) if settings.redis_url else MemoryCache()
