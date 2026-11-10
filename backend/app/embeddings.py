"""Embedding service.

Fixes two v1 problems:
1. The model was re-loaded from disk inside every retrieve() call. Now it is
   loaded once at startup and kept in memory.
2. model.encode() is CPU-bound and blocks. Running it directly inside an async
   endpoint would freeze every other request. We push it to a worker thread.
"""

import asyncio
import hashlib

import numpy as np
from sentence_transformers import SentenceTransformer

from .cache import cache
from .config import settings

_model: SentenceTransformer | None = None


def load_model() -> None:
    global _model
    _model = SentenceTransformer(settings.embedding_model)


def _normalize(text: str) -> str:
    return " ".join(text.lower().split())


async def embed(text: str) -> np.ndarray:
    key = "emb:" + settings.embedding_model + ":" + hashlib.sha256(_normalize(text).encode()).hexdigest()
    cached = await cache.get(key)
    if cached is not None:
        return np.asarray(cached, dtype=np.float32)

    assert _model is not None, "load_model() must run at startup"
    vector = await asyncio.to_thread(_model.encode, text, normalize_embeddings=True)
    await cache.set(key, vector.tolist(), settings.embed_cache_ttl_s)
    return vector
