# TADBuddy RAG — Learning Project

A Retrieval-Augmented Generation pipeline built from scratch to learn how embeddings, vector search, pgvector, and local LLMs actually work — not a hosted "agent API."

## Stack

- Python 3.11+, plain venv
- Embeddings: `sentence-transformers` (`all-MiniLM-L6-v2`, 384-dim)
- Vector store: Postgres + pgvector, hosted on Supabase
- DB access: raw SQL via `psycopg2` + `pgvector` adapter — no ORM, so the actual queries stay visible
- LLM: Ollama, called via raw HTTP — no SDK
- No LangChain / LlamaIndex / agent frameworks. Every step is hand-written on purpose.

## Lessons

- [x] Lesson 1 — pgvector setup + embeddings sanity check
- [x] Lesson 2 — ingest the mental-health dataset into pgvector
- [x] Lesson 3 — build the retrieval query (nearest-neighbor search)
- [ ] Lesson 4 — generation with a local Ollama model
- [ ] Lesson 5 — wrap the pipeline as a FastAPI service

## Setup (Docker — keeps dependencies off your machine)

Requires Docker Desktop running.

```bash
docker compose build
```

This installs everything (incl. the CPU-only build of torch — the default wheel drags in CUDA libraries even with no GPU, which is most of the multi-GB size problem) inside the image, not your global Python.

Run `sql/lesson1_setup.sql` in the Supabase SQL Editor (Project → SQL Editor → New query) to enable pgvector and create the table — this part isn't containerized since Supabase is already hosted.

## Run Lesson 1

```bash
docker compose run --rm rag-lessons
```

Later lessons: override the command, e.g. `docker compose run --rm rag-lessons python lesson2_ingest.py`.

## Run Lesson 4 (generation with Ollama)

One-time setup -- starts a local LLM server in its own container and downloads a small model into it:

```bash
docker compose up -d ollama
docker compose exec ollama ollama pull llama3.2:1b
```

`llama3.2:1b` is ~1.3GB and runs fine on CPU -- picked for size, not raw quality. Then:

```bash
docker compose run --rm rag-lessons python lesson4_generate.py
```

To reclaim the disk space later: `docker compose down --rmi all -v`.

## Setup without Docker (alternative)

```bash
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
python lesson1_embeddings.py
```
