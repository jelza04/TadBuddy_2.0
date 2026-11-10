import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import PageShell from '../components/PageShell'
import PuffyCard from '../components/PuffyCard'
import TadFace, { moodFromScore } from '../components/TadFace'
import Icon from '../components/Icon'
import { moodColor, moodLabel } from '../lib/mood'
import { useAppStore, useMyMoods, useMyMessages, useMyTasks } from '../store/useAppStore'

export default function Dashboard() {
  const navigate = useNavigate()
  const currentUser = useAppStore((s) => s.currentUser)
  const moods = useMyMoods()
  const messages = useMyMessages()
  const tasks = useMyTasks()

  const today = new Date().toISOString().slice(0, 10)
  const todayScores = moods.filter((m) => m.date === today).map((m) => m.score)
  const todayAvg = todayScores.length ? todayScores.reduce((a, b) => a + b, 0) / todayScores.length : null

  const streak = useMemo(() => {
    let count = 0
    const dates = new Set(moods.map((m) => m.date))
    for (let i = 0; ; i++) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      if (dates.has(d.toISOString().slice(0, 10))) count++
      else if (i > 0) break
      else if (!dates.has(today)) break
    }
    return count
  }, [moods, today])

  const openTasks = tasks.filter((t) => !t.done)
  const lastChat = [...messages].reverse().find((m) => m.role === 'user')

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  const cards = [
    {
      icon: 'sentiment_satisfied',
      title: 'Mood Check',
      body: todayAvg !== null ? `Today: ${todayAvg.toFixed(1)} — ${moodLabel(todayAvg)}` : "You haven't checked in today yet.",
      cta: todayAvg !== null ? 'Check in again' : 'Check in now',
      to: '/mood',
    },
    {
      icon: 'chat_bubble',
      title: 'Companion Chat',
      body: lastChat ? `Last entry: “${lastChat.text.slice(0, 60)}${lastChat.text.length > 60 ? '…' : ''}”` : 'Your journal is ready when you are.',
      cta: 'Open chat',
      to: '/chat',
    },
    {
      icon: 'stethoscope',
      title: 'Symptom Check',
      body: 'Gentle guided questions when something feels off. Never a diagnosis.',
      cta: 'Start check',
      to: '/symptoms',
    },
    {
      icon: 'checklist',
      title: 'Wellness Tasks',
      body: openTasks.length ? `${openTasks.length} open task${openTasks.length > 1 ? 's' : ''} — next: “${openTasks[0].title}”` : 'No open tasks. Add a kind little goal?',
      cta: 'View tasks',
      to: '/tasks',
    },
    {
      icon: 'analytics',
      title: 'Insights',
      body: moods.length >= 2 ? 'Your patterns are taking shape — come see.' : 'Check in a few days in a row to unlock trends.',
      cta: 'View insights',
      to: '/insights',
    },
    {
      icon: 'calendar_month',
      title: 'Mood History',
      body: moods.length ? `${moods.length} check-in${moods.length > 1 ? 's' : ''} logged so far.` : 'Your calendar will fill with color as you check in.',
      cta: 'Open calendar',
      to: '/history',
    },
  ]

  return (
    <PageShell>
      <header className="flex flex-col md:flex-row items-center justify-between gap-8 mb-10 bg-white p-8 md:p-12 rounded-[3rem] puffy-shadow-soft relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-primary-fixed opacity-20 rounded-full -mr-24 -mt-24 blur-3xl" />
        <div className="z-10 text-center md:text-left">
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-3">
            {greeting}, {currentUser}!
          </h1>
          <p className="text-tertiary max-w-lg mb-6">
            {streak > 1
              ? `You're on a ${streak}-day check-in streak. I'm so proud of you!`
              : "I'm here whenever you need me — a check-in, a chat, or just company."}
          </p>
          <div className="flex flex-wrap gap-4 justify-center md:justify-start">
            <button
              onClick={() => navigate('/mood')}
              className="bg-primary-bright text-white font-bold px-8 py-4 rounded-full hover:scale-105 active:scale-95 transition-transform puffy-shadow"
            >
              Daily check-in
            </button>
            <button
              onClick={() => navigate('/chat')}
              className="bg-surface-container-low font-bold px-8 py-4 rounded-full hover:scale-105 active:scale-95 transition-transform"
            >
              Just chat
            </button>
          </div>
        </div>
        <div className="w-44 h-44 md:w-56 md:h-56 bg-surface-container-high rounded-full flex items-center justify-center relative z-10 border-8 border-white shadow-inner shrink-0">
          <TadFace size={150} mood={todayAvg !== null ? moodFromScore(todayAvg) : 'neutral'} />
        </div>
      </header>

      {todayAvg !== null && (
        <div className="mb-10 flex justify-center">
          <div className="bg-white px-8 py-3 rounded-full puffy-shadow-soft flex items-center gap-3">
            <Icon name="favorite" filled className="text-primary-bright" />
            <span className="text-sm">
              Today you're feeling <span className={`font-bold ${moodColor(todayAvg)}`}>{moodLabel(todayAvg)}</span>
              {streak > 1 && <span className="text-slate-400"> · {streak}-day streak 🔥</span>}
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((c) => (
          <PuffyCard key={c.title} className="p-8 flex flex-col gap-4 cursor-pointer" onClick={() => navigate(c.to)}>
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center text-primary shadow-inner">
              <Icon name={c.icon} />
            </div>
            <h3 className="font-display text-xl font-semibold">{c.title}</h3>
            <p className="text-tertiary flex-1">{c.body}</p>
            <span className="text-primary font-bold flex items-center gap-1 text-sm">
              {c.cta} <Icon name="arrow_forward" className="!text-sm" />
            </span>
          </PuffyCard>
        ))}
      </div>
    </PageShell>
  )
}
