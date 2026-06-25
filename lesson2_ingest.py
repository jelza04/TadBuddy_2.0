"""
Lesson 2: Ingest the mental-health counseling dataset into pgvector.

Pipeline: load dataset -> decide what to embed vs. store -> embed -> insert.

Design decision: we embed only the *Context* (the person's situation/question),
not the Response. Why -- at query time (Lesson 3) we'll embed a real user's
message and compare it against these vectors. A user's message looks like a
Context, not a Response, so embedding Context is what makes the comparison
apples-to-apples. We still store Context + Response together as `content`,
so once a row is retrieved the LLM gets the full exchange as grounding.

Run:
    docker compose run --rm rag-lessons python lesson2_ingest.py
"""

import os

import psycopg2
from pgvector.psycopg2 import register_vector
from datasets import load_dataset
from sentence_transformers import SentenceTransformer

DB_URL = os.environ["SUPABASE_DB_URL"]

# Keep this small for the first run -- we're verifying the pipeline works,
# not loading the full ~3.5k rows yet. Bump it up once this looks right.
MAX_ROWS = 200

# Some entries in this dataset are long clinical transcripts (trauma, suicide,
# abuse) -- heavier than TADBuddy's intended tone. A length cap is a blunt
# first filter; real content filtering is a separate task before this is
# anywhere near production.
MAX_RESPONSE_CHARS = 1000


def main():
    print("Loading dataset...")
    dataset = load_dataset("Amod/mental_health_counseling_conversations", split="train")

    print("Loading embedding model...")
    model = SentenceTransformer("all-MiniLM-L6-v2")

    conn = psycopg2.connect(DB_URL)
    register_vector(conn)  # teaches psycopg2 how to send/receive the vector type
    cur = conn.cursor()

    inserted = 0
    seen_contexts = set()
    for row in dataset:
        if inserted >= MAX_ROWS:
            break

        context = (row["Context"] or "").strip()
        response = (row["Response"] or "").strip()

        if not context or not response:
            continue
        if context in seen_contexts:
            # This dataset has multiple counselors answering the same
            # question. Since we embed Context only, duplicate Contexts
            # produce identical vectors -- they'd tie in retrieval and crowd
            # out genuinely different results. Keep just the first one.
            continue
        if len(response) > MAX_RESPONSE_CHARS:
            continue

        seen_contexts.add(context)
        embedding = model.encode(context)
        content = f"User: {context}\nCounselor: {response}"

        cur.execute(
            "insert into documents (content, embedding) values (%s, %s)",
            (content, embedding),
        )
        inserted += 1

    conn.commit()
    cur.close()
    conn.close()
    print(f"Inserted {inserted} rows into documents.")


if __name__ == "__main__":
    main()
