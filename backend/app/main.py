"""TADBuddy API (FastAPI + LangGraph).

POST /v1/chat runs the LangGraph pipeline in app/graph.py and streams tokens
over Server-Sent Events. Memory extraction runs after the stream finishes.
"""

import asyncio
import json
import logging
import time
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from starlette.background import BackgroundTask

from . import repository as repo
from .auth import user_id_from_request
from .cache import cache
from .config import settings
from .db import pool
from .embeddings import load_model
from .emotion import load_model as load_emotion_model
from .graph import build_graph, default_chat_model, run_streaming
from .llm import LLMBusy
from .memory import remember

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("tadbuddy.api")

graph = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global graph
    await pool.open()
    await asyncio.to_thread(load_model)
    await asyncio.to_thread(load_emotion_model)
    graph = build_graph(default_chat_model())
    yield
    await pool.close()


app = FastAPI(title="TADBuddy API", version="2.1", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_methods=["*"],
                   allow_headers=["*"])


# --------------------------------------------------------------------------- dependencies
async def current_user(user_id: str = Depends(user_id_from_request)) -> str:
    await repo.ensure_user(user_id)
    return user_id


async def rate_limited(user_id: str = Depends(current_user)) -> str:
    bucket = f"rl:{user_id}:{int(time.time() // 60)}"
    if await cache.incr(bucket, ttl=70) > settings.rate_limit_per_min:
        raise HTTPException(429, "slow down a little")
    return user_id


# --------------------------------------------------------------------------- schemas
class ChatRequest(BaseModel):
    conversation_id: str | None = None
    message: str = Field(min_length=1, max_length=4000)
    # Optional personalisation from the frontend
    user_name: str | None = Field(default=None, max_length=60)
    mood_score: int | None = Field(default=None, ge=1, le=10)


def _sse(data: dict, event: str | None = None) -> str:
    prefix = f"event: {event}\n" if event else ""
    return f"{prefix}data: {json.dumps(data)}\n\n"


# --------------------------------------------------------------------------- routes
@app.get("/healthz")
async def healthz():
    return {"ok": True}


@app.get("/readyz")
async def readyz():
    async with pool.connection() as conn:
        await conn.execute("select 1")
    return {"ok": True, "model": settings.chat_model}


@app.post("/v1/conversations")
async def new_conversation(user_id: str = Depends(current_user)):
    return {"conversation_id": await repo.create_conversation(user_id)}


@app.get("/v1/conversations/{conversation_id}/messages")
async def get_messages(conversation_id: str, user_id: str = Depends(current_user)):
    if not await repo.conversation_belongs_to(conversation_id, user_id):
        raise HTTPException(404)
    return await repo.list_messages(conversation_id)


@app.get("/v1/memories")
async def get_memories(user_id: str = Depends(current_user)):
    return await repo.list_memories(user_id)


@app.delete("/v1/memories")
async def forget_everything(user_id: str = Depends(current_user)):
    return {"deleted": await repo.delete_memory(user_id)}


@app.delete("/v1/memories/{memory_id}")
async def forget_one(memory_id: int, user_id: str = Depends(current_user)):
    return {"deleted": await repo.delete_memory(user_id, memory_id)}


@app.post("/v1/chat")
async def chat(req: ChatRequest, user_id: str = Depends(rate_limited)):
    conversation_id = req.conversation_id
    if conversation_id is None:
        conversation_id = await repo.create_conversation(user_id, title=req.message[:60])
    elif not await repo.conversation_belongs_to(conversation_id, user_id):
        raise HTTPException(404, "conversation not found")

    inputs = {"user_id": user_id, "conversation_id": conversation_id, "message": req.message,
              "started": time.perf_counter(), "user_name": req.user_name, "mood_score": req.mood_score}
    result: dict = {}

    async def stream():
        yield _sse({"conversation_id": conversation_id}, event="meta")
        try:
            async for kind, value in run_streaming(graph, inputs):
                if kind == "token":
                    yield _sse({"token": value})
                elif kind == "emotion":
                    yield _sse({"emotion": value}, event="emotion")
                else:
                    result.update(value)
        except LLMBusy:
            yield _sse({"message": "TADBuddy is busy, try again in a moment"}, event="error")
            return

        # Crisis replies don't come from the LLM, so nothing was streamed — send it whole.
        if result.get("safety_flag"):
            yield _sse({"token": result["reply"]})
        log.info("chat user=%s flag=%s low_conf=%s", user_id, result.get("safety_flag"),
                 result.get("low_confidence"))
        yield _sse({"message_id": result.get("assistant_message_id"),
                    "emotion": result.get("emotion"),
                    "safety_flag": result.get("safety_flag"),
                    "low_confidence": result.get("low_confidence", False)}, event="done")

    async def after():
        # Never store memories from crisis messages; skip if the graph didn't finish.
        if result.get("assistant_message_id") and not result.get("safety_flag"):
            await remember(user_id, req.message, result["user_message_id"])

    return StreamingResponse(stream(), media_type="text/event-stream", background=BackgroundTask(after))
