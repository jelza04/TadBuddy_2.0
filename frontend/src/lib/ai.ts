import { XAI_API_KEY, XAI_MODEL, XAI_URL, SYSTEM_PROMPT } from '../config/ai'
import { BackendError, backendEnabled, streamFromBackend, type StreamOptions } from './backend'
import type { ChatMessage } from './types'

export interface ReplyOptions extends StreamOptions {
  userName?: string
}

/**
 * Streams TadBuddy's reply token by token via onToken; resolves with full text.
 *
 * Priority: TADBuddy v2 API (RAG + memory + emotion) → xAI direct → built-in mock.
 */
export async function streamReply(
  history: ChatMessage[],
  userText: string,
  onToken: (partial: string) => void,
  options: ReplyOptions = {}
): Promise<string> {
  const { userName, ...streamOptions } = options
  if (backendEnabled() && userName) {
    try {
      return await streamFromBackend(userName, userText, onToken, streamOptions)
    } catch (err) {
      // Friendly, specific messages (rate limit / busy) are shown as-is.
      if (err instanceof BackendError && !err.message.startsWith('TADBuddy API error')) {
        onToken(err.message)
        return err.message
      }
      console.warn('TADBuddy API unavailable, falling back', err)
    }
  }
  if (XAI_API_KEY) {
    try {
      return await streamFromXAI(history, userText, onToken)
    } catch {
      // fall through to mock so the UX never dead-ends
    }
  }
  return mockStream(userText, onToken)
}

async function streamFromXAI(
  history: ChatMessage[],
  userText: string,
  onToken: (partial: string) => void
): Promise<string> {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.slice(-20).map((m) => ({ role: m.role, content: m.text })),
    { role: 'user', content: userText },
  ]
  const res = await fetch(XAI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${XAI_API_KEY}` },
    body: JSON.stringify({ model: XAI_MODEL, messages, stream: true }),
  })
  if (!res.ok || !res.body) throw new Error(`xAI error ${res.status}`)

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let full = ''
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const data = line.replace(/^data: /, '').trim()
      if (!data || data === '[DONE]') continue
      try {
        const json = JSON.parse(data)
        const delta: string = json.choices?.[0]?.delta?.content ?? ''
        if (delta) {
          full += delta
          onToken(full)
        }
      } catch {
        // partial JSON chunk — wait for more
      }
    }
  }
  return full
}

// ---------- Mock mode (no API key yet) ----------
const MOCK_REPLIES: Array<{ match: RegExp; reply: string }> = [
  {
    match: /headache|migraine|head hurts/i,
    reply:
      "Ouch, headaches are no fun. A screen break, a glass of water, and dimming the lights can sometimes help. I'm not a medical professional though — if it's severe or keeps coming back, please check in with a doctor. How long has it been bothering you?",
  },
  {
    match: /tired|exhausted|sleep|insomnia/i,
    reply:
      "Rest is one of the kindest things you can give yourself. A wind-down routine — dim lights, no screens, slow breathing — can work little wonders. Want me to walk you through a 1-minute breathing exercise?",
  },
  {
    match: /stress|anxious|anxiety|overwhelm/i,
    reply:
      "That sounds like a lot to hold. Let's soften it together: try breathing in for 4, holding for 4, out for 6. Even one round helps. I'm here — what's the biggest thing on your mind right now?",
  },
  {
    match: /happy|great|good|excited|amazing/i,
    reply:
      "That makes my squishy circuits light up! Savoring good moments actually helps them stick. What made today feel this way?",
  },
  {
    match: /sad|down|lonely|cry/i,
    reply:
      "I'm really glad you told me. Feelings like this deserve gentleness, not judgment. I'm right here with you. Would talking through it help, or would you rather I suggest something comforting to try?",
  },
]

const MOCK_DEFAULT =
  "Thank you for sharing that with me. I'm listening — tell me more about how that's been feeling for you. And remember, I'm your friendly companion, not a medical professional, so for anything serious a real-life clinician is your best buddy."

function mockStream(userText: string, onToken: (partial: string) => void): Promise<string> {
  const reply = MOCK_REPLIES.find((r) => r.match.test(userText))?.reply ?? MOCK_DEFAULT
  return new Promise((resolve) => {
    const words = reply.split(' ')
    let i = 0
    let acc = ''
    const timer = setInterval(() => {
      acc += (i ? ' ' : '') + words[i]
      onToken(acc)
      i++
      if (i >= words.length) {
        clearInterval(timer)
        resolve(acc)
      }
    }, 45)
  })
}
