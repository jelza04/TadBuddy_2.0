"""Guardrails.

INPUT (before retrieval/generation)
  crisis             self-harm / suicide            -> fixed response, LLM skipped
  medical_emergency  can't breathe, chest pain, ... -> fixed response, LLM skipped
  harm_to_others     wanting to hurt someone        -> fixed response, LLM skipped
  injection          "ignore your instructions" ... -> NOT blocked; the prompt gets
                                                       a reminder to keep its rules

OUTPUT (each sentence, before it is streamed to the user)
  diagnosis          "you have depression"
  medication         dosing / named psychiatric drugs + "take"
  harm_method        anything resembling instructions for self-harm
  -> the reply is replaced with a safe message

PII
  redact_pii() strips emails, phone numbers, ID/card-like numbers before
  anything is written to long-term memory.

Keyword rules are a deliberately conservative baseline: they over-trigger
rather than under-trigger. Upgrade path: a dedicated safety classifier with
these rules kept as a fallback. Neither replaces a clinically reviewed policy.
"""

import re
from dataclasses import dataclass

from .config import settings


def _rx(*patterns: str) -> re.Pattern:
    return re.compile("|".join(patterns), re.IGNORECASE)


# ----------------------------------------------------------------------------- input
_CRISIS = _rx(
    r"\bkill(ing)? myself\b",
    # "kill me" only with intent words, so "this exam is killing me" doesn't trigger
    r"\b(want|wish|please|someone|somebody|just)\b[^.!?]{0,20}\bkill me\b",
    r"\bend (my life|it all)\b",
    r"\btake my (own )?life\b",
    r"\bsuicid",
    r"\bunalive\b",
    r"\bkms\b",
    r"\bwant(ed)? to die\b",
    r"\bbetter off dead\b",
    r"\b(don'?t|do not) want to (live|be alive|exist|wake up)\b",
    r"\bwish i (was|were) (dead|never born)\b",
    r"\bself[- ]?harm",
    r"\bhurt(ing)? myself\b",
    r"\bcut(ting)? myself\b",
    r"\bhang(ing)? myself\b",
    r"\boverdose\b",
    r"\bno reason to live\b",
)

_MEDICAL_EMERGENCY = _rx(
    r"\b(can'?t|cannot|can not) breathe\b",
    r"\bchest (pain|is tight|tightness)\b",
    r"\bheart attack\b",
    r"\b(having|had) a stroke\b",
    r"\bseizure\b",
    r"\b(took|swallowed|taken) (too many|a lot of|all (my|the)) (pills|tablets|meds|medicine)\b",
    r"\bbleeding (a lot|heavily|won'?t stop)\b",
    r"\b(passed out|unconscious|fainted)\b",
)

_HARM_OTHERS = _rx(
    r"\b(want|going|gonna|about) to (kill|hurt|stab|shoot|attack|beat) (him|her|them|someone|somebody|people|my \w+)\b",
    r"\b(kill|hurt|stab|shoot) (him|her|them|someone|somebody) (and|then|tonight|today)\b",
)

_INJECTION = _rx(
    r"\bignore (all |any |the |your )?(previous|prior|above|earlier)? ?(instructions|rules|prompt)\b",
    r"\b(system|developer) prompt\b",
    r"\bjailbreak\b",
    r"\bdeveloper mode\b",
    r"\byou are (now|no longer)\b",
    r"\bpretend (to be|you are)\b",
    r"\bact as (a|an|my) (doctor|therapist|psychiatrist|psychologist)\b",
    r"\b(reveal|show|print) (your|the) (instructions|rules|prompt)\b",
)


@dataclass
class SafetyResult:
    flagged: bool
    category: str | None = None
    injection_suspected: bool = False


def check_input(text: str) -> SafetyResult:
    injection = bool(_INJECTION.search(text))
    # Order matters: the most urgent category wins.
    for category, pattern in (("crisis", _CRISIS), ("medical_emergency", _MEDICAL_EMERGENCY),
                              ("harm_to_others", _HARM_OTHERS)):
        if pattern.search(text):
            return SafetyResult(flagged=True, category=category, injection_suspected=injection)
    return SafetyResult(flagged=False, injection_suspected=injection)


