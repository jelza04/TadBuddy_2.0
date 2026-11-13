/**
 * Client for the TADBuddy v2 API (../backend).
 *
 * Enabled when VITE_TADBUDDY_API_URL is set (e.g. http://localhost:8000).
 * The backend owns conversation history, RAG retrieval and long-term memory,
 * so the frontend only sends the new message + a conversation id.
 *
 * Identity: the backend runs in AUTH_MODE=dev and trusts an X-User-Id header
 * (a UUID). We mint one UUID per local user and keep it in localStorage.
 * Swap this for a real Supabase Auth JWT before deploying.
 */
import { load, save } from './storage'

export const API_URL: string = ((import.meta.env.VITE_TADBUDDY_API_URL as string | undefined) ?? '').replace(/\/$/, '')

export const backendEnabled = (): boolean => API_URL.length > 0

export interface Memory {
  id: number
  content: string
  importance: number
  last_seen_at: string
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

export function backendUserId(userName: string): string {
  const ids = load<Record<string, string>>('backendUserIds', {})
  const key = userName.toLowerCase()
  if (!ids[key]) {
    ids[key] = uuid()
    save('backendUserIds', ids)
  }
  return ids[key]
}

function conversationKey(userName: string) {
  return `conversation:${userName.toLowerCase()}`
}

function headers(userName: string): HeadersInit {
  return { 'Content-Type': 'application/json', 'X-User-Id': backendUserId(userName) }
}

export interface StreamOptions {
  /** today's 1–10 mood check-in, used to personalise the reply */
  moodScore?: number | null
  /** called once with the emotion detected in the user's message (before the reply streams) */
  onEmotion?: (emotion: string) => void
  /** extra context for this session, e.g. a symptom-check summary */
  context?: string | null
}

/**
 * Sends a message and streams the reply. onToken receives the full text so far.
 * Resolves with the final reply text.
 */
export async function streamFromBackend(
  userName: string,
  text: string,
  onToken: (partial: string) => void,
  options: StreamOptions = {},
  retried = false
): Promise<string> {
  const conversation_id = load<string | null>(conversationKey(userName), null)
  const res = await fetch(`${API_URL}/v1/chat`, {
    method: 'POST',
    headers: headers(userName),
    body: JSON.stringify({
      conversation_id,
      message: text,
      user_name: userName,
      mood_score: options.moodScore ?? null,
      context: options.context ?? null,
    }),
  })

  // Conversation was deleted server-side (e.g. DB reset) -> start a fresh one once.
  if (res.status === 404 && conversation_id && !retried) {
    save(conversationKey(userName), null)
    return streamFromBackend(userName, text, onToken, options, true)
  }
  if (res.status === 429) {
    // Rate limited. The server says why (per-minute vs daily) and when to retry.
    const detail = await res
      .json()
      .then((j) => (typeof j?.detail === 'string' ? j.detail : null))
      .catch(() => null)
    const wait = Number(res.headers.get('retry-after'))
    const when = wait > 0 && wait < 3600 ? ` (try again in about ${Math.max(1, Math.round(wait / 60))} min)` : ''
    throw new BackendError((detail ?? 'Give me a second to catch my breath — try again in a moment.') + when)
  }
  if (res.status === 503) throw new BackendError("I'm chatting with a lot of people right now. Try again in a few seconds?")
  if (!res.ok) throw new BackendError(`TADBuddy API error ${res.status}`)

  // Crisis / non-streamed replies come back as plain JSON.
  if (!(res.headers.get('content-type') ?? '').includes('text/event-stream')) {
    const json = await res.json()
    if (json.conversation_id) save(conversationKey(userName), json.conversation_id)
    onToken(json.reply)
    return json.reply as string
  }

  if (!res.body) throw new BackendError('Empty response from TADBuddy API')
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let full = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // SSE events are separated by a blank line.
    let sep: number
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, sep)
      buffer = buffer.slice(sep + 2)

      let event = 'message'
      let data = ''
      for (const line of raw.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim()
        else if (line.startsWith('data:')) data += line.slice(5).trim()
      }
      if (!data) continue

      try {
        const payload = JSON.parse(data)
        if (event === 'error') {
          throw new BackendError(payload.message ?? "I'm a bit overloaded right now. Try again in a moment?")
        } else if (event === 'emotion' && payload.emotion) {
          options.onEmotion?.(payload.emotion)
        } else if (event === 'meta' && payload.conversation_id) {
          save(conversationKey(userName), payload.conversation_id)
        } else if (event === 'replace' && typeof payload.text === 'string') {
          // Output guardrail fired: swap the reply for the safe version.
          full = payload.text
          onToken(full)
        } else if (event === 'message' && payload.token) {
          full += payload.token
          onToken(full)
        }
      } catch {
        // malformed event — skip it
      }
    }
  }
  return full
}

export async function fetchMemories(userName: string): Promise<Memory[]> {
  const res = await fetch(`${API_URL}/v1/memories`, { headers: headers(userName) })
  if (!res.ok) throw new BackendError(`TADBuddy API error ${res.status}`)
  return res.json()
}

export async function deleteMemory(userName: string, id?: number): Promise<void> {
  const url = id === undefined ? `${API_URL}/v1/memories` : `${API_URL}/v1/memories/${id}`
  const res = await fetch(url, { method: 'DELETE', headers: headers(userName) })
  if (!res.ok) throw new BackendError(`TADBuddy API error ${res.status}`)
}

/** Forget the current conversation locally (the server keeps its transcript). */
export function resetConversation(userName: string): void {
  save(conversationKey(userName), null)
}

export class BackendError extends Error {}
