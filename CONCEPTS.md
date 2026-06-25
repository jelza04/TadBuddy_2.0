# Core Concepts Checklist

Check off (`[ ]` → `[x]`) anything you already feel solid on. Leave the rest unchecked — that tells me what to slow down for.

## Embeddings & Vectors
- [ ] Embedding — turning a piece of text into a list of numbers (a "vector") that stands in for its meaning
- [ ] Vector dimensions — how many numbers are in that list (ours is 384); the database column and the model must agree on this number
- [ ] Pre-trained model vs. training — the embedding model already learned to do this before we touched it; we never adjust it, just use it as a tool
- [ ] Cosine similarity / cosine distance — a way to measure how close two vectors are; similarity and distance point in opposite directions (low distance = high similarity)

## Search & Retrieval
- [ ] Nearest-neighbor search (k-NN) — given a new vector, find the K closest vectors already stored, by comparing distances
- [ ] Retrieval — the RAG step where we find relevant stored material for a new question, before writing a reply
- [ ] Sequential scan vs. index — right now Postgres checks every single row to find the closest match (fine at 200 rows); an index speeds this up at scale (not needed yet, comes later)

## Storage (pgvector / Postgres)
- [ ] pgvector — a Postgres add-on that lets a column store vectors and lets SQL sort/filter by distance directly
- [ ] Distance operators (`<=>`, `<->`, `<#>`) — different formulas for "how far apart are two vectors"; we use `<=>` (cosine distance)

## Generation (the LLM half)
- [ ] Prompt — the text you actually send an AI model: instructions + retrieved examples + the user's message, combined
- [ ] Augmentation — stuffing retrieved material into the prompt so the model has real grounding instead of guessing from memory
- [ ] Local LLM (via Ollama) — running the text-generating model on your own machine instead of calling a paid API
- [ ] Context window — the limit on how much text a model can take in at once; bigger prompts can dilute or slow a small model down

## Data Quality (already hit these for real)
- [x] Duplicate data — identical input text produces identical vectors, which tie in search and crowd out other results (Lesson 2/3, already fixed)

## Engineering / Infra
- [x] Environment variables (`.env`) — keeping secrets like passwords out of code, injected at runtime instead
- [x] Docker image vs. container — the image is the packaged blueprint; a container is a running copy of it
- [ ] Docker volume — storage outside the container that survives even if the container gets deleted/rebuilt
- [x] docker-compose — running multiple containers together (your script + the Ollama model server) so they can reach each other by name

I'll add to this as later lessons introduce new ideas.
