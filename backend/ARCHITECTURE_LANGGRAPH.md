# TADBuddy Backend — LangGraph Architecture

Frontend: `../frontend` (React/Vite, already built). Database/auth: **Supabase**.
This document covers the backend. It supersedes the hand-wired `/v1/chat` flow in
`ARCHITECTURE.md` §3; the schema, caching and scaling sections there still apply.

---

## 1. System overview

```
┌────────────────────────┐
│  Frontend (tadbuddy)   │  React · Vite · Zustand
│  Chat · Mood · Insights│  mood/tasks/reminders stay in localStorage
└───────────┬────────────┘
            │ HTTPS  ·  POST /v1/chat → Server-Sent Events
            │ Authorization: Bearer <Supabase access token>   (AUTH_MODE=supabase)
            │ X-User-Id: <uuid>                               (AUTH_MODE=dev)
┌───────────▼────────────────────────────────────────────────────┐
│  Backend (tadbuddy-v2)  FastAPI                                 │
│   auth ─ rate limit ─▶ LangGraph chat graph ─▶ SSE stream        │
│                        └─ after stream: memory extraction        │
└──────┬───────────────────────┬───────────────────────┬─────────┘
       │ psycopg pool          │ HTTP                  │
┌──────▼───────────┐   ┌───────▼────────┐      ┌───────▼──────┐
│ Supabase         │   │ Ollama          │      │ Redis        │
│ Postgres+pgvector│   │ llama3.2:3b     │      │ caches, rate │
│ Auth (JWT/JWKS)  │   │ (ChatOllama)    │      │ limits       │
└──────────────────┘   └────────────────┘      └──────────────┘
```

---

## 2. Tech stack

| Layer | Choice |
|---|---|
| API | FastAPI, Uvicorn, SSE streaming |
| Orchestration | **LangGraph** `StateGraph` (`app/graph.py`) |
| LLM | `llama3.2:3b` via Ollama, called through LangChain `ChatOllama` |
| Embeddings | `all-MiniLM-L6-v2` (384-dim), loaded once in the API process |
| Database | Supabase Postgres + pgvector, via psycopg 3 async pool (session pooler) |
| Auth | Supabase Auth; backend verifies access tokens against the project JWKS |
| Cache / limits | Redis (falls back to in-process for a single replica) |
| Packaging | Docker Compose: `api`, `ollama`, `redis` |

---

## 3. The LangGraph pipeline

### 3.1 State

```python
class ChatState(TypedDict, total=False):
    user_id, conversation_id, message, started        # input
    history, user_message_id                          # load_context
    safety_flag                                       # input_guard
    query_vec                                         # embed_query
    kb_hits, memories                                 # retrieve_kb / retrieve_memory
    prompt, low_confidence                            # build_prompt
    reply                                             # generate / crisis_reply / output_guard
    assistant_message_id                              # persist
```

### 3.2 Graph

```
START → load_context → input_guard ─┬─ crisis → crisis_reply ───────────────────────┐
                                    ├─ ok ────→ embed_query ─┬→ retrieve_kb ─────┐    │
                                    │                        └→ retrieve_memory ─┤    │
                                    └─ ok ────→ detect_emotion ──────────────────┤    │
                                                                    build_prompt ◀┘    │
                                                                         ↓             │
                                                                     generate          │
                                                                         ↓             │
                                                                   output_guard        │
                                                                         ↓             │
                                                                      persist ◀────────┘ → END
```

`detect_emotion` runs alongside embedding + retrieval; `build_prompt` waits for all three.

