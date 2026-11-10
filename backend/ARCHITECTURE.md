# TADBuddy v2 — System Architecture

> **Update:** the chat pipeline now runs on LangGraph — see `ARCHITECTURE_LANGGRAPH.md`.
> Schema, caching, scaling and the v3 roadmap below are unchanged.

A RAG + long-term-memory wellness companion. This document reviews the v1
prototype (`rag-learning/`), then specifies the v2 design implemented in this folder.

---

## 1. Review of the current (v1) architecture

v1 is a correct learning pipeline: embed → pgvector cosine search → f-string prompt → Ollama.
Retrieval is verified working. As a *product*, it has these problems, ordered by severity:

| # | Problem | Impact | v2 fix |
|---|---|---|---|
| 1 | **No safety layer.** Crisis messages go straight to a 1B model. | Unacceptable for a mental-health product. | Rule-based pre-check runs before retrieval; crisis messages get a fixed, reviewed response and never reach the LLM or memory (`app/safety.py`). |
| 2 | Embedding model reloaded from disk on **every** `retrieve()` call. | ~1–3 s added per request; RAM churn. | Loaded once at startup, encoding run in a worker thread (`app/embeddings.py`). |
| 3 | New Postgres connection per query. | TCP+TLS+auth handshake (~50–200 ms to Supabase) each time; hits connection limits under load. | Async connection pool (`app/db.py`). |
| 4 | Stateless — no conversation history, no user identity. | Can't hold a conversation or personalise. | `conversations`/`messages` tables + per-user `user_memories` with semantic recall. |
| 5 | One `content` column mixing context + response; no metadata. | Can't filter, re-rank, audit, or migrate embedding models. | `kb_documents` with separate columns, `content_hash`, `embedding_model`, `topic`. |
| 6 | Dedup only in Python (`seen_contexts`). | Re-running ingest duplicates data. | `UNIQUE(content_hash)` + `ON CONFLICT DO NOTHING` — idempotent ingest. |
| 7 | Single string prompt, no budget. | Small models degrade/overflow on long prompts. | Chat-format messages + token budget with defined drop order (`app/prompt.py`). |
| 8 | No grounding confidence. | Model invents answers when retrieval is poor. | Distance threshold → low-confidence mode (`LOW_CONFIDENCE_DISTANCE`). |
| 9 | Retrieved text injected unguarded. | Prompt injection via dataset/memory content. | Content fenced in `<examples>`/`<memory>` tags; system prompt says it's data, not instructions. |
| 10 | No observability. | "Tuning" is guesswork. | `retrieval_logs` table + per-stage latency logging. |
| 11 | `llama3.2:1b`, non-streaming. | Weak replies; user stares at a blank screen for 5–10 s. | Configurable model (default `llama3.2:3b`), streamed over SSE. |

Correction to earlier notes: the dataset is **`Amod/mental_health_counseling_conversations`** on Hugging Face (~3.5k rows, many duplicate contexts), not Counsel Chat.

---

## 2. Component structure

```
backend/
├── app/
│   ├── main.py         FastAPI routes, auth, rate limit, request orchestration
│   ├── config.py       every tunable, from env vars
│   ├── db.py           async psycopg pool + pgvector registration
│   ├── cache.py        Redis (multi-replica) or in-process (single replica)
│   ├── embeddings.py   singleton embedding model + embedding cache
│   ├── safety.py       crisis pre-check, diagnosis post-check
│   ├── retrieval.py    KB search, memory search with recency/importance re-rank
│   ├── prompt.py       persona, message assembly, token budget
│   ├── llm.py          LLM interface: raw Ollama HTTP or LangChain ChatOllama
│   ├── memory.py       background fact extraction + dedup write
│   └── repository.py   conversations, messages, memories, retrieval logs
├── scripts/ingest_kb.py  batched, idempotent dataset load
├── sql/001_schema.sql
├── Dockerfile, docker-compose.yml (api + ollama + redis)
```

Deployment units:

```
          ┌──────────────┐
Browser ─▶│  Frontend    │  React/Vite (static)
          └──────┬───────┘
                 │ HTTPS, SSE
          ┌──────▼───────┐      ┌─────────┐
          │  API (N×)    │◀────▶│  Redis  │  embed cache, KB cache, rate limits
          │  FastAPI     │      └─────────┘
          └──┬────────┬──┘
             │        │ HTTP
   ┌─────────▼──┐  ┌──▼──────────────┐
   │ Postgres + │  │ Inference tier  │  Ollama (CPU, dev) → vLLM (GPU, prod)
   │ pgvector   │  └─────────────────┘
   │ (Supabase) │
   └────────────┘
```

