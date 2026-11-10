// Highlight wellness-related keywords in journal/chat text
const KEYWORDS = [
  'happy', 'sad', 'anxious', 'anxiety', 'stress', 'stressed', 'tired', 'sleep',
  'headache', 'pain', 'energy', 'energized', 'calm', 'angry', 'lonely', 'grateful',
  'excited', 'overwhelmed', 'worried', 'relaxed', 'family', 'friends', 'work',
  'exercise', 'walk', 'breathing', 'rest', 'proud', 'nervous', 'hopeful',
]

const KEYWORD_RE = new RegExp(`\\b(${KEYWORDS.join('|')})\\b`, 'gi')

export interface TextPart {
  text: string
  highlight: boolean
}

export function splitKeywords(text: string): TextPart[] {
  const parts: TextPart[] = []
  let last = 0
  for (const m of text.matchAll(KEYWORD_RE)) {
    const i = m.index ?? 0
    if (i > last) parts.push({ text: text.slice(last, i), highlight: false })
    parts.push({ text: m[0], highlight: true })
    last = i + m[0].length
  }
  if (last < text.length) parts.push({ text: text.slice(last), highlight: false })
  return parts
}

export function extractKeywords(text: string): string[] {
  const found = new Set<string>()
  for (const m of text.matchAll(KEYWORD_RE)) found.add(m[0].toLowerCase())
  return [...found]
}
