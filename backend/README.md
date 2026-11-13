# TADBuddy v2 — Backend

FastAPI + LangGraph backend for [TADBuddy](../frontend) (frontend), a friendly AI health companion.
It streams chat replies over Server-Sent Events, grounds them with retrieval (pgvector), and
remembers lasting facts about each user. Database and auth run on **Supabase**; the LLM runs
locally through **Ollama**.

Full design notes: [ARCHITECTURE_LANGGRAPH.md](ARCHITECTURE_LANGGRAPH.md) (current) and
[ARCHITECTURE.md](ARCHITECTURE.md) (schema, caching, scaling).

## Architecture

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

### Chat graph (LangGraph)

```
START → load_context → input_guard ─┬─ flagged → safety_reply ──────────────────────┐
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

- **input_guard** flags crisis, medical-emergency and harm-to-others messages and sends them to **safety_reply**, a fixed response with resources. Flagged messages never reach the LLM, and nothing from them is saved as a memory.
- **detect_emotion** labels the message (happy, sad, anxious, angry, tired, surprised or neutral). The label goes to the frontend straight away so the avatar can react, and it also sets the tone of the reply.
- **retrieve_kb** and **retrieve_memory** run in parallel: the top 3 knowledge-base examples, plus memories re-ranked by recency and importance.
- **build_prompt** fits persona, memories, examples and history into a 2,500-token budget.
- **output_guard** checks each sentence before it's streamed to the user (diagnosis, medication, harm methods). If a sentence is flagged, the reply is replaced with a safe one.
- **Rate limits:** 60 requests/min per IP, and 12 chats/min and 300/day per user (`app/ratelimit.py`). Over the limit, the API returns `429` with `Retry-After`.
- Once the stream closes, a background task pulls out lasting facts and stores them as deduplicated memories.

## Tech stack

| Layer | Choice |
|---|---|
| API | FastAPI, Uvicorn, SSE streaming |
| Orchestration | LangGraph `StateGraph` (`app/graph.py`) |
| LLM | `llama3.2:3b` via Ollama (LangChain `ChatOllama`) |
| Embeddings | `all-MiniLM-L6-v2` (384-dim) |
| Database | Supabase Postgres + pgvector (psycopg 3 async pool) |
| Auth | Supabase Auth (JWKS-verified access tokens) |
| Cache / limits | Redis |
| Packaging | Docker Compose: `api`, `ollama`, `redis` |

## API

| Method | Path | Notes |
|---|---|---|
| POST | `/v1/chat` | `{conversation_id?, message}` → SSE stream |
| POST | `/v1/conversations` | New empty conversation |
| GET | `/v1/conversations/{id}/messages` | Transcript (owner only) |
| GET / DELETE | `/v1/memories` | View / forget all memories |
| DELETE | `/v1/memories/{id}` | Forget one memory |
| GET | `/healthz`, `/readyz` | Liveness, DB readiness |

Interactive docs: `http://localhost:8000/docs`

## Getting started

```bash
# 1. In the Supabase SQL editor, run sql/001_schema.sql, then sql/002_supabase_rls.sql
# 2. Configure secrets (never commit .env)
cp .env.example .env          # fill in DATABASE_URL and SUPABASE_URL

# 3. Start services
docker compose build
docker compose up -d ollama redis
docker compose exec ollama ollama pull llama3.2:3b
docker compose run --rm api python -m scripts.ingest_kb
docker compose up api         # http://localhost:8000
```

Frontend:

```bash
cd ../frontend
echo VITE_TADBUDDY_API_URL=http://localhost:8000 > .env
npm install && npm run dev
```

## Project layout

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

## Disclaimer

TADBuddy is a wellbeing companion, not a medical device. It doesn't diagnose, and it isn't a
substitute for professional care. If you're in crisis, contact your local emergency number.