The API is **stateless** — all state lives in Postgres/Redis — so it scales by adding replicas.
The inference tier scales independently, because it's the bottleneck.

---

## 3. Data flow

### 3.1 Chat request (synchronous path)

```
POST /v1/chat
 1. auth            → user_id (JWT sub, or X-User-Id in dev)
 2. rate limit      → Redis INCR rl:{user}:{minute}         429 if over
 3. load history    → last 6 turns of this conversation
 4. persist user msg
 5. SAFETY PRE-CHECK ── flagged? → fixed crisis response, log, return  (LLM & memory skipped)
 6. embed(message)  → cache hit? skip model
 7. parallel:  search_kb(vec)         top-3, cached 1h
               search_memories(user)  top-20 by distance → re-rank by recency+importance → top-3
 8. build_messages  → system(persona + <memory> + <examples>) + history + user, ≤ 2,500 tokens
                      top KB distance > 0.75 → drop examples, add low-confidence instruction
 9. acquire LLM slot (semaphore) → 503 if queue wait > 20 s
10. stream tokens to client over SSE
11. post-check, persist assistant msg, write retrieval_logs
```

### 3.2 After the response (asynchronous path)

```
12. memory.remember(user, message)
      skip if < 25 chars
      LLM extracts durable facts ("User is a final-year student") or NONE
      for each fact: embed → nearest existing memory for this user
          distance < 0.12 → bump times_seen, importance, last_seen_at
          else           → insert new memory
```

### 3.3 Ingestion

```
dataset → filter (empty, >1,200 chars) → normalise + sha256 → dedup
       → encode in batches of 64 (normalised) → INSERT … ON CONFLICT DO NOTHING
```

---

## 4. API design

All routes versioned under `/v1`. Auth: `Authorization: Bearer <Supabase JWT>` (`AUTH_MODE=jwt`) or `X-User-Id` (`AUTH_MODE=dev`, local only).

| Method | Path | Purpose |
|---|---|---|
| POST | `/v1/chat` | Send a message. Body `{conversation_id?, message, stream=true}`. Omit `conversation_id` to start a new conversation. |
| POST | `/v1/conversations` | Create an empty conversation. |
| GET | `/v1/conversations/{id}/messages` | Full transcript (ownership checked, 404 otherwise). |
| GET | `/v1/memories` | What TADBuddy remembers about the user. |
| DELETE | `/v1/memories` | Forget everything. |
| DELETE | `/v1/memories/{id}` | Forget one item. |
| GET | `/healthz` | Liveness (process up). |
| GET | `/readyz` | Readiness (DB reachable). |

Memory read/delete endpoints are a product requirement, not a nice-to-have: users must be able to see and erase what a mental-health app stores about them.

**Streaming response** (`text/event-stream`):

```
event: meta
data: {"conversation_id": "…", "low_confidence": false}

data: {"token": "That"}
data: {"token": " sounds"}
…
event: done
data: {"message_id": 812}
```

Non-streaming (`stream=false`) and crisis responses return JSON:
`{conversation_id, message_id, reply, safety_flag, low_confidence}`.

Errors: `401` auth, `404` not yours/not found, `422` validation (message 1–4,000 chars), `429` rate limit, `503` LLM saturated (client should retry with backoff).

---

## 5. Database schema

Full DDL in `sql/001_schema.sql`.

```
app_users (id uuid PK)
   │ 1
   ├──< conversations (id uuid PK, user_id, title, updated_at)
   │        │ 1
   │        └──< messages (id, conversation_id, role, content, safety_flag, model, latency_ms)
   │                 │ 1
   │                 └──< retrieval_logs (message_id, kb_ids[], kb_distances[], memory_ids[], low_confidence)
   │
   └──< user_memories (id, user_id, content, embedding vector(384), embedding_model,
                       importance 1-3, times_seen, source_message_id, last_seen_at)

kb_documents (id, source, context, response, topic, content_hash UNIQUE,
              embedding vector(384), embedding_model)
```

Indexing decisions:

- `kb_documents.embedding` — **HNSW** (`vector_cosine_ops`). Approximate nearest-neighbour; negligible at 3k rows, essential at 100k+.
- `user_memories` — **btree on `(user_id, last_seen_at)`**, no vector index. A user has tens to hundreds of memories; filtering by user then doing an exact distance scan is both faster and more accurate than an HNSW index with a `WHERE user_id = …` filter (HNSW filters after the graph search and can return too few rows).
- `embedding_model` on every vector row: changing models later means re-embedding; storing the model name lets old and new vectors coexist during a migration and stops queries from silently comparing incompatible vectors.
- Supabase: enable **Row Level Security** on user-owned tables if the frontend ever talks to Supabase directly. With all access through the API (as designed), the API's service role enforces ownership in SQL.

