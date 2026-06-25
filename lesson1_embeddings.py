"""
Lesson 1: Embeddings sanity check.

Goal: prove that sentence embeddings capture meaning -- semantically similar
sentences should land closer together in vector space than unrelated ones.
That gap is the entire mechanism RAG retrieval relies on.

Run:
    python lesson1_embeddings.py
"""

from sentence_transformers import SentenceTransformer
import numpy as np

# all-MiniLM-L6-v2 outputs 384-dimensional vectors. This number has to match
# the `vector(384)` column created in sql/lesson1_setup.sql -- every embedding
# model has a fixed output size baked into its architecture.
model = SentenceTransformer("all-MiniLM-L6-v2")

sentences = [
    "I feel anxious today",
    "I'm stressed about work",
    "The weather is nice",
]

vecs = model.encode(sentences)
print("Shape:", vecs.shape)  # expect (3, 384)
print("First 5 numbers of vector 0:", vecs[0][:5])


def cosine_sim(a, b):
    """Same math pgvector's `<=>` operator runs under the hood."""
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))


sim_anxious_stressed = cosine_sim(vecs[0], vecs[1])
sim_anxious_weather = cosine_sim(vecs[0], vecs[2])

print(f"\nanxious vs. stressed about work: {sim_anxious_stressed:.4f}")
print(f"anxious vs. weather:              {sim_anxious_weather:.4f}")

assert sim_anxious_stressed > sim_anxious_weather, (
    "Expected the two emotionally-related sentences to be more similar than "
    "the unrelated one -- if this fails, something's off."
)
print("\nConfirmed: emotionally related sentences are closer in vector space.")
