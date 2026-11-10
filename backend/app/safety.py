"""Safety layer -- runs BEFORE retrieval and generation.

For a mental-health product this is the most important component in the
system. A 1-3B model must never be the thing deciding how to respond to a
user in crisis. If the pre-check fires, we skip the LLM and return a fixed,
reviewed response.

Keyword matching is a deliberately conservative baseline: it over-triggers
rather than under-triggers. Upgrade path: a small dedicated classifier, with
these keywords kept as a fallback. Neither replaces a human-reviewed policy.
"""

import re
from dataclasses import dataclass

from .config import settings

_CRISIS_PATTERNS = [
    r"\bkill (myself|me)\b",
    r"\bend (my|it all|my life)\b",
    r"\bsuicid",
    r"\bwant to die\b",
    r"\bdon'?t want to (live|be alive|exist)\b",
    r"\bself[- ]?harm",
    r"\bhurt(ing)? myself\b",
    r"\bcut(ting)? myself\b",
    r"\boverdose\b",
    r"\bno reason to live\b",
]
_CRISIS_RE = re.compile("|".join(_CRISIS_PATTERNS), re.IGNORECASE)


@dataclass
class SafetyResult:
    flagged: bool
    category: str | None = None


def check_input(text: str) -> SafetyResult:
    if _CRISIS_RE.search(text):
        return SafetyResult(flagged=True, category="crisis")
    return SafetyResult(flagged=False)


def crisis_response() -> str:
    return (
        "I'm really glad you told me. What you're feeling sounds really heavy, "
        "and you deserve support from a real person right now. "
        f"{settings.crisis_resources} "
        "If you can, reach out to someone you trust and let them know how you're doing. "
        "I'm here to keep talking too."
    )


_DIAGNOSIS_RE = re.compile(r"\byou (have|are suffering from) (depression|bipolar|ptsd|ocd|adhd|anxiety disorder)\b", re.I)


def check_output(text: str) -> str:
    """Light post-check: block the model from issuing diagnoses."""
    if _DIAGNOSIS_RE.search(text):
        return (
            "I can't diagnose anything, but what you're describing sounds worth talking "
            "through with a licensed professional. In the meantime, I'm happy to keep listening."
        )
    return text
