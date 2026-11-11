import type { TadMood } from '../components/TadFace'

/** Emotions the backend detects in the user's message (see tadbuddy-v2/app/emotion.py). */
export type UserEmotion = 'happy' | 'sad' | 'anxious' | 'angry' | 'tired' | 'surprised' | 'neutral'

/** How TadBuddy reacts to each feeling — empathy, not mirroring (anger → calm, not angry). */
export const REACTION: Record<UserEmotion, TadMood> = {
  happy: 'excited',
  sad: 'concerned',
  anxious: 'calm',
  angry: 'calm',
  tired: 'sleepy',
  surprised: 'surprised',
  neutral: 'good',
}

/** Little status line under the avatar for each expression. */
export const STATUS: Partial<Record<TadMood, string>> = {
  listening: 'Listening…',
  concerned: "I'm here with you",
  calm: 'Breathe with me',
  excited: 'Yay!',
  sleepy: 'Rest is good',
  surprised: 'Oh!',
}

// Instant, client-side guess so TadBuddy reacts the moment you hit send.
// The backend's classifier result (SSE `emotion` event) replaces it a moment later.
const PATTERNS: Array<[UserEmotion, RegExp]> = [
  ['tired', /\b(tired|exhausted|drained|sleepy|no energy|worn out|burn(ed|t)? out|can'?t sleep|insomnia)\b/i],
  ['anxious', /\b(anxious|anxiety|nervous|worried|worry|panic|scared|afraid|stress(ed|ful)?|overwhelm(ed|ing)?)\b/i],
  ['sad', /\b(sad|down|depressed|lonely|alone|cry(ing)?|heartbroken|hopeless|hurt)\b/i],
  ['angry', /\b(angry|mad|furious|annoyed|frustrat(ed|ing)|hate|irritated)\b/i],
  ['happy', /\b(happy|great|excited|amazing|awesome|glad|proud|yay|good news)\b|!!/i],
  ['surprised', /\b(surprised|shocked|can'?t believe|unexpected|wow)\b/i],
]

export function guessEmotion(text: string): UserEmotion {
  return PATTERNS.find(([, re]) => re.test(text))?.[0] ?? 'neutral'
}

export function isUserEmotion(value: unknown): value is UserEmotion {
  return typeof value === 'string' && value in REACTION
}
