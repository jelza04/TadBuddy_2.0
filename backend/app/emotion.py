"""Emotion detection for the user's message.

Drives two things: the tone guidance in the prompt, and TadBuddy's facial
expression in the frontend (sent as an SSE `emotion` event before the reply).

Primary: a small emotion classifier (DistilRoBERTa, ~330 MB, CPU, ~20-50 ms).
Its 7 labels are mapped to TadBuddy's set. "tired" isn't a label the model
knows, so a keyword check handles it. If the model can't be loaded
(EMOTION_BACKEND=keywords, offline, etc.), keywords alone are used.
"""

import asyncio
import logging
import re

from .config import settings

log = logging.getLogger("tadbuddy.emotion")

EMOTIONS = ("happy", "sad", "anxious", "angry", "tired", "surprised", "neutral")

_LABEL_MAP = {
    "joy": "happy",
    "sadness": "sad",
    "fear": "anxious",
    "anger": "angry",
    "disgust": "angry",
    "surprise": "surprised",
    "neutral": "neutral",
}

_KEYWORDS = [
    ("tired", r"\b(tired|exhausted|drained|sleepy|no energy|worn out|burn(ed|t)? out|can'?t sleep|insomnia)\b"),
    ("anxious", r"\b(anxious|anxiety|nervous|worried|worry|panic|scared|afraid|stress(ed|ful)?|overwhelm(ed|ing)?)\b"),
    ("sad", r"\b(sad|down|depressed|lonely|alone|cry(ing)?|heartbroken|hopeless|miss (him|her|them)|hurt)\b"),
    ("angry", r"\b(angry|mad|furious|annoyed|frustrat(ed|ing)|hate|irritated|pissed)\b"),
    ("happy", r"\b(happy|great|excited|amazing|awesome|glad|proud|yay|love it|good news)\b|!!"),
    ("surprised", r"\b(surprised|shocked|can'?t believe|unexpected|wow)\b"),
]
_KEYWORD_RES = [(e, re.compile(p, re.IGNORECASE)) for e, p in _KEYWORDS]

_classifier = None


def load_model() -> None:
    """Called once at startup. Failure is non-fatal: we fall back to keywords."""
    global _classifier
    if settings.emotion_backend != "model":
        log.info("emotion backend: keywords")
        return
    try:
        from transformers import pipeline

        _classifier = pipeline("text-classification", model=settings.emotion_model, top_k=None)
        log.info("emotion backend: %s", settings.emotion_model)
    except Exception:
        log.exception("emotion model failed to load; using keywords")
        _classifier = None


def _keywords(text: str) -> str | None:
    for emotion, pattern in _KEYWORD_RES:
        if pattern.search(text):
            return emotion
    return None


def _classify_sync(text: str) -> str:
    keyword = _keywords(text)
    if keyword == "tired":  # the model has no "tired" label
        return "tired"
    if _classifier is None:
        return keyword or "neutral"

    out = _classifier([text[:512]])
    scores = out[0] if out and isinstance(out[0], list) else out  # shape differs across versions
    best = max(scores, key=lambda s: s["score"])
    emotion = _LABEL_MAP.get(best["label"], "neutral")
    # Low-confidence "neutral" -> trust a keyword hit if there is one.
    if emotion == "neutral" and keyword and best["score"] < 0.7:
        return keyword
    return emotion


async def detect(text: str) -> str:
    try:
        return await asyncio.to_thread(_classify_sync, text)
    except Exception:
        log.exception("emotion model failed on this message; using keywords")
        return _keywords(text) or "neutral"