| Node | Does | Module |
|---|---|---|
| `load_context` | Last 6 turns from `messages`; saves the user message | `repository.py` |
| `input_guard` | Crisis pattern check. **Conditional edge** routes crisis away from the LLM | `safety.py` |
| `crisis_reply` | Fixed, reviewed response + resources | `safety.py` |
| `detect_emotion` | Classifies the message as happy / sad / anxious / angry / tired / surprised / neutral (DistilRoBERTa emotion model, keyword fallback). Sent to the frontend immediately for the avatar's expression, and used for tone guidance in the prompt | `emotion.py` |
| `embed_query` | Embed the message (cached by text hash) | `embeddings.py` |
| `retrieve_kb` ∥ `retrieve_memory` | **Run in parallel** (fan-out/fan-in). KB top-3 by cosine; memories top-20 re-ranked by recency + importance → top-3 | `retrieval.py` |
| `build_prompt` | Persona + `<style>` voice examples + "about this user" (name, today's mood score, detected emotion) + `<memory>` + `<examples>` + history + message, within a 2,500-token budget; low-confidence mode if top distance > 0.75 | `prompt.py` |
| `generate` | `ChatOllama.ainvoke` under a concurrency semaphore | `graph.py`, `llm.py` |
| `output_guard` | Blocks diagnosis language | `safety.py` |
| `persist` | Saves the reply + `retrieval_logs` row | `repository.py` |

### 3.3 Streaming

```python
async for mode, chunk in graph.astream(inputs, stream_mode=["messages", "values"]):
    if mode == "messages":                       # LLM tokens
        msg, meta = chunk
        if meta["langgraph_node"] == "generate": yield token
    else:                                        # full state after each step
        final = chunk
```

Only tokens from the `generate` node are forwarded, so the background memory-extraction LLM
call can never leak into the chat stream. Crisis replies aren't LLM output, so they're sent
as one event at the end.

### 3.4 After the response

`StreamingResponse(..., background=after)` runs `memory.remember()` once the stream closes:
the LLM extracts lasting facts → each is embedded → near-duplicates (cosine distance < 0.12)
bump `times_seen`/`importance`, others are inserted. Skipped for crisis messages.

---

## 4. API

| Method | Path | Notes |
|---|---|---|
| POST | `/v1/chat` | `{conversation_id?, message, user_name?, mood_score? (1-10)}` → SSE. Omit `conversation_id` to start one. |
| POST | `/v1/conversations` | New empty conversation |
| GET | `/v1/conversations/{id}/messages` | Transcript (owner only) |
| GET / DELETE | `/v1/memories` | View / forget all memories |
| DELETE | `/v1/memories/{id}` | Forget one |
| GET | `/healthz`, `/readyz` | Liveness, DB readiness |

SSE events:

```
event: meta     data: {"conversation_id": "…"}
event: emotion  data: {"emotion": "anxious"}     (before any tokens — avatar reacts first)
                data: {"token": "That"}          (repeated)
event: error    data: {"message": "TADBuddy is busy…"}   (LLM saturated)
event: done     data: {"message_id": 812, "emotion": "anxious", "safety_flag": null, "low_confidence": false}
```

**Avatar reaction (frontend `Chat.tsx`):** typing → *listening* (head tilt) · send → instant local
guess, replaced by the backend `emotion` event · reply streams → mouth talks on top of the
expression · done → hold 4 s → neutral. Mapping (`src/lib/emotion.ts`): happy→excited,
sad→concerned (arms open), anxious/angry→calm (slow heart pulse), tired→sleepy,
surprised→surprised, neutral→smile.

HTTP errors: `401` auth · `404` not your conversation · `422` invalid body · `429` rate limit.

Frontend client: `../frontend/src/lib/backend.ts`.

---

## 5. Supabase

**Connection.** Use the **session pooler** (port 5432) — IPv4-compatible, which Docker needs,
and it keeps a real session per client so pooling inside the API is safe. Prepared statements
are disabled in the pool anyway (`prepare_threshold=None`) in case you later move to the
transaction pooler (6543).

**Schema.** `sql/001_schema.sql` — `app_users`, `conversations`, `messages`, `kb_documents`
(HNSW index), `user_memories` (btree on user, exact scan), `retrieval_logs`. Details in
`ARCHITECTURE.md` §5.

**Row Level Security.** `sql/002_supabase_rls.sql` enables RLS with no policies. Supabase
publishes `public` tables through its REST API; without RLS, anyone with the project's
public key could read users' messages. The backend connects as `postgres` and bypasses RLS.

**Auth.**
- `AUTH_MODE=dev`: frontend sends `X-User-Id` (what `tadbuddy` does today).
- `AUTH_MODE=supabase`: the frontend signs in with `supabase-js` and sends
  `Authorization: Bearer <access_token>`. The backend verifies it locally against
  `SUPABASE_URL/auth/v1/.well-known/jwks.json` (asymmetric keys), or with
  `SUPABASE_JWT_SECRET` for legacy HS256 projects. `sub` becomes `user_id`.
- Frontend change needed to switch: replace the localStorage login in
  `src/store/useAppStore.ts` with Supabase Auth, and send the token in `backend.ts`.

**Why no LangGraph checkpointer (for now).** LangGraph can persist graph state to Postgres
(`langgraph-checkpoint-postgres`). We don't need it yet: conversation history and memories
already live in our own tables, which the frontend and analytics read. A checkpointer would
duplicate that and add its own tables. Add it when you need **human-in-the-loop** — e.g.
pausing a flagged conversation with `interrupt()` until a reviewer approves the reply.

---

## 6. Caching

| What | Key | TTL |
|---|---|---|
| Query embeddings | `emb:{model}:{sha256(text)}` | 24 h |
| KB results | `kb:{sha256(vector)}:{k}` | 1 h (flush after re-ingest) |
| Rate limit | `rl:{user}:{minute}` | 70 s |
| Model weights | Ollama `keep_alive` | 30 min |

Never cached: memory search and LLM replies (personal data).

---

## 7. Project layout

```
backend/
├── app/
│   ├── main.py         routes, SSE, background memory task
│   ├── graph.py        LangGraph state, nodes, edges, streaming helper
│   ├── auth.py         dev header / Supabase JWT (JWKS)
│   ├── config.py       env-driven settings
│   ├── db.py           async psycopg pool
│   ├── cache.py        Redis / in-process
│   ├── embeddings.py   singleton model + cache
│   ├── retrieval.py    KB + memory SQL
│   ├── prompt.py       persona + token budget
│   ├── safety.py       input/output guards
│   ├── llm.py          concurrency slots; client for memory extraction
│   ├── memory.py       fact extraction + dedup write
│   └── repository.py   conversations, messages, memories, logs
├── scripts/ingest_kb.py
├── sql/001_schema.sql, sql/002_supabase_rls.sql
└── docker-compose.yml, Dockerfile, .env.example
```

---

## 8. Running it

```bash
# Supabase SQL editor: run sql/001_schema.sql, sql/002_supabase_rls.sql, sql/003_message_emotion.sql
cp .env.example .env                      # fill DATABASE_URL (+ SUPABASE_URL)
docker compose build
docker compose up -d ollama redis
docker compose exec ollama ollama pull llama3.2:3b
docker compose run --rm api python -m scripts.ingest_kb
docker compose up api                     # http://localhost:8000/docs

# frontend
cd ../frontend && echo VITE_TADBUDDY_API_URL=http://localhost:8000 > .env && npm run dev
```

---

## 9. Next steps

1. Run end to end against Supabase + Ollama (not yet done).
2. Switch the frontend to Supabase Auth and set `AUTH_MODE=supabase`.
3. Add a checkpointer + `interrupt()` for human review of flagged conversations.
4. Evaluation set and model comparison (`ARCHITECTURE.md` §10).
