import os

import psycopg2
from pgvector.psycopg2 import register_vector
from sentence_transformers import SentenceTransformer

DB_URL = os.environ["SUPABASE_DB_URL"]


def retrieve(query, top_k):
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
    rows = cur.fetchall()
    cur.close()
    conn.close()

    results = [row[0] for row in rows]
    return results


def main():
    results = retrieve("I've been feeling really overwhelmed with school lately", 3)
    print(results)


if __name__ == "__main__":
    main()