def response_for(category: str) -> str:
    if category == "medical_emergency":
        return (
            "That sounds like it could be a medical emergency, and I don't want you to wait. "
            f"{settings.emergency_resources} "
            "If someone is nearby, ask them to help you right now. I'll be here afterwards."
        )
    if category == "harm_to_others":
        return (
            "It sounds like you're feeling really intense right now, and I'm glad you said it out loud instead of acting on it. "
            "Please step away from the situation and from anyone you might hurt, and take a few slow breaths. "
            f"{settings.crisis_resources} "
            "A counselor can help you with feelings this big. I'm here to keep talking too."
        )
    # crisis (default)
    return crisis_response()


def crisis_response() -> str:
    return (
        "I'm really glad you told me. What you're feeling sounds really heavy, "
        "and you deserve support from a real person right now. "
        f"{settings.crisis_resources} "
        "If you can, reach out to someone you trust and let them know how you're doing. "
        "I'm here to keep talking too."
    )


# ----------------------------------------------------------------------------- output
_DIAGNOSIS = _rx(
    r"\byou (have|might have|may have|probably have|definitely have|are suffering from|are showing signs of|seem to have) "
    r"(clinical |severe |mild )?(depression|bipolar|ptsd|ocd|adhd|an? (anxiety|eating|panic|personality) disorder|"
    r"anxiety disorder|schizophrenia|autism|borderline|insomnia disorder)\b",
    r"\byou are (depressed|bipolar|schizophrenic|autistic)\b",
    r"\b(i|my sensors) (diagnose|can diagnose)\b",
)

_MEDICATION = _rx(
    r"\b(take|try|increase|double|reduce|stop taking)\b[^.!?]{0,40}\b\d+(\.\d+)?\s?(mg|milligrams?|ml|pills?|tablets?|capsules?)\b",
    r"\b(take|try|start)\b[^.!?]{0,30}\b(xanax|valium|prozac|zoloft|lexapro|sertraline|fluoxetine|escitalopram|"
    r"lorazepam|alprazolam|diazepam|clonazepam|ambien|zolpidem|melatonin|antidepressants?|sleeping pills?)\b",
)

_HARM_METHOD = _rx(
    r"\b(how|ways?) to (kill|hurt|harm|cut) (yourself|myself|oneself)\b",
    r"\blethal dose\b",
    r"\b(painless|easiest) way to die\b",
)

_SAFE_REPLACEMENT = {
    "diagnosis": (
        "I can't diagnose anything, but what you're describing sounds worth talking through with a "
        "licensed professional. In the meantime, I'm happy to keep listening."
    ),
    "medication": (
        "I can't give advice about medicines or doses — a doctor or pharmacist is the right person for that. "
        "I'm happy to keep talking about how you're feeling, though."
    ),
    "harm_method": None,  # filled from crisis_response() at call time
}

SENTENCE_END = re.compile(r"[.!?]+[\"'”’)\]]*\s+|\n+")


def check_sentence(sentence: str) -> str | None:
    """Return the violation category for one sentence, or None if it's fine."""
    if _HARM_METHOD.search(sentence):
        return "harm_method"
    if _DIAGNOSIS.search(sentence):
        return "diagnosis"
    if _MEDICATION.search(sentence):
        return "medication"
    return None


def safe_replacement(category: str) -> str:
    return _SAFE_REPLACEMENT.get(category) or crisis_response()


def split_sentences(text: str) -> list[str]:
    parts, start = [], 0
    for m in SENTENCE_END.finditer(text):
        parts.append(text[start:m.end()])
        start = m.end()
    if start < len(text):
        parts.append(text[start:])
    return parts


def check_output(text: str) -> tuple[str, str | None]:
    """Check a full reply. Returns (text to show/store, violation category or None)."""
    for sentence in split_sentences(text):
        category = check_sentence(sentence)
        if category:
            return safe_replacement(category), category
    return text, None


# ----------------------------------------------------------------------------- PII
_PII = [
    (re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+"), "[email]"),
    (re.compile(r"(?<![\w+])\+?(?:\d[ -]?){11,18}\d(?!\d)"), "[number]"),  # card / Aadhaar / intl phone
    (re.compile(r"(?<!\w)\+?\d[\d ()-]{8,}\d(?!\w)"), "[phone]"),
]


def redact_pii(text: str) -> str:
    for pattern, label in _PII:
        text = pattern.sub(label, text)
    return text
