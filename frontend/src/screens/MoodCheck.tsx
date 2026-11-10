import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TadFace, { moodFromScore } from '../components/TadFace'
import Icon from '../components/Icon'
import Disclaimer from '../components/Disclaimer'
import { MOOD_RESPONSES } from '../lib/mood'
import { speak } from '../lib/speech'
import { useAppStore } from '../store/useAppStore'

export default function MoodCheck() {
  const navigate = useNavigate()
  const addMood = useAppStore((s) => s.addMood)
  const settings = useAppStore((s) => s.settings)
  const currentUser = useAppStore((s) => s.currentUser)
  const [selected, setSelected] = useState<number | null>(null)

  const pick = (score: number) => {
    if (selected !== null) return
    setSelected(score)
    addMood(score)
    const comment = MOOD_RESPONSES[score].comment
    speak(comment, settings.ttsEnabled)
    setTimeout(() => navigate('/chat'), 4800)
  }

  return (
    <div className="min-h-screen bg-primary-deep relative overflow-hidden">
      <div className="fixed top-1/4 -left-20 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-1/4 -right-20 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none" />

      {/* slim top bar */}
      <div className="fixed top-0 left-0 right-0 z-50">
        <div className="bg-white/80 backdrop-blur-md rounded-full mt-4 mx-auto w-[95%] max-w-5xl shadow-[0_20px_50px_rgba(219,0,49,0.1)] flex justify-between items-center px-8 py-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white rounded-full border-2 border-slate-100 shadow-sm overflow-hidden">
              <TadFace size={32} body={false} className="mt-1.5" />
            </div>
            <span className="text-xl font-black font-display text-primary-bright tracking-tight">TadBuddy</span>
          </div>
          <button onClick={() => navigate('/chat')} className="text-slate-500 text-sm font-display hover:text-primary-bright transition-colors">
            Skip to chat →
          </button>
        </div>
      </div>

      <main className="pt-32 pb-16 px-4 max-w-5xl mx-auto flex flex-col items-center gap-10 min-h-screen">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-3">
          <h1 className="font-display text-3xl md:text-5xl font-bold text-white leading-tight max-w-3xl">
            {currentUser ? `Hi ${currentUser}! ` : ''}On a scale of 1 to 10, how do you feel today?
          </h1>
          <p className="text-white/70">Pick the bubble that matches your mood.</p>
        </motion.div>

        {/* the 1–10 scale */}
        <div className="w-full overflow-x-auto pb-6 scrollbar-hide">
          <div className="flex items-end justify-between min-w-[820px] gap-3 px-4">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((score) => {
              const isSelected = selected === score
              return (
                <motion.button
                  key={score}
                  onClick={() => pick(score)}
                  whileHover={selected === null ? { y: -14, scale: 1.12 } : undefined}
                  whileTap={{ scale: 0.9 }}
                  animate={isSelected ? { scale: 1.25, y: -10 } : selected !== null ? { opacity: 0.35 } : {}}
                  className="group flex flex-col items-center gap-3 focus:outline-none"
                  aria-label={`Mood ${score}: ${MOOD_RESPONSES[score].label}`}
                >
                  <div
                    className={`bg-white rounded-full puffy-shadow puffy-glow transition-shadow duration-300 ${
                      score <= 3 ? 'ring-4 ring-red-400/30' : score >= 8 ? 'ring-4 ring-emerald-400/40' : ''
                    }`}
                    style={{ width: 56 + score * 2.5, height: 56 + score * 2.5 }}
                  >
                    <TadFace size={56 + score * 2.5} body={false} mood={moodFromScore(score)} className="p-1" />
                  </div>
                  <span className={`text-white font-bold transition-opacity ${isSelected ? 'opacity-100 text-xl' : 'opacity-60 group-hover:opacity-100'}`}>
                    {score}
                  </span>
                </motion.button>
              )
            })}
          </div>
        </div>

        {/* response card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={selected ?? 'waiting'}
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="w-full max-w-2xl bg-white rounded-[3rem] p-8 md:p-10 puffy-shadow flex flex-col items-center gap-5 text-center"
          >
            {selected === null ? (
              <>
                <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center">
                  <Icon name="favorite" filled className="text-primary !text-4xl" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-display text-xl font-semibold">I am here to listen.</h3>
                  <p className="text-on-surface-variant">
                    Select a number above to share how you're feeling. Whatever it is, it's the right answer.
                  </p>
                </div>
              </>
            ) : (
              <>
                <TadFace size={72} mood={moodFromScore(selected)} />
                <div className="space-y-2">
                  <h3 className="font-display text-xl font-semibold text-primary-bright">{MOOD_RESPONSES[selected].label}</h3>
                  <p className="text-on-surface-variant leading-relaxed">{MOOD_RESPONSES[selected].comment}</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-widest">
                  <motion.span
                    className="w-2 h-2 bg-primary-bright rounded-full"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ repeat: Infinity, duration: 1.1 }}
                  />
                  Taking you to our chat…
                </div>
                <button onClick={() => navigate('/chat')} className="text-sm text-primary-bright font-bold hover:underline">
                  Go now →
                </button>
              </>
            )}
            <Disclaimer />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}
