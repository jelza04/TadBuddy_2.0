import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import TadFace, { type TadMood } from '../components/TadFace'
import TadBot3D from '../components/TadBot3D'
import Icon from '../components/Icon'
import PageShell from '../components/PageShell'
import { streamReply } from '../lib/ai'
import { detectCrisis, CRISIS_MESSAGE } from '../lib/crisis'
import { guessEmotion, isUserEmotion, REACTION, STATUS } from '../lib/emotion'
import { splitKeywords } from '../lib/keywords'
import { createRecognizer, speak, stopSpeaking } from '../lib/speech'
import { useAppStore, useMyMessages, useMyMoods } from '../store/useAppStore'

/** How long TadBuddy holds its reaction after replying before relaxing to neutral. */
const HOLD_MS = 4000

function HighlightedText({ text }: { text: string }) {
  return (
    <>
      {splitKeywords(text).map((p, i) =>
        p.highlight ? (
          <mark key={i} className="kw">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </>
  )
}

export default function Chat() {
  const messages = useMyMessages()
  const addMessage = useAppStore((s) => s.addMessage)
  const updateMessage = useAppStore((s) => s.updateMessage)
  const settings = useAppStore((s) => s.settings)
  const setSettings = useAppStore((s) => s.setSettings)
  const currentUser = useAppStore((s) => s.currentUser)

  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [recording, setRecording] = useState(false)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  // Avatar: `expression` is the face/body pose, `talking` animates the mouth on top of it.
  const [expression, setExpression] = useState<TadMood>('neutral')
  const [talking, setTalking] = useState(false)
  const holdTimer = useRef<ReturnType<typeof setTimeout>>()
  const feedRef = useRef<HTMLDivElement>(null)
  const recognizerRef = useRef<ReturnType<typeof createRecognizer>>(null)

  const moods = useMyMoods()
  const todayScore = (() => {
    const today = new Date().toISOString().slice(0, 10)
    const entries = moods.filter((m) => m.date === today)
    return entries.length ? entries[entries.length - 1].score : null
  })()

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

  useEffect(
    () => () => {
      stopSpeaking()
      clearTimeout(holdTimer.current)
    },
    []
  )

  // While the user is typing, TadBuddy tilts its head and listens.
  useEffect(() => {
    if (busy) return
    if (input.trim()) {
      clearTimeout(holdTimer.current)
      setExpression('listening')
    } else if (expression === 'listening') {
      setExpression('neutral')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, busy])

  const relaxLater = () => {
    clearTimeout(holdTimer.current)
    holdTimer.current = setTimeout(() => setExpression('neutral'), HOLD_MS)
  }

  const send = async (text: string) => {
    const clean = text.trim()
    if (!clean || busy) return
    clearTimeout(holdTimer.current)
    setInput('')
    setBusy(true)
    setTalking(false)
    // React instantly with a local guess; the backend's classifier refines it a moment later.
    setExpression(REACTION[guessEmotion(clean)])
    addMessage('user', clean)

    if (detectCrisis(clean)) {
      setExpression('concerned')
      const msg = addMessage('assistant', CRISIS_MESSAGE)
      speak(CRISIS_MESSAGE, settings.ttsEnabled)
      updateMessage(msg.id, CRISIS_MESSAGE)
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
          onEmotion: (e) => {
            if (isUserEmotion(e)) setExpression(REACTION[e])
          },
        }
      )
      speak(full, settings.ttsEnabled)
    } catch {
      setExpression('concerned')
      updateMessage(placeholder.id, "Oh no, my circuits hiccuped. Could you try that again?")
    } finally {
      setBusy(false)
      setTalking(false)
      relaxLater()
    }
  }

  const toggleRecording = () => {
    setVoiceError(null)
    if (recording) {
      recognizerRef.current?.stop()
      setRecording(false)
      return
    }
    const rec = createRecognizer(
      (text) => send(text),
      () => setRecording(false),
      (msg) => {
        setVoiceError(msg)
        setRecording(false)
      }
    )
    if (rec) {
      recognizerRef.current = rec
      setRecording(true)
      rec.start()
    }
  }

  return (
    <PageShell footer={false}>
      <div className="flex gap-8 pb-24 md:pb-8 h-[calc(100vh-8.5rem)]">
        {/* left: big avatar */}
        <aside className="hidden lg:flex flex-col items-center justify-center w-80 shrink-0">
          <div className="relative">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              whileHover={{ scale: 1.03 }}
              className="cursor-pointer"
              title="TadBuddy"
            >
              <TadBot3D width={300} mood={expression} talking={talking} />
            </motion.div>
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-white px-6 py-2 rounded-full shadow-lg border border-slate-100 flex items-center gap-2 whitespace-nowrap">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-semibold tracking-widest text-slate-500 uppercase">
                {recording
                  ? 'Listening…'
                  : STATUS[expression] ?? (busy ? 'Thinking…' : 'Here for you')}
              </span>
            </div>
          </div>
        </aside>

        {/* chat panel */}
        <section className="flex-1 flex flex-col bg-white rounded-[3rem] puffy-shadow overflow-hidden border border-white min-h-0">
          <header className="px-6 md:px-8 py-5 border-b border-slate-50 flex justify-between items-center bg-white/50">
            <div>
              <h1 className="font-display text-xl font-semibold">Talking with TadBuddy</h1>
              <p className="text-xs text-slate-400">Not a medical professional • Your caring companion & journal</p>
            </div>
            <button
              onClick={() => {
                const next = !settings.ttsEnabled
                setSettings({ ttsEnabled: next })
                if (!next) stopSpeaking()
              }}
              className={`p-3 rounded-full transition-colors ${settings.ttsEnabled ? 'bg-red-50 text-primary-bright' : 'hover:bg-surface text-slate-400'}`}
              title={settings.ttsEnabled ? 'Voice replies on' : 'Voice replies off'}
            >
              <Icon name={settings.ttsEnabled ? 'volume_up' : 'volume_off'} />
            </button>
          </header>

          <div ref={feedRef} className="flex-1 overflow-y-auto p-5 md:p-8 space-y-6 min-h-0">
            {messages.length === 0 && (
              <div className="flex items-end gap-3 max-w-[85%]">
                <div className="w-10 h-10 rounded-full bg-white puffy-shadow border border-slate-100 shrink-0 overflow-hidden">
                  <TadFace size={36} body={false} className="mt-1.5" />
                </div>
                <div className="bg-white px-6 py-4 rounded-t-3xl rounded-br-3xl puffy-shadow border border-slate-100">
                  <p>
                    Hi{currentUser ? ` ${currentUser}` : ''}! I'm all ears (well, sensors). Tell me anything — how your day went, what's on
                    your mind, or how your body feels. I'll keep it safe in your journal.
                  </p>
                  <div className="mt-3 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary-bright" />
                    <span className="text-[10px] font-semibold text-primary-bright tracking-widest uppercase">Personal health companion</span>
                  </div>
                </div>
              </div>
            )}

            {messages.map((m) =>
              m.role === 'assistant' ? (
                <motion.div key={m.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-end gap-3 max-w-[85%]">
                  <div className="w-10 h-10 rounded-full bg-white puffy-shadow border border-slate-100 shrink-0 overflow-hidden">
                    <TadFace size={36} body={false} className="mt-1.5" />
                  </div>
                  <div className="bg-white px-6 py-4 rounded-t-3xl rounded-br-3xl puffy-shadow border border-slate-100">
                    <p className="leading-relaxed">{m.text}</p>
                  </div>
                </motion.div>
              ) : (
                <motion.div key={m.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-end gap-3 max-w-[85%] ml-auto flex-row-reverse">
                  <div className="w-10 h-10 rounded-full bg-primary-bright text-white flex items-center justify-center font-bold shrink-0">
                    {(currentUser ?? 'U')[0].toUpperCase()}
                  </div>
                  <div className="bg-primary-bright px-6 py-4 rounded-t-3xl rounded-bl-3xl puffy-shadow">
                    <p className="text-white leading-relaxed">
                      <HighlightedText text={m.text} />
                    </p>
                  </div>
                </motion.div>
              )
            )}

            {busy && (
              <div className="flex justify-center py-2">
                <div className="bg-surface-container px-6 py-2.5 rounded-full flex items-center gap-3 border border-white shadow-inner">
                  <span className="text-xs font-semibold tracking-widest text-slate-500 uppercase">TadBuddy is thinking</span>
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="w-1.5 h-1.5 bg-primary-bright rounded-full"
                        animate={{ y: [0, -4, 0] }}
                        transition={{ repeat: Infinity, duration: 0.7, delay: i * 0.15 }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <footer className="p-4 md:p-6 bg-white/80 backdrop-blur-md border-t border-slate-50">
            {voiceError && <p className="text-xs text-primary-bright mb-2 text-center">{voiceError}</p>}
            <form
              className="flex items-center gap-3"
              onSubmit={(e) => {
                e.preventDefault()
                send(input)
              }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Tell TadBuddy how you feel…"
                className="flex-1 bg-surface-container-low border-none rounded-full px-6 md:px-8 py-4 focus:ring-4 focus:ring-primary-bright/10 puffy-shadow outline-none placeholder:text-slate-400"
              />
              <button
                type="button"
                onClick={toggleRecording}
                className={`w-14 h-14 rounded-full flex items-center justify-center puffy-shadow squishy-active transition-all shrink-0 ${
                  recording ? 'bg-primary-deep text-white animate-pulse' : 'bg-primary-bright text-white'
                }`}
                title={recording ? 'Stop recording' : 'Speak to TadBuddy'}
              >
                <Icon name={recording ? 'stop' : 'mic'} filled className="!text-2xl" />
              </button>
              <button
                type="submit"
                disabled={!input.trim() || busy}
                className="w-14 h-14 bg-white border border-slate-100 text-primary-bright rounded-full flex items-center justify-center puffy-shadow squishy-active transition-all disabled:opacity-40 shrink-0"
                title="Send"
              >
                <Icon name="send" filled className="!text-2xl" />
              </button>
            </form>
            <p className="mt-3 text-center text-[11px] text-slate-400">
              Chats are saved to your private journal on this device. TadBuddy is not a medical professional.
            </p>
          </footer>
        </section>
      </div>
    </PageShell>
  )
}
