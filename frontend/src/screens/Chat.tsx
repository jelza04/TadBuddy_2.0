import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TadFace from '../components/TadFace'
import TadBot3D from '../components/TadBot3D'
import Icon from '../components/Icon'
import PageShell from '../components/PageShell'
import { STATUS } from '../lib/emotion'
import { splitKeywords } from '../lib/keywords'
import { createRecognizer, stopSpeaking } from '../lib/speech'
import { SATISFIED_PHRASE, useChatSession } from '../lib/useChatSession'
import { useAppStore } from '../store/useAppStore'

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
  const navigate = useNavigate()
  const settings = useAppStore((s) => s.settings)
  const setSettings = useAppStore((s) => s.setSettings)
  const setBuddyDocked = useAppStore((s) => s.setBuddyDocked)
  const chat = useChatSession()
  const { messages, busy, expression, setExpression, talking, currentUser } = chat

  const [input, setInput] = useState('')
  const [recording, setRecording] = useState(false)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [leaving, setLeaving] = useState(false)
  const feedRef = useRef<HTMLDivElement>(null)
  const recognizerRef = useRef<ReturnType<typeof createRecognizer>>(null)

  // Opening the full chat "un-docks" the floating bubble.
  useEffect(() => setBuddyDocked(false), [setBuddyDocked])

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

  useEffect(() => () => stopSpeaking(), [])

  // While the user is typing, TadBuddy tilts its head and listens.
  useEffect(() => {
    if (busy || leaving) return
    if (input.trim()) {
      chat.holdStill()
      setExpression('listening')
    } else if (expression === 'listening') {
      setExpression('neutral')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, busy])

  const send = (text: string) => {
    if (!text.trim() || busy) return
    setInput('')
    chat.send(text)
  }

  const finish = async () => {
    setLeaving(true)
    await chat.endSession()
    navigate('/dashboard') // TadBuddy now waits as the floating bubble, bottom-right
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
      <div className="flex gap-6 xl:gap-8 pb-24 lg:pb-6 h-[calc(100dvh-7.5rem)] min-h-[26rem]">
        {/* left: big avatar */}
        <aside className="hidden lg:flex flex-col items-center justify-center w-64 xl:w-80 shrink-0">
          <motion.div
            className="relative"
            animate={leaving ? { x: 400, y: 300, scale: 0.2, opacity: 0 } : { x: 0, y: 0, scale: 1, opacity: 1 }}
            transition={leaving ? { delay: 1.2, duration: 0.6, ease: 'easeIn' } : { duration: 0.6, ease: 'easeOut' }}
          >
            <TadBot3D width={250} mood={expression} talking={talking} />
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-white px-5 py-2 rounded-full shadow-lg border border-slate-100 flex items-center gap-2 whitespace-nowrap">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[11px] font-semibold tracking-widest text-slate-500 uppercase">
                {recording ? 'Listening…' : STATUS[expression] ?? (busy ? 'Thinking…' : 'Here for you')}
              </span>
            </div>
          </motion.div>
        </aside>

        {/* chat panel */}
        <section className="relative flex-1 flex flex-col bg-white rounded-[2.5rem] puffy-shadow overflow-hidden border border-white min-h-0 min-w-0">
          <header className="px-5 md:px-7 py-4 border-b border-slate-50 flex justify-between items-center gap-3 bg-white/50">
            <div className="min-w-0">
              <h1 className="font-display text-lg font-semibold truncate">Talking with TadBuddy</h1>
              <p className="text-xs text-slate-400 truncate">Not a medical professional • Your caring companion & journal</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {chat.context && (
                <span className="hidden sm:flex items-center gap-1 bg-red-50 text-primary text-xs font-semibold pl-3 pr-1 py-1 rounded-full">
                  <Icon name="stethoscope" className="!text-base" /> Symptom check
                  <button onClick={chat.clearContext} className="ml-1 p-0.5 rounded-full hover:bg-red-100" title="Stop using the symptom check">
                    <Icon name="close" className="!text-base" />
                  </button>
                </span>
              )}
              <button
                onClick={() => {
                  const next = !settings.ttsEnabled
                  setSettings({ ttsEnabled: next })
                  if (!next) stopSpeaking()
                }}
                className={`p-2.5 rounded-full transition-colors ${settings.ttsEnabled ? 'bg-red-50 text-primary-bright' : 'hover:bg-surface text-slate-400'}`}
                title={settings.ttsEnabled ? 'Voice replies on' : 'Voice replies off'}
              >
                <Icon name={settings.ttsEnabled ? 'volume_up' : 'volume_off'} />
              </button>
            </div>
          </header>

          <div ref={feedRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 min-h-0">
            {messages.length === 0 && (
              <div className="flex items-end gap-3 max-w-[85%]">
                <div className="w-9 h-9 rounded-full bg-white puffy-shadow border border-slate-100 shrink-0 overflow-hidden">
                  <TadFace size={32} body={false} className="mt-1.5" />
                </div>
                <div className="bg-white px-5 py-3.5 rounded-t-3xl rounded-br-3xl puffy-shadow border border-slate-100">
                  <p className="break-words">
                    Hi{currentUser ? ` ${currentUser}` : ''}! I'm all ears (well, sensors). Tell me anything — how your day went, what's on
                    your mind, or how your body feels. I'll keep it safe in your journal.
                  </p>
                </div>
              </div>
            )}

            {messages.map((m) =>
              m.role === 'assistant' ? (
                <motion.div key={m.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-end gap-3 max-w-[85%]">
                  <div className="w-9 h-9 rounded-full bg-white puffy-shadow border border-slate-100 shrink-0 overflow-hidden">
                    <TadFace size={32} body={false} className="mt-1.5" />
                  </div>
                  <div className="min-w-0 bg-white px-5 py-3.5 rounded-t-3xl rounded-br-3xl puffy-shadow border border-slate-100">
                    <p className="leading-relaxed break-words [overflow-wrap:anywhere]">{m.text}</p>
                  </div>
                </motion.div>
              ) : (
                <motion.div key={m.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-end gap-3 max-w-[85%] ml-auto flex-row-reverse">
                  <div className="w-9 h-9 rounded-full bg-primary-bright text-white flex items-center justify-center font-bold shrink-0">
                    {(currentUser ?? 'U')[0].toUpperCase()}
                  </div>
                  <div className="min-w-0 bg-primary-bright px-5 py-3.5 rounded-t-3xl rounded-bl-3xl puffy-shadow">
                    <p className="text-white leading-relaxed break-words [overflow-wrap:anywhere]">
                      <HighlightedText text={m.text} />
                    </p>
                  </div>
                </motion.div>
              )
            )}

            {busy && (
              <div className="flex justify-center py-2">
                <div className="bg-surface-container px-5 py-2 rounded-full flex items-center gap-3 border border-white shadow-inner">
                  <span className="text-[11px] font-semibold tracking-widest text-slate-500 uppercase">TadBuddy is thinking</span>
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

          {/* "I'm all good" — floats above the input once there's been a real conversation */}
          <AnimatePresence>
            {chat.canEnd && !leaving && (
              <motion.button
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10 }}
                onClick={finish}
                className="absolute right-4 md:right-6 bottom-[6.5rem] z-10 max-w-[calc(100%-2rem)] text-left flex items-center gap-2 bg-white border border-emerald-100 text-emerald-700 text-sm font-semibold pl-3 pr-4 py-2 rounded-full puffy-shadow hover:bg-emerald-50 hover:scale-105 active:scale-95 transition-all"
                title="End this chat — TadBuddy will wait in the corner"
              >
                <Icon name="volunteer_activism" filled className="!text-lg" />
                {SATISFIED_PHRASE}
              </motion.button>
            )}
          </AnimatePresence>

          <footer className="p-3 md:p-5 bg-white/80 backdrop-blur-md border-t border-slate-50">
            {voiceError && <p className="text-xs text-primary-bright mb-2 text-center">{voiceError}</p>}
            <form
              className="flex items-center gap-2 md:gap-3"
              onSubmit={(e) => {
                e.preventDefault()
                send(input)
              }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Tell TadBuddy how you feel…"
                disabled={leaving}
                className="flex-1 min-w-0 bg-surface-container-low border-none rounded-full px-5 md:px-7 py-3.5 focus:ring-4 focus:ring-primary-bright/10 puffy-shadow outline-none placeholder:text-slate-400"
              />
              <button
                type="button"
                onClick={toggleRecording}
                className={`w-12 h-12 rounded-full flex items-center justify-center puffy-shadow squishy-active transition-all shrink-0 ${
                  recording ? 'bg-primary-deep text-white animate-pulse' : 'bg-primary-bright text-white'
                }`}
                title={recording ? 'Stop recording' : 'Speak to TadBuddy'}
              >
                <Icon name={recording ? 'stop' : 'mic'} filled className="!text-xl" />
              </button>
              <button
                type="submit"
                disabled={!input.trim() || busy || leaving}
                className="w-12 h-12 bg-white border border-slate-100 text-primary-bright rounded-full flex items-center justify-center puffy-shadow squishy-active transition-all disabled:opacity-40 shrink-0"
                title="Send"
              >
                <Icon name="send" filled className="!text-xl" />
              </button>
            </form>
            <p className="mt-2 text-center text-[11px] text-slate-400">
              Chats are saved to your private journal. TadBuddy is not a medical professional.
            </p>
          </footer>
        </section>
      </div>
    </PageShell>
  )
}