---

## 6. Caching strategy

| What | Where | Key | TTL | Why |
|---|---|---|---|---|
| Query embeddings | Redis | `emb:{model}:{sha256(normalised text)}` | 24 h | Encoding is the costliest CPU step in the API; repeated phrases ("I feel anxious") are common. |
| KB search results | Redis | `kb:{sha256(vector)}:{k}` | 1 h | KB is shared and read-only between ingests. Flush on re-ingest. |
| Rate-limit counters | Redis | `rl:{user}:{minute}` | 70 s | Must be shared across API replicas. |
| LLM weights | Ollama RAM | — | `keep_alive=30m` | Cold-loading a model takes seconds. |
| **Not cached** | — | — | — | Memory search (personal, changes every turn) and LLM replies (personalised; caching them risks serving one user's context to another). |

Without `REDIS_URL` the API falls back to an in-process cache — fine for one replica.
Redis runs with `allkeys-lru` and a memory cap, so it degrades by evicting, not by crashing.

---

## 7. LLM choice

| Option | Size | Use when | Notes |
|---|---|---|---|
| `llama3.2:1b` (v1) | ~1.3 GB | Very weak hardware | Fast but shallow, inconsistent tone. |
| **`llama3.2:3b` (v2 default)** | ~2 GB | Laptop / CPU server | Best-supported small CPU option; noticeably better instruction-following than 1B. |
| `qwen3:1.7b` / `qwen3:4b` | 1–3 GB | Worth A/B testing on CPU | Strong for size per 2026 roundups. |
| 7–9B class (Llama/Qwen/Gemma) | 5–6 GB | GPU available | Large quality jump for empathetic phrasing. |
| Hosted API | — | Scale without GPUs | Only with a data-processing agreement; sends sensitive user text off-system. |

Recommendation: keep it **configurable** (`CHAT_MODEL`), and choose by evaluation, not by blog rankings — run 30–50 representative messages through two or three candidates, log replies, and score tone, rule-following (no diagnosing), and latency. `retrieval_logs` + `messages.model` give you the data to compare.

Embeddings: keep `all-MiniLM-L6-v2` (384-dim) for now — fast and adequate. Upgrade path is a stronger small model (e.g. a 768-dim BGE/Nomic variant) via the `embedding_model` column migration described above.

**LangChain:** `LLM_BACKEND=langchain` switches generation to `langchain_ollama.ChatOllama` behind the same interface. LangChain's `PGVector` store is deliberately **not** used: it creates and manages its own tables (`langchain_pg_collection` / `langchain_pg_embedding`) and doesn't support the user-scoped, recency-weighted memory query this product needs. Retrieval stays in explicit SQL.

---

## 8. Scaling — what breaks, in order

| Load | First bottleneck | Mitigation |
|---|---|---|
| 1–10 concurrent | Nothing significant | Single API + Ollama on CPU. |
| 10–50 | **LLM inference** (CPU generates ~5–20 tokens/s per request) | Semaphore + 503 keeps latency bounded; GPU host; `OLLAMA_NUM_PARALLEL`. |
| 50–500 | Inference throughput; DB connections | Move to **vLLM** on GPU (continuous batching serves many requests per GPU); Supabase pooler in transaction mode (prepared statements already disabled). |
| 500+ | Background memory extraction competing with chat for the LLM | Move `remember()` to a queue + worker (Redis Streams / arq) using a smaller model; run with lower priority. |
| 100k+ KB rows | Vector search | HNSW already in place; tune `hnsw.ef_search`; consider partitioning by `source`/`topic`. |

API replicas are cheap (stateless). Run **one uvicorn worker per container** — each worker loads its own copy of the embedding model, so scale by containers.

---

## 9. Known limitations / next steps

- **Safety is a baseline, not a solution.** Keyword matching over-triggers and misses indirect phrasing. Next: a dedicated classifier with keywords as a fallback, a clinically reviewed response policy, and verified local crisis resources in `CRISIS_RESOURCES`. Do not put this in front of real users without that review.
- **Streaming vs. output check:** in streaming mode tokens reach the user before `check_output` runs; the check only affects what's stored. If the output check must be enforced, buffer sentence-by-sentence before emitting.
- **Memory extraction quality** depends on the chat model; small models produce noisy facts. Evaluate before trusting it.
- **Evaluation harness** (not yet built): a fixed set of test messages with expected properties, run on every prompt/model change.
- **Frontend**: React chat UI consuming the SSE stream, with a "What TADBuddy remembers" page using `/v1/memories`.

---

## 10. v3 — Product architecture & roadmap

v2 fixes the engineering problems. To ship TADBuddy as a product, the gaps are safety,
measurable quality, and data responsibility.

### 10.1 Target pipeline

```
Request
 → auth + rate limit
 → INPUT GUARD      risk classifier → none / distress / crisis
                    crisis → fixed response + localized resources + human-review queue
 → CONTEXT BUILDER
     query rewrite    resolve follow-ups ("what about that?") into a standalone query using history
     hybrid search    BM25 (Postgres full-text) + vector, fused (e.g. reciprocal rank fusion)
     rerank           cross-encoder re-orders top-20 → keep 3
     memory           profile + last session summary + semantic memories
 → PROMPT           versioned templates (prompt_version stored on every message)
 → MODEL ROUTER     small model: extraction/classification · larger model: replies
 → GENERATION       GPU inference (vLLM, continuous batching)
 → OUTPUT GUARD     sentence-buffered check BEFORE text is streamed
 → stream to user
 → ASYNC WORKERS    memory update · session summary · analytics · eval sampling
```

### 10.2 Components

| Area | v2 | v3 |
|---|---|---|
| Safety | Keyword pre-check; post-check affects storage only | Trained risk classifier (keywords as fallback), risk-tiered responses, pre-stream output guard, human review queue, clinician-reviewed policy, per-locale verified crisis resources |
| Retrieval | Vector top-k + distance threshold | Query rewriting, hybrid BM25 + vector, cross-encoder reranker, curated KB written in TADBuddy's voice (verify dataset license for commercial use) |
| Memory | Semantic facts | Three layers: **profile** (explicit, user-editable facts), **episodic** (per-session summaries), **semantic** (existing) |
| Models | One configurable chat model | Router: small model for extraction/classification, larger for replies; LoRA fine-tune on reviewed conversations once there are a few thousand |
| Evaluation | `retrieval_logs` | Offline eval set (100–200 messages) scored for tone, rule-following, safety via LLM-judge + human spot checks; runs on every prompt/model change. Online: thumbs, return rate, safety-flag rate, latency; tracing (OpenTelemetry / Langfuse) |
| Background work | In-process tasks | Queue (Redis Streams / SQS) + workers |
| Privacy | Memory view/delete endpoints | Encryption at rest, PII redaction in logs, retention limits, consent flows, data export, compliance review (e.g. India DPDP Act; HIPAA if working with US providers) — confirm with legal counsel |
| Product | Chat | Mood check-ins, journaling, mood trends, onboarding, gentle reminders |
| Infra | docker-compose | Staging + production, CI/CD, infrastructure-as-code, feature flags for prompt/model A/B tests |

### 10.3 Schema additions

```
user_profiles     (user_id PK, preferred_name, goals jsonb, locale, consent_memory bool, updated_at)
session_summaries (id, conversation_id, user_id, summary, embedding vector(384), created_at)
safety_events     (id, message_id, risk_tier, classifier_score, reviewed_by, reviewed_at, outcome)
mood_checkins     (id, user_id, score smallint, note, created_at)
prompt_versions   (id, name, template, created_at)          -- messages.prompt_version references this
feedback          (id, message_id, rating smallint, comment, created_at)
eval_runs         (id, prompt_version, model, dataset_version, scores jsonb, created_at)
kb_documents      + tsv tsvector generated column + GIN index   -- for BM25-style hybrid search
```

### 10.4 Roadmap

| Phase | Goal | Exit criteria |
|---|---|---|
| 1 | v2 working end-to-end + React chat UI | Streamed replies, memory visible/deletable in UI |
| 2 | Quality | Eval set built; hybrid search + reranker added; model chosen by eval scores |
| 3 | Safety & privacy hardening | Classifier + pre-stream output guard; clinician-reviewed policy; privacy controls; legal review. **No real users before this phase is done.** |
| 4 | Scale | GPU inference (vLLM), queue workers, tracing/dashboards, staging/prod split |

---

## 11. Running it

```bash
cp .env.example .env            # fill DATABASE_URL
# Supabase SQL editor: run sql/001_schema.sql
docker compose up -d ollama redis
docker compose exec ollama ollama pull llama3.2:3b
docker compose run --rm api python -m scripts.ingest_kb
docker compose up api

curl -N -X POST localhost:8000/v1/chat \
  -H "X-User-Id: 00000000-0000-0000-0000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{"message": "I have been really overwhelmed with school lately"}'
```
