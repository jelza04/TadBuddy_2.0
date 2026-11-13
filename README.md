# TADBuddy 2.0

A warm, empathetic AI health companion: daily mood check-ins, a chat that doubles as a journal,
mood insights, and a backend that remembers what matters to you.

| Folder | What it is | Stack |
|---|---|---|
| [`frontend/`](frontend) | Web app (chat, mood check, history, insights, tasks) | React 18 · Vite · TypeScript · Tailwind · Zustand |
| [`backend/`](backend) | Chat API with retrieval + long-term memory | FastAPI · LangGraph · Ollama · Supabase (Postgres + pgvector) · Redis |

## Architecture

```
┌────────────────────────┐
│  Frontend              │  React · Vite · Zustand
│  Chat · Mood · Insights│  mood/tasks/reminders stay in localStorage
└───────────┬────────────┘
            │ HTTPS  ·  POST /v1/chat → Server-Sent Events
            │ Authorization: Bearer <Supabase access token>   (AUTH_MODE=supabase)
            │ X-User-Id: <uuid>                               (AUTH_MODE=dev)
┌───────────▼────────────────────────────────────────────────────┐
│  Backend  FastAPI                                               │
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

Crisis, medical-emergency and harm-to-others messages skip the LLM and get a fixed safety reply. Every reply is checked sentence by sentence before the user sees it, and the API is rate-limited per IP and per user. Knowledge-base examples and the
user's memories are retrieved in parallel. Once the reply finishes streaming, new facts are
extracted and saved as memories. Full details are in
[backend/ARCHITECTURE_LANGGRAPH.md](backend/ARCHITECTURE_LANGGRAPH.md).

## Quick start

```bash
# Backend: run backend/sql/001_schema.sql and 002_supabase_rls.sql in Supabase first
cd backend
cp .env.example .env              # fill in DATABASE_URL, SUPABASE_URL
docker compose up -d ollama redis
docker compose exec ollama ollama pull llama3.2:3b
docker compose run --rm api python -m scripts.ingest_kb
docker compose up api             # http://localhost:8000/docs

# Frontend
cd ../frontend
cp .env.example .env              # VITE_TADBUDDY_API_URL=http://localhost:8000
npm install
npm run dev                       # http://localhost:5173
```

`.env` files are git-ignored. Only `.env.example` templates are committed.

## Disclaimer

TADBuddy is a wellbeing companion, not a medical device. It doesn't diagnose, and it isn't a
substitute for professional care. If you're in crisis, contact your local emergency number.
