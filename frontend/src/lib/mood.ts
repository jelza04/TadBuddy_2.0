export interface MoodMeta {
  label: string
  comment: string
}

// Warm, empathetic responses per score (1–10)
export const MOOD_RESPONSES: Record<number, MoodMeta> = {
  1: {
    label: 'Really struggling',
    comment:
      "I'm so glad you told me. A 1 is a heavy day, and you don't have to carry it alone. I'm right here with you — let's take this one small breath at a time.",
  },
  2: {
    label: 'Very low',
    comment:
      "Thank you for being honest with me. Days like this are hard, and your feelings are completely valid. I'm here to listen for as long as you need.",
  },
  3: {
    label: 'Low',
    comment:
      "That sounds tough. Even showing up to check in today took strength — I noticed. Want to tell me a little about what's weighing on you?",
  },
  4: {
    label: 'A bit down',
    comment:
      "A little cloudy today, huh? That's okay — not every day has to be sunshine. I'm here, and I'd love to hear what's on your mind.",
  },
  5: {
    label: 'Okay',
    comment:
      "Right in the middle — perfectly human. Sometimes 'okay' is enough. Is there anything small we could do together to nudge the day a little brighter?",
  },
  6: {
    label: 'Not bad',
    comment:
      "A gentle 6 — I'll take it! You're doing better than you might give yourself credit for. What's been going well today?",
  },
  7: {
    label: 'Good',
    comment:
      "A solid 7! Something's working. I'd love to hear what's giving your day its glow — noticing the good stuff helps it grow.",
  },
  8: {
    label: 'Great',
    comment:
      "An 8! That warms my squishy little circuits. Whatever you're doing, it suits you. Tell me about it?",
  },
  9: {
    label: 'Wonderful',
    comment:
      "A 9?! I'm practically inflating with joy for you. Days like this deserve to be remembered — want to jot down what made it special?",
  },
  10: {
    label: 'Amazing',
    comment:
      "A perfect 10! *happy robot noises* I'm so happy I could pop. Soak it in — you've earned every bit of this feeling.",
  },
}

export function moodColor(score: number): string {
  if (score <= 4) return 'text-primary'
  if (score <= 6) return 'text-amber-600'
  return 'text-emerald-600'
}

export function moodBg(score: number): string {
  if (score <= 4) return 'bg-[#fff1f2]'
  if (score <= 6) return 'bg-[#fffbeb]'
  return 'bg-[#f0fdf4]'
}

export function moodBarColor(score: number): string {
  if (score <= 4) return 'bg-primary'
  if (score <= 6) return 'bg-amber-500'
  return 'bg-emerald-500'
}

export function moodLabel(score: number): string {
  return MOOD_RESPONSES[Math.max(1, Math.min(10, Math.round(score)))].label
}
