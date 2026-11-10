import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TadFace from '../components/TadFace'
import Icon from '../components/Icon'
import { speak } from '../lib/speech'
import { useAppStore } from '../store/useAppStore'

const GREETING = 'Hello, I am TadBuddy, your personal health companion.'

export default function Splash() {
  const navigate = useNavigate()
  const currentUser = useAppStore((s) => s.currentUser)
  const setSettings = useAppStore((s) => s.setSettings)
  const [phase, setPhase] = useState<'ask' | 'greeting'>('ask')

  const begin = (sound: boolean) => {
    setSettings({ soundEnabled: sound, ttsEnabled: sound })
    setPhase('greeting')
    if (sound) speak(GREETING, true)
    setTimeout(() => navigate(currentUser ? '/mood' : '/login'), 4200)
  }

  return (
    <div className="min-h-screen bg-primary-deep flex flex-col items-center justify-center overflow-hidden relative">
      {/* soft background glows */}
      <div className="absolute top-1/4 -left-20 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-white/5 rounded-full blur-3xl" />

      <AnimatePresence mode="wait">
        {phase === 'ask' ? (
          <motion.div
            key="ask"
            className="flex flex-col items-center gap-8 px-6 text-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            <motion.div
              animate={{ scale: [1, 1.03, 1] }}
              transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
              className="puffy-shadow rounded-full"
            >
              <TadFace size={140} mood="neutral" />
            </motion.div>
            <h1 className="font-display text-3xl md:text-4xl font-bold text-white">Welcome to TadBuddy</h1>
            <p className="text-white/70 max-w-sm">Would you like me to speak to you out loud during your visit?</p>
            <div className="flex gap-4">
              <button
                onClick={() => begin(true)}
                className="bg-white text-primary-deep font-bold px-8 py-4 rounded-full hover:scale-105 active:scale-95 transition-transform flex items-center gap-2 puffy-shadow"
              >
                <Icon name="volume_up" /> Sound on
              </button>
              <button
                onClick={() => begin(false)}
                className="bg-white/15 text-white font-bold px-8 py-4 rounded-full hover:scale-105 active:scale-95 transition-transform flex items-center gap-2"
              >
                <Icon name="volume_off" /> Quiet mode
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="greet"
            className="flex flex-col items-center gap-10 px-6 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {/* inflate animation */}
            <motion.div
              initial={{ scale: 0.25, opacity: 0.4 }}
              animate={{ scale: [0.25, 1.08, 0.98, 1.02, 1] }}
              transition={{ duration: 2.2, times: [0, 0.55, 0.75, 0.9, 1], ease: 'easeOut' }}
              className="rounded-full puffy-shadow"
            >
              <TadFace size={200} mood="talking" />
            </motion.div>
            <motion.h1
              className="font-display text-2xl md:text-4xl font-bold text-white max-w-2xl leading-snug"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.6, duration: 0.8 }}
            >
              “{GREETING}”
            </motion.h1>
            <motion.div
              className="flex items-center gap-2 text-white/60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2.4 }}
            >
              <motion.div
                className="w-2 h-2 bg-white rounded-full"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ repeat: Infinity, duration: 1.2 }}
              />
              <span className="text-sm tracking-widest uppercase">Getting things cozy…</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
