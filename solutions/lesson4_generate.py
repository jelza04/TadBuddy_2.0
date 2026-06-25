"""
Lesson 4: Generation -- turn retrieved context into an actual answer.

Pipeline: embed query -> retrieve top-k (same as Lesson 3) -> stuff the
retrieved Context/Response pairs into a prompt -> send that prompt to a
local LLM running in Ollama -> print what it says.

This is the "G" in RAG: the model was never trained on TADBuddy's data.
We hand it relevant examples at request time and ask it to use them,
instead of fine-tuning anything.

Setup (one-time, before running this):
    docker compose up -d ollama
    docker compose exec ollama ollama pull llama3.2:1b

Run:
    docker compose run --rm rag-lessons python lesson4_generate.py
"""

import os

import psycopg2
import requests
from pgvector.psycopg2 import register_vector
from sentence_transformers import SentenceTransformer

DB_URL = os.environ["SUPABASE_DB_URL"]

# Inside docker-compose this is set to http://ollama:11434 (the service name
# from docker-compose.yml). The localhost fallback is only for the no-Docker
# venv path, where Ollama would be running directly on your machine.
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")

MODEL = "llama3.2:1b"

QUERY = "I've been feeling really overwhelmed with school lately"

# Fewer than Lesson 3's 5 -- a 1B model has a small context window and does
# better with 2-3 focused examples than 5 (more text isn't always better
# for a small model; it can dilute or confuse the answer).
TOP_K = 3


def retrieve(query: str, top_k: int):
    """Same retrieval as Lesson 3: embed the query, pull the closest rows."""
    model = SentenceTransformer("all-MiniLM-L6-v2")
    query_embedding = model.encode(query)

    conn = psycopg2.connect(DB_URL)
    register_vector(conn)
    cur = conn.cursor()
    cur.execute(
        """
        select content
        from documents
        order by embedding <=> %s
        limit %s
        """,
        (query_embedding, top_k),
    )
    rows = [r[0] for r in cur.fetchall()]
    cur.close()
    conn.close()
    return rows


def build_prompt(query: str, retrieved: list[str]) -> str:
    """This is the 'Augmented' step. We're not fine-tuning the model on this
    data -- we're pasting relevant examples directly into the prompt so it
    has grounded material to draw from, instead of answering purely from
    whatever it memorized during training."""
    context_block = "\n\n".join(retrieved)
    return f"""You are TADBuddy, a supportive wellness companion. You are not a
licensed therapist and you do not diagnose. Use the example conversations
below only as a guide for tone and the kind of advice that helps. Do not
copy them word-for-word, and do not mention that examples were given to you.

Example conversations:
{context_block}

Now respond to this person in a warm, concise way (3-5 sentences):
{query}
"""


def generate(prompt: str) -> str:
    """Calls Ollama's HTTP API directly -- no SDK, just a POST request.
    stream=False means we wait and get one full JSON response back, instead
    of a stream of partial tokens we'd have to piece together ourselves."""
    response = requests.post(
        f"{OLLAMA_URL}/api/generate",
        json={"model": MODEL, "prompt": prompt, "stream": False},
        timeout=120,
    )
    response.raise_for_status()
    return response.json()["response"]


def main():
    print(f"Query: {QUERY}\n")

    print("Retrieving relevant context...")
    retrieved = retrieve(QUERY, TOP_K)

    print("Building prompt...")
    prompt = build_prompt(QUERY, retrieved)

    print(f"Generating with {MODEL} (slower on first call, CPU-only)...\n")
    answer = generate(prompt)

    print("--- TADBuddy says ---")
    print(answer)


if __name__ == "__main__":
    main()
