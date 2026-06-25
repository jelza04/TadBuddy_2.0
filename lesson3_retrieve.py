"""
Lesson 3: Retrieval -- find the most relevant rows for a new question.

Pipeline: embed the query -> ask Postgres for the closest vectors -> print them.

This is the "R" in RAG: given something a user just said, find the most
similar things already stored, using the same cosine-distance math from
Lesson 1 -- except now Postgres does it via the `<=>` operator, over every
row in `documents`, instead of us computing it by hand on 3 vectors.

Edit QUERY below and re-run to try different questions.

Run:
    docker compose run --rm rag-lessons python lesson3_retrieve.py
"""

import os

import psycopg2
from pgvector.psycopg2 import register_vector
from sentence_transformers import SentenceTransformer

DB_URL = os.environ["SUPABASE_DB_URL"]

QUERY = "I've been feeling really overwhelmed with school lately"

TOP_K = 5


def main():
    print("Loading embedding model...")
    model = SentenceTransformer("all-MiniLM-L6-v2")

    query_embedding = model.encode(QUERY)

    conn = psycopg2.connect(DB_URL)
    register_vector(conn)
    cur = conn.cursor()

    # `<=>` is pgvector's cosine *distance* operator. Note the direction flip
    # from Lesson 1: distance is the opposite of similarity -- 0 means
    # identical, larger means less alike. So ORDER BY ascending puts the
    # closest (most similar) rows first. No index yet: with only 200 rows,
    # Postgres just scans them all, which is instant. Indexing matters once
    # this is millions of rows, not 200 -- that's a later lesson.
    cur.execute(
        """
        select content, embedding <=> %s as distance
        from documents
        order by distance
        limit %s
        """,
        (query_embedding, TOP_K),
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()

    print(f"\nQuery: {QUERY}\n")
    for content, distance in rows:
        print(f"distance={distance:.4f}")
        print(content)
        print("-" * 40)


if __name__ == "__main__":
    main()
