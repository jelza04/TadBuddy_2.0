"""TADBuddy chat pipeline as a LangGraph StateGraph.

                       ┌──────────────┐
            START ───▶ │ load_context │  history + persist user message
                       └──────┬───────┘
                       ┌──────▼───────┐
                       │ input_guard  │  crisis keyword check
                       └──┬────────┬──┘
                 crisis   │        │  ok
                ┌─────────▼──┐  ┌──▼──────────┐
                │crisis_reply│  │ embed_query │
                └─────┬──────┘  └──┬───────┬──┘
                      │     ┌──────▼──┐ ┌──▼──────────────┐   (parallel)
                      │     │retrieve_│ │retrieve_memory  │
                      │     │   kb    │ └──┬──────────────┘
                      │     └──────┬──┘    │
                      │       ┌────▼───────▼┐
                      │       │ build_prompt│
                      │       └──────┬──────┘
                      │       ┌──────▼──────┐
                      │       │  generate   │  ChatOllama — tokens streamed via stream_mode="messages"
                      │       └──────┬──────┘
                      │       ┌──────▼──────┐
                      │       │output_guard │
                      │       └──────┬──────┘
                      │       ┌──────▼──────┐
                      └──────▶│   persist   │  assistant message + retrieval log
                              └──────┬──────┘
                                    END

Memory extraction runs after the response is sent (see main.py), outside the
graph, so it never adds latency to the user-facing reply.

The graph uses the app's own Supabase tables for state (messages, memories),
not a LangGraph checkpointer — see ARCHITECTURE_LANGGRAPH.md §5 for why.
"""

import time
from typing import Any, TypedDict

import numpy as np
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_core.runnables import RunnableConfig
from langgraph.graph import END, START, StateGraph

from . import repository as repo
from .config import settings
from .embeddings import embed
from .llm import acquire_slot, release_slot
from .prompt import build_messages
from .retrieval import KBHit, MemoryHit, search_kb, search_memories
from .safety import check_input, check_output, crisis_response


class ChatState(TypedDict, total=False):
    # input
    user_id: str
    conversation_id: str
    message: str
    started: float
    # filled in by nodes
    history: list[dict]
    user_message_id: int
    safety_flag: str | None
    query_vec: list[float]
    kb_hits: list[dict]
    memories: list[dict]
    prompt: list[dict]
    low_confidence: bool
    reply: str
    assistant_message_id: int


def _to_lc(messages: list[dict]):
    cls = {"system": SystemMessage, "user": HumanMessage, "assistant": AIMessage}
    return [cls[m["role"]](content=m["content"]) for m in messages]


def build_graph(chat_model: BaseChatModel):
    # ---------------------------------------------------------------- nodes
    async def load_context(state: ChatState) -> dict:
        history = await repo.recent_history(state["conversation_id"], settings.history_turns)
        msg_id = await repo.add_message(state["conversation_id"], "user", state["message"])
        return {"history": history, "user_message_id": msg_id}

    async def input_guard(state: ChatState) -> dict:
        result = check_input(state["message"])
        return {"safety_flag": result.category if result.flagged else None}

    async def crisis_reply(state: ChatState) -> dict:
        return {"reply": crisis_response(), "low_confidence": False, "kb_hits": [], "memories": []}

    async def embed_query(state: ChatState) -> dict:
        vec = await embed(state["message"])
        return {"query_vec": vec.tolist()}

    async def retrieve_kb(state: ChatState) -> dict:
        hits = await search_kb(np.asarray(state["query_vec"], dtype=np.float32))
        return {"kb_hits": [h.__dict__ for h in hits]}

    async def retrieve_memory(state: ChatState) -> dict:
        hits = await search_memories(state["user_id"], np.asarray(state["query_vec"], dtype=np.float32))
        return {"memories": [m.__dict__ for m in hits]}

    async def build_prompt(state: ChatState) -> dict:
        prompt, low_conf = build_messages(
            state["message"],
            state.get("history", []),
            [KBHit(**h) for h in state.get("kb_hits", [])],
            [MemoryHit(**m) for m in state.get("memories", [])],
        )
        return {"prompt": prompt, "low_confidence": low_conf}

    async def generate(state: ChatState, config: RunnableConfig) -> dict:
        await acquire_slot()  # raises LLMBusy -> 503
        try:
            # Passing `config` lets LangGraph capture tokens for stream_mode="messages".
            result = await chat_model.ainvoke(_to_lc(state["prompt"]), config)
        finally:
            release_slot()
        return {"reply": str(result.content)}

    async def output_guard(state: ChatState) -> dict:
        return {"reply": check_output(state["reply"])}

    async def persist(state: ChatState) -> dict:
        crisis = state.get("safety_flag") is not None
        latency = int((time.perf_counter() - state["started"]) * 1000)
        msg_id = await repo.add_message(
            state["conversation_id"], "assistant", state["reply"],
            safety_flag=state.get("safety_flag"),
            model="safety-template" if crisis else settings.chat_model,
            latency_ms=latency,
        )
        if not crisis:
            await repo.log_retrieval(
                msg_id,
                [KBHit(**h) for h in state.get("kb_hits", [])],
                [MemoryHit(**m) for m in state.get("memories", [])],
                state.get("low_confidence", False),
            )
        return {"assistant_message_id": msg_id}

    # ---------------------------------------------------------------- wiring
    g = StateGraph(ChatState)
    for name, fn in [
        ("load_context", load_context), ("input_guard", input_guard), ("crisis_reply", crisis_reply),
        ("embed_query", embed_query), ("retrieve_kb", retrieve_kb), ("retrieve_memory", retrieve_memory),
        ("build_prompt", build_prompt), ("generate", generate), ("output_guard", output_guard),
        ("persist", persist),
    ]:
        g.add_node(name, fn)

    g.add_edge(START, "load_context")
    g.add_edge("load_context", "input_guard")
    g.add_conditional_edges(
        "input_guard",
        lambda s: "crisis" if s.get("safety_flag") else "ok",
        {"crisis": "crisis_reply", "ok": "embed_query"},
    )
    g.add_edge("crisis_reply", "persist")
    g.add_edge("embed_query", "retrieve_kb")       # fan-out: both retrievals run in parallel
    g.add_edge("embed_query", "retrieve_memory")
    g.add_edge(["retrieve_kb", "retrieve_memory"], "build_prompt")  # fan-in: waits for both
    g.add_edge("build_prompt", "generate")
    g.add_edge("generate", "output_guard")
    g.add_edge("output_guard", "persist")
    g.add_edge("persist", END)
    return g.compile()


def default_chat_model() -> BaseChatModel:
    from langchain_ollama import ChatOllama

    return ChatOllama(
        model=settings.chat_model,
        base_url=settings.ollama_url,
        temperature=settings.temperature,
        num_ctx=settings.num_ctx,
        keep_alive="30m",
    )


async def run_streaming(graph, inputs: dict[str, Any]):
    """Yields ("token", str) while generating, then ("final", state)."""
    final: dict = {}
    async for mode, chunk in graph.astream(inputs, stream_mode=["messages", "values"]):
        if mode == "messages":
            msg, meta = chunk
            if meta.get("langgraph_node") == "generate" and getattr(msg, "content", ""):
                yield "token", msg.content
        elif mode == "values":
            final = chunk
    yield "final", final
