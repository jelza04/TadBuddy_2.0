"""LLM client behind one interface, so the model/backend is swappable.

- OllamaClient: raw HTTP to Ollama's /api/chat (streaming NDJSON).
- LangChainClient: same contract via langchain-ollama's ChatOllama.

A semaphore caps concurrent generations. Ollama on CPU handles only a couple
of requests at a time; without a cap, 50 simultaneous users means 50 requests
all timing out instead of a few waiting briefly and the rest getting a fast 503.
"""

import asyncio
import json
from collections.abc import AsyncIterator

import httpx

from .config import settings


class LLMBusy(Exception):
    pass


_slots = asyncio.Semaphore(settings.llm_max_concurrency)


class OllamaClient:
    def __init__(self):
        self._http = httpx.AsyncClient(base_url=settings.ollama_url, timeout=httpx.Timeout(120, connect=5))

    async def stream(self, messages: list[dict], model: str | None = None) -> AsyncIterator[str]:
        payload = {
            "model": model or settings.chat_model,
            "messages": messages,
            "stream": True,
            "keep_alive": "30m",  # keep weights in RAM; cold load costs seconds
            "options": {"temperature": settings.temperature, "num_ctx": settings.num_ctx},
        }
        async with self._http.stream("POST", "/api/chat", json=payload) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line:
                    continue
                chunk = json.loads(line)
                token = chunk.get("message", {}).get("content", "")
                if token:
                    yield token
                if chunk.get("done"):
                    break

    async def complete(self, messages: list[dict], model: str | None = None) -> str:
        return "".join([t async for t in self.stream(messages, model)])


class LangChainClient:
    def __init__(self):
        from langchain_ollama import ChatOllama

        self._llm = ChatOllama(
            model=settings.chat_model,
            base_url=settings.ollama_url,
            temperature=settings.temperature,
            num_ctx=settings.num_ctx,
            keep_alive="30m",
        )

    async def stream(self, messages: list[dict], model: str | None = None) -> AsyncIterator[str]:
        lc_messages = [(m["role"], m["content"]) for m in messages]
        async for chunk in self._llm.astream(lc_messages):
            if chunk.content:
                yield chunk.content

    async def complete(self, messages: list[dict], model: str | None = None) -> str:
        return "".join([t async for t in self.stream(messages, model)])


llm = LangChainClient() if settings.llm_backend == "langchain" else OllamaClient()


async def acquire_slot() -> None:
    try:
        await asyncio.wait_for(_slots.acquire(), timeout=settings.llm_queue_timeout_s)
    except asyncio.TimeoutError as exc:
        raise LLMBusy() from exc


def release_slot() -> None:
    _slots.release()
