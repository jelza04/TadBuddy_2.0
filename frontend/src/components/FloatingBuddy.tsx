import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import TadFace from './TadFace'
import Icon from './Icon'
import { useChatSession } from '../lib/useChatSession'
import { useAppStore } from '../store/useAppStore'

/**
 * After "I'm satisfied with my care", TadBuddy docks here: a floating bubble
 * bottom-right on every page. Tap it to open a mini chat; "expand" jumps to
 * the full chat screen.
 */
export default function FloatingBuddy() {
  const buddyDocked = useAppStore((s) => s.buddyDocked)
  const currentUser = useAppStore((s) => s.currentUser)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  if (!buddyDocked || !currentUser || pathname === '/chat') return null

  return (
    // bottom-28 keeps it above the mobile/tablet bottom nav
    <div className="fixed right-4 bottom-28 lg:right-6 lg:bottom-6 z-[60] flex flex-col items-end gap-3">
      <AnimatePresence>
        {open && <MiniChat onClose={() => setOpen(false)} onExpand={() => navigate('/chat')} />}
      </AnimatePresence>
      {!open && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1, y: [0, -4, 0] }}
          transition={{ scale: { type: 'spring', stiffness: 220, damping: 14 }, y: { repeat: Infinity, duration: 3, ease: 'easeInOut' } }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => setOpen(true)}
          className="relative w-16 h-16 rounded-full bg-white puffy-shadow border border-slate-100 flex items-center justify-center"
          title="Talk to TadBuddy"
          aria-label="Open TadBuddy chat"
        >
          <TadFace size={56} body={false} mood="good" className="mt-1" />
          <span className="absolute top-1 right-1 w-3 h-3 rounded-full bg-primary-bright ring-2 ring-white" />
        </motion.button>
      )}
    </div>
  )
}

function MiniChat({ onClose, onExpand }: { onClose: () => void; onExpand: () => void }) {
  const chat = useChatSession()
  const [input, setInput] = useState('')
  const feedRef = useRef<HTMLDivElement>(null)
  const recent = chat.messages.slice(-30)

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight })
  }, [chat.messages, chat.busy])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.9, originX: 1, originY: 1 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      className="w-[min(22rem,calc(100vw-2rem))] h-[min(30rem,calc(100dvh-10rem))] bg-white rounded-[2rem] puffy-shadow border border-slate-100 flex flex-col overflow-hidden"
    >
      <header className="flex items-center gap-3 px-4 py-3 border-b border-slate-50">
        <div className="w-10 h-10 rounded-full bg-white border border-slate-100 overflow-hidden shrink-0">
          <TadFace size={36} body={false} mood={chat.talking ? 'talking' : chat.expression} className="mt-1.5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-semibold text-sm truncate">TadBuddy</p>
          <p className="text-[11px] text-slate-400 truncate">{chat.busy ? 'Thinking…' : 'Here whenever you need me'}</p>
        </div>
        <button onClick={onExpand} className="p-1.5 rounded-full text-slate-400 hover:text-primary-bright hover:bg-surface" title="Open full chat">
          <Icon name="open_in_full" className="!text-lg" />
        </button>
        <button onClick={onClose} className="p-1.5 rounded-full text-slate-400 hover:text-primary-bright hover:bg-surface" title="Minimize">
          <Icon name="remove" className="!text-lg" />
        </button>
      </header>

      <div ref={feedRef} className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0 text-sm">
        {recent.map((m) => (
          <div
            key={m.id}
            className={`max-w-[85%] px-4 py-2.5 rounded-2xl break-words [overflow-wrap:anywhere] leading-relaxed ${
              m.role === 'user' ? 'ml-auto bg-primary-bright text-white rounded-br-md' : 'bg-surface-container-low rounded-bl-md'
            }`}
          >
            {m.text}
          </div>
        ))}
      </div>

      <form
        className="flex items-center gap-2 p-3 border-t border-slate-50"
        onSubmit={(e) => {
          e.preventDefault()
          if (!input.trim()) return
          chat.send(input)
          setInput('')
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Say hi to TadBuddy…"
          className="flex-1 min-w-0 bg-surface-container-low rounded-full px-4 py-2.5 text-sm outline-none focus:ring-4 focus:ring-primary-bright/10 placeholder:text-slate-400"
        />
        <button
          type="submit"
          disabled={!input.trim() || chat.busy}
          className="w-10 h-10 rounded-full bg-primary-bright text-white flex items-center justify-center disabled:opacity-40 shrink-0"
          title="Send"
        >
          <Icon name="send" filled className="!text-lg" />
        </button>
      </form>
    </motion.div>
  )
}
