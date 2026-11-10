"""Async Postgres connection pool (psycopg 3).

v1 opened a brand-new connection on every query -- a TCP + TLS + auth
handshake each time (~50-200ms to Supabase). A pool opens a few connections
at startup and reuses them.
"""

from psycopg_pool import AsyncConnectionPool
from pgvector.psycopg import register_vector_async

from .config import settings


async def _configure(conn):
    await register_vector_async(conn)  # numpy arrays <-> vector columns


pool = AsyncConnectionPool(
    conninfo=settings.db_url,
    min_size=1,
    max_size=10,
    open=False,
    configure=_configure,
    # Supabase's pooler in transaction mode can't hold prepared statements
    # across transactions -- disable them.
    kwargs={"prepare_threshold": None},
)
