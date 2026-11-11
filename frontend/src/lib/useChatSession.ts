/**
 * Shared chat logic for the full Chat screen and the floating mini chat:
 * sending, streaming, crisis handling, avatar expression, symptom-check
 * context, and ending a session ("satisfied with my care").
 */
import { useEffect, useRef, useState } from 'react'
import type { TadMood } from '../components/TadFace'
import { streamReply } from './ai'
import { backendEnabled, resetConversation } from './backend'
import { detectCrisis, CRISIS_MESSAGE } from './crisis'
import { guessEmotion, isUserEmotion, REACTION } from './emotion'
import { speak } from './speech'
import { useAppStore, useMyMessages, useMyMoods } from '../store/useAppStore'

/** The closing phrase the user can tap when they're done. Change the wording here. */
export const SATISFIED_PHRASE = "I'm all good — I'm satisfied with my care"

export const SIGN_OFF =
  "I'm so glad. Thank you for letting me look after you today. I'll wait right here in the corner — tap me whenever you need me."

/** How long TadBuddy holds its reaction after replying before relaxing to neutral. */
const HOLD_MS = 4000

/** Show the "satisfied" button once the user has said at least this many things. */
export const SATISFIED_AFTER = 2

export function useChatSession() {
  const messages = useMyMessages()
  const addMessage = useAppStore((s) => s.addMessage)
  const updateMessage = useAppStore((s) => s.updateMessage)
  const settings = useAppStore((s) => s.settings)
  const currentUser = useAppStore((s) => s.currentUser)
  const chatContext = useAppStore((s) => s.chatContext)
  const setChatContext = useAppStore((s) => s.setChatContext)
  const markContextOpened = useAppStore((s) => s.markContextOpened)
  const setBuddyDocked = useAppStore((s) => s.setBuddyDocked)
  const moods = useMyMoods()

  const [busy, setBusy] = useState(false)
  const [expression, setExpression] = useState<TadMood>('neutral')
  const [talking, setTalking] = useState(false)
  const holdTimer = useRef<ReturnType<typeof setTimeout>>()

  const context = chatContext && chatContext.user === currentUser ? chatContext : null

  const todayScore = (() => {
    const today = new Date().toISOString().slice(0, 10)
    const entries = moods.filter((m) => m.date === today)
    return entries.length ? entries[entries.length - 1].score : null
  })()

  // Messages since the last sign-off = the current session.
  const lastSignOff = messages.map((m) => m.text).lastIndexOf(SIGN_OFF)
  const sessionUserMessages = messages.slice(lastSignOff + 1).filter((m) => m.role === 'user').length

  useEffect(() => () => clearTimeout(holdTimer.current), [])

  // Coming from the symptom check: TadBuddy opens by referring to it (once).
  useEffect(() => {
    if (context && !context.openerShown) {
      addMessage('assistant', context.opener)
      markContextOpened()
      setExpression('concerned')
      relaxLater()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context?.createdAt])

  function relaxLater() {
    clearTimeout(holdTimer.current)
    holdTimer.current = setTimeout(() => setExpression('neutral'), HOLD_MS)
  }

  const holdStill = () => clearTimeout(holdTimer.current)

  const send = async (text: string) => {
    const clean = text.trim()
    if (!clean || busy) return
    holdStill()
    setBusy(true)
    setTalking(false)
    // React instantly with a local guess; the backend's classifier refines it a moment later.
    setExpression(REACTION[guessEmotion(clean)])
    addMessage('user', clean)

    if (detectCrisis(clean)) {
      setExpression('concerned')
      addMessage('assistant', CRISIS_MESSAGE)
      speak(CRISIS_MESSAGE, settings.ttsEnabled)
      setBusy(false)
      relaxLater()
      return
    }

    const placeholder = addMessage('assistant', '…')
    try {
      const full = await streamReply(
        messages,
        clean,
        (partial) => {
          setTalking(true)
          updateMessage(placeholder.id, partial)
        },
        {
          userName: currentUser ?? undefined,
          moodScore: todayScore,
          context: context?.summary ?? null,
          onEmotion: (e) => {
            if (isUserEmotion(e)) setExpression(REACTION[e])
          },
        }
      )
      speak(full, settings.ttsEnabled)
    } catch {
      setExpression('concerned')
      updateMessage(placeholder.id, 'Oh no, my circuits hiccuped. Could you try that again?')
    } finally {
      setBusy(false)
      setTalking(false)
      relaxLater()
    }
  }

  /**
   * "I'm satisfied with my care": say goodbye, start a fresh backend
   * conversation next time, drop the symptom-check context, and dock
   * TadBuddy as the floating bubble. Resolves after the wave animation.
   */
  const endSession = async (): Promise<void> => {
    if (busy) return
    holdStill()
    addMessage('user', SATISFIED_PHRASE)
    addMessage('assistant', SIGN_OFF)
    speak(SIGN_OFF, settings.ttsEnabled)
    setExpression('excited')
    if (backendEnabled() && currentUser) resetConversation(currentUser)
    setChatContext(null)
    setBuddyDocked(true)
    await new Promise((r) => setTimeout(r, 1800))
    setExpression('neutral')
  }

  return {
    messages,
    busy,
    expression,
    setExpression,
    talking,
    holdStill,
    send,
    endSession,
    context,
    clearContext: () => setChatContext(null),
    canEnd: sessionUserMessages >= SATISFIED_AFTER && !busy,
    currentUser,
  }
}
