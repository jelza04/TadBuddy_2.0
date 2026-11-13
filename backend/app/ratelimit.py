"""Fixed-window rate limiting on top of the shared cache (Redis or in-process).

Layers:
- per IP, every /v1 route   -> stops one machine hammering the API, including
                               rotating fake X-User-Id values in dev mode
- per user, /v1/chat/minute -> normal pacing
- per user, /v1/chat/day    -> caps LLM cost/abuse per account

Each window is a counter key like rl:chat:min:<user>:<window-number> that
expires on its own. When a limit is hit we return 429 with Retry-After.
"""

import time

from fastapi import HTTPException, Request

from .cache import cache
from .config import settings


async def _hit(name: str, ident: str, limit: int, window_s: int, message: str) -> None:
    if limit <= 0:  # 0 disables a limit
        return
    now = time.time()
    window = int(now // window_s)
    count = await cache.incr(f"rl:{name}:{ident}:{window}", ttl=window_s + 5)
    if count > limit:
        retry_after = max(1, int(window_s - (now % window_s)))
        raise HTTPException(429, message, headers={"Retry-After": str(retry_after)})


def client_ip(request: Request) -> str:
    # Only trust X-Forwarded-For when the API sits behind a proxy you control.
    if settings.trust_proxy:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def limit_ip(request: Request) -> None:
    await _hit("ip", client_ip(request), settings.ip_rate_limit_per_min, 60,
               "Too many requests from this network. Please wait a moment.")


async def limit_chat(user_id: str) -> None:
    await _hit("chat:min", user_id, settings.rate_limit_per_min, 60,
               "Slow down a little — give me a moment to catch up.")
    await _hit("chat:day", user_id, settings.rate_limit_per_day, 86400,
               "We've talked a lot today. Let's rest and pick this up tomorrow.")
