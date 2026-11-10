const CRISIS_PATTERNS = [
  /suicid/i,
  /kill (myself|me)/i,
  /end (my|it all|everything)/i,
  /self[- ]harm/i,
  /hurt (myself|me)/i,
  /don'?t want to (live|be here|exist)/i,
  /no reason to live/i,
  /want to die/i,
]

export function detectCrisis(text: string): boolean {
  return CRISIS_PATTERNS.some((p) => p.test(text))
}

export const CRISIS_MESSAGE =
  "I care about you, and what you just shared sounds really serious. I'm not able to give the support you deserve right now — but real people can, and they want to. " +
  "Please consider reaching out to a crisis helpline (in the US, call or text 988; elsewhere, findahelpline.com lists local numbers) or someone you trust. " +
  "You matter, and you don't have to face this alone. I'll stay right here with you too."
