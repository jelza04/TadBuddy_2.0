"""All tunables in one place, read from environment variables."""

import os
from dataclasses import dataclass, field


def _int(name: str, default: int) -> int:
    return int(os.environ.get(name, default))


def _float(name: str, default: float) -> float:
    return float(os.environ.get(name, default))


@dataclass(frozen=True)
class Settings:
    db_url: str = field(default_factory=lambda: os.environ["DATABASE_URL"])
    redis_url: str | None = field(default_factory=lambda: os.environ.get("REDIS_URL"))

    # Auth: "dev" trusts an X-User-Id header (local only). "supabase" verifies
    # Supabase Auth access tokens (JWKS, or SUPABASE_JWT_SECRET for legacy HS256).
    auth_mode: str = field(default_factory=lambda: os.environ.get("AUTH_MODE", "dev"))
    supabase_url: str | None = field(default_factory=lambda: (os.environ.get("SUPABASE_URL") or "").rstrip("/") or None)
    jwt_secret: str | None = field(default_factory=lambda: os.environ.get("SUPABASE_JWT_SECRET"))

    # Frontend origins allowed to call the API (the Vite dev server by default).
    cors_origins: list[str] = field(default_factory=lambda: os.environ.get(
        "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(","))

    # Models
    embedding_model: str = os.environ.get("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
    ollama_url: str = os.environ.get("OLLAMA_URL", "http://ollama:11434")
    chat_model: str = os.environ.get("CHAT_MODEL", "llama3.2:3b")
    # The chat graph always uses LangChain's ChatOllama. This only affects the
    # background memory-extraction call ("langchain" | "ollama" raw HTTP).
    llm_backend: str = os.environ.get("LLM_BACKEND", "langchain")
    temperature: float = _float("LLM_TEMPERATURE", 0.6)
    num_ctx: int = _int("LLM_NUM_CTX", 4096)
    llm_max_concurrency: int = _int("LLM_MAX_CONCURRENCY", 2)
    llm_queue_timeout_s: float = _float("LLM_QUEUE_TIMEOUT_S", 20.0)

    # Retrieval
    kb_top_k: int = _int("KB_TOP_K", 3)
    memory_top_k: int = _int("MEMORY_TOP_K", 3)
    history_turns: int = _int("HISTORY_TURNS", 6)
    low_confidence_distance: float = _float("LOW_CONFIDENCE_DISTANCE", 0.75)
    memory_dedup_distance: float = _float("MEMORY_DEDUP_DISTANCE", 0.12)

    # Prompt budget (approximate tokens; 1 token ~= 4 chars of English)
    prompt_token_budget: int = _int("PROMPT_TOKEN_BUDGET", 2500)

    # Caching / limits
    embed_cache_ttl_s: int = _int("EMBED_CACHE_TTL_S", 86400)
    kb_cache_ttl_s: int = _int("KB_CACHE_TTL_S", 3600)
    rate_limit_per_min: int = _int("RATE_LIMIT_PER_MIN", 20)

    # Must be set to verified, local resources before any real user sees this.
    crisis_resources: str = os.environ.get(
        "CRISIS_RESOURCES",
        "If you are in immediate danger, please contact your local emergency number "
        "or a crisis helpline in your country right now.",
    )


settings = Settings()
