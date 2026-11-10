"""Two retrievers: shared knowledge base + per-user memory."""

import hashlib
from dataclasses import dataclass

import numpy as np

from .cache import cache
from .config import settings
from .db import pool


@dataclass
class KBHit:
    id: int
    context: str
    response: str
    distance: float


@dataclass
class MemoryHit:
    id: int
    content: str
    distance: float


async def search_kb(query_vec: np.ndarray, k: int | None = None) -> list[KBHit]:
    k = k or settings.kb_top_k
    # KB is shared and changes rarely -> safe to cache by query vector.
    key = "kb:" + hashlib.sha256(query_vec.tobytes()).hexdigest() + f":{k}"
    cached = await cache.get(key)
    if cached is not None:
        return [KBHit(**h) for h in cached]

    async with pool.connection() as conn:
        rows = await (
            await conn.execute(
                """
                select id, context, response, embedding <=> %s as distance
                from kb_documents
                where embedding_model = %s
                order by embedding <=> %s
                limit %s
                """,
                (query_vec, settings.embedding_model, query_vec, k),
            )
        ).fetchall()

    hits = [KBHit(id=r[0], context=r[1], response=r[2], distance=float(r[3])) for r in rows]
    await cache.set(key, [h.__dict__ for h in hits], settings.kb_cache_ttl_s)
    return hits


async def search_memories(user_id: str, query_vec: np.ndarray, k: int | None = None) -> list[MemoryHit]:
    """Semantic match re-ranked by recency and importance.

    score = 0.75 * distance + 0.15 * age_penalty - 0.10 * importance_bonus
    (lower is better). Never cached: memories are personal and change every turn.
    """
    k = k or settings.memory_top_k
    async with pool.connection() as conn:
        rows = await (
            await conn.execute(
                """
                with candidates as (
                    select id, content, importance, last_seen_at,
                           embedding <=> %s as distance
                    from user_memories
                    where user_id = %s and embedding_model = %s
                    order by embedding <=> %s
                    limit 20
                )
                select id, content, distance
                from candidates
                order by
                    0.75 * distance
                  + 0.15 * least(extract(epoch from now() - last_seen_at) / 86400.0 / 90.0, 1.0)
                  - 0.10 * (importance - 1) / 2.0
                limit %s
                """,
                (query_vec, user_id, settings.embedding_model, query_vec, k),
            )
        ).fetchall()
    return [MemoryHit(id=r[0], content=r[1], distance=float(r[2])) for r in rows]
