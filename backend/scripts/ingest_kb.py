"""Load the counseling dataset into kb_documents (v2 schema).

Differences from rag-learning/lesson2_ingest.py:
- Context and response stored in separate columns.
- Dedup enforced by a UNIQUE content_hash -> safe to re-run (idempotent).
- Embeddings normalized + batched (encode 64 at a time, far faster than 1 by 1).
- Records which embedding model produced each vector.

Run:  docker compose run --rm api python -m scripts.ingest_kb
"""

import hashlib
import os

import psycopg
from datasets import load_dataset
from pgvector.psycopg import register_vector
from sentence_transformers import SentenceTransformer

DB_URL = os.environ["DATABASE_URL"]
MODEL = os.environ.get("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
SOURCE = "Amod/mental_health_counseling_conversations"
MAX_RESPONSE_CHARS = int(os.environ.get("MAX_RESPONSE_CHARS", 1200))
BATCH = 64


def main():
    rows, seen = [], set()
    for r in load_dataset(SOURCE, split="train"):
        ctx, resp = (r["Context"] or "").strip(), (r["Response"] or "").strip()
        if not ctx or not resp or len(resp) > MAX_RESPONSE_CHARS:
            continue
        h = hashlib.sha256(" ".join(ctx.lower().split()).encode()).hexdigest()
        if h in seen:
            continue
        seen.add(h)
        rows.append((ctx, resp, h))
    print(f"{len(rows)} unique rows after filtering")

    model = SentenceTransformer(MODEL)
    with psycopg.connect(DB_URL, prepare_threshold=None) as conn:
        register_vector(conn)
        with conn.cursor() as cur:
            for i in range(0, len(rows), BATCH):
                batch = rows[i:i + BATCH]
                vecs = model.encode([b[0] for b in batch], normalize_embeddings=True, batch_size=BATCH)
                cur.executemany(
                    """
                    insert into kb_documents (source, context, response, content_hash, embedding, embedding_model)
                    values (%s, %s, %s, %s, %s, %s)
                    on conflict (content_hash) do nothing
                    """,
                    [(SOURCE, c, r, h, v, MODEL) for (c, r, h), v in zip(batch, vecs)],
                )
                conn.commit()
                print(f"  {min(i + BATCH, len(rows))}/{len(rows)}")
    print("done")


if __name__ == "__main__":
    main()
