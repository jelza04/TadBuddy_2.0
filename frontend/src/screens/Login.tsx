import { motion } from 'framer-motion'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TadFace from '../components/TadFace'
import Icon from '../components/Icon'
import Disclaimer from '../components/Disclaimer'
import { useAppStore } from '../store/useAppStore'

export default function Login() {
  const navigate = useNavigate()
  const register = useAppStore((s) => s.register)
  const login = useAppStore((s) => s.login)

  const [mode, setMode] = useState<'signup' | 'signin'>('signup')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!name.trim()) return setError('Please tell me your name.')
    if (!password) return setError('Please enter a password.')
    setBusy(true)
    const err = mode === 'signup' ? await register(name, password) : await login(name, password)
    setBusy(false)
    if (err) return setError(err)
    navigate('/mood')
  }

  return (
    <div className="min-h-screen bg-primary-deep flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute top-1/4 -left-20 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-white/5 rounded-full blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="w-full max-w-md bg-white rounded-[3rem] puffy-shadow p-8 md:p-10 flex flex-col items-center gap-6"
      >
        <motion.div animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 3.5, ease: 'easeInOut' }}>
          <TadFace size={110} mood={error ? 'low' : 'good'} />
        </motion.div>

        <div className="text-center space-y-1">
          <h1 className="font-display text-2xl font-bold text-on-surface">
            {mode === 'signup' ? 'Nice to meet you!' : 'Welcome back!'}
          </h1>
          <p className="text-slate-500 text-sm">
            {mode === 'signup' ? "What should I call you? I'll remember it." : 'Log back in so I can fetch your journal.'}
          </p>
        </div>

        <form onSubmit={submit} className="w-full flex flex-col gap-4">
          <div className="relative">
            <Icon name="face" className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              autoComplete="username"
              className="w-full bg-surface-container-low border-none rounded-full pl-14 pr-6 py-4 focus:ring-4 focus:ring-primary-bright/15 outline-none placeholder:text-slate-400"
            />
          </div>

          <div className="relative">
            <Icon name="lock" className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (6+ characters)"
              type={showPassword ? 'text' : 'password'}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              className="w-full bg-surface-container-low border-none rounded-full pl-14 pr-14 py-4 focus:ring-4 focus:ring-primary-bright/15 outline-none placeholder:text-slate-400"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary-bright transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              <Icon name={showPassword ? 'visibility_off' : 'visibility'} />
            </button>
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm text-primary-bright bg-red-50 rounded-2xl px-4 py-3 flex items-center gap-2"
              role="alert"
            >
              <Icon name="error" className="!text-lg" /> {error}
            </motion.p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="bg-primary-bright text-white font-bold py-4 rounded-full hover:scale-[1.02] active:scale-95 transition-transform disabled:opacity-60 puffy-shadow"
          >
            {busy ? 'One moment…' : mode === 'signup' ? 'Create my space' : 'Log in'}
          </button>
        </form>

        <button
          onClick={() => {
            setMode((m) => (m === 'signup' ? 'signin' : 'signup'))
            setError(null)
          }}
          className="text-sm text-slate-500 hover:text-primary-bright transition-colors"
        >
          {mode === 'signup' ? 'Already friends? Log in instead' : "New here? Let's get introduced"}
        </button>

        <Disclaimer />
      </motion.div>
    </div>
  )
}
