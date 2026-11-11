import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import PageShell from '../components/PageShell'
import PuffyCard from '../components/PuffyCard'
import TadFace from '../components/TadFace'
import Icon from '../components/Icon'
import { useMyMoods, useAppStore } from '../store/useAppStore'

const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

export default function Insights() {
  const navigate = useNavigate()
  const moods = useMyMoods()
  const currentUser = useAppStore((s) => s.currentUser)

  // last 30 days trend
  const trend = useMemo(() => {
    const days: { date: string; avg: number | null }[] = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      const scores = moods.filter((m) => m.date === key).map((m) => m.score)
      days.push({ date: key, avg: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null })
    }
    return days
  }, [moods])

  const weekday = useMemo(() => {
    const buckets: number[][] = Array.from({ length: 7 }, () => [])
    for (const m of moods) buckets[new Date(m.date + 'T12:00:00').getDay()].push(m.score)
    return buckets.map((b) => (b.length ? b.reduce((a, c) => a + c, 0) / b.length : null))
  }, [moods])

  const insights = useMemo(() => {
    const out: { icon: string; title: string; body: string }[] = []
    const known = trend.filter((t) => t.avg !== null) as { date: string; avg: number }[]
    if (known.length === 0) {
      out.push({
        icon: 'waving_hand',
        title: 'Your story starts here',
        body: 'Check in daily and I will start spotting gentle patterns in how you feel.',
      })
      return out
    }
    const weekendAvgs = [weekday[0], weekday[6]].filter((v): v is number => v !== null)
    const weekdayAvgs = weekday.slice(1, 6).filter((v): v is number => v !== null)
    if (weekendAvgs.length && weekdayAvgs.length) {
      const we = weekendAvgs.reduce((a, b) => a + b, 0) / weekendAvgs.length
      const wd = weekdayAvgs.reduce((a, b) => a + b, 0) / weekdayAvgs.length
      const diff = ((we - wd) / wd) * 100
      if (Math.abs(diff) >= 5)
        out.push({
          icon: 'calendar_today',
          title: diff > 0 ? "You've been feeling better on weekends" : 'Weekdays are treating you well',
          body: `Your mood runs about ${Math.abs(diff).toFixed(0)}% ${diff > 0 ? 'higher' : 'lower'} on weekends than on weekdays.`,
        })
    }
    const best = known.reduce((a, b) => (b.avg >= a.avg ? b : a))
    out.push({
      icon: 'trending_up',
      title: `Your best recent day was a ${best.avg.toFixed(1)}`,
      body: `${new Date(best.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} stood out. Worth remembering what made it shine.`,
    })
    if (known.length >= 4) {
      const half = Math.floor(known.length / 2)
      const older = known.slice(0, half).reduce((a, b) => a + b.avg, 0) / half
      const newer = known.slice(half).reduce((a, b) => a + b.avg, 0) / (known.length - half)
      const delta = newer - older
      out.push({
        icon: 'equalizer',
        title:
          Math.abs(delta) < 0.3
            ? 'Your mood has been steady'
            : `Average mood ${delta > 0 ? 'improved' : 'dipped'} by ${Math.abs(delta).toFixed(1)} points`,
        body:
          delta >= 0
            ? 'Your recent check-ins trend gently upward. Keep doing what works!'
            : "Recent days have been a little heavier. Be extra kind to yourself — and I'm always here to talk.",
      })
    }
    return out.slice(0, 3)
  }, [trend, weekday])

  // build SVG path from trend
  const path = useMemo(() => {
    const known = trend.map((t, i) => ({ i, avg: t.avg })).filter((t) => t.avg !== null) as { i: number; avg: number }[]
    if (known.length < 2) return null
    const pts = known.map((k) => `${(k.i / 29) * 1000},${200 - (k.avg / 10) * 180 - 10}`)
    return `M${pts.join(' L')}`
  }, [trend])

  const rangeLabel = `${new Date(trend[0].date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short' })} – ${new Date(
    trend[29].date + 'T12:00:00'
  ).toLocaleDateString('en-US', { month: 'short' })}`.toUpperCase()

  let bestWeekdayIdx = 0
  weekday.forEach((v, i) => {
    const best = weekday[bestWeekdayIdx]
    if (v !== null && (best === null || v > best)) bestWeekdayIdx = i
  })

  return (
    <PageShell>
      <header className="flex flex-col md:flex-row items-center justify-between gap-6 mb-10 bg-white p-8 md:p-10 rounded-[3rem] puffy-shadow-soft relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-fixed opacity-20 rounded-full -mr-20 -mt-20 blur-3xl" />
        <div className="z-10 text-center md:text-left">
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">Your Insights</h1>
          <p className="text-tertiary max-w-lg">
            {currentUser ? `Great work, ${currentUser}! ` : ''}
            {moods.length > 0
              ? "You've been checking in — let's see how things have shaped up."
              : 'Once you start checking in, your patterns will bloom here.'}
          </p>
        </div>
        <div className="w-40 h-40 md:w-48 md:h-48 bg-surface-container-high rounded-full flex items-center justify-center relative z-10 border-8 border-white shadow-inner">
          <TadFace size={130} mood="good" />
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {insights.map((ins) => (
          <PuffyCard key={ins.title} className="p-8 flex flex-col gap-4">
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center text-primary shadow-inner">
              <Icon name={ins.icon} />
            </div>
            <h3 className="font-display text-xl font-semibold leading-tight">{ins.title}</h3>
            <p className="text-tertiary">{ins.body}</p>
          </PuffyCard>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <PuffyCard hover={false} className="lg:col-span-2 p-8 md:p-10 relative overflow-hidden">
          <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
            <div>
              <h2 className="font-display text-2xl md:text-3xl font-bold">30-Day Mood Trend</h2>
              <p className="text-tertiary">Your emotional journey over the past month</p>
            </div>
            <div className="bg-surface-container-low px-4 py-2 rounded-full text-xs font-semibold tracking-widest text-tertiary">{rangeLabel}</div>
          </div>
          <div className="h-64 w-full relative mt-6">
            {path ? (
              <svg className="w-full h-full" viewBox="0 0 1000 200" preserveAspectRatio="none" style={{ filter: 'drop-shadow(0 0 8px rgba(219,0,49,0.4))' }}>
                <path d={path} fill="none" stroke="#DB0031" strokeLinecap="round" strokeLinejoin="round" strokeWidth="6" />
                <path d={`${path} L1000,200 L0,200 Z`} fill="url(#grad1)" opacity="0.12" />
                <defs>
                  <linearGradient id="grad1" x1="0%" x2="0%" y1="0%" y2="100%">
                    <stop offset="0%" style={{ stopColor: '#DB0031', stopOpacity: 1 }} />
                    <stop offset="100%" style={{ stopColor: '#DB0031', stopOpacity: 0 }} />
                  </linearGradient>
                </defs>
              </svg>
            ) : (
              <div className="h-full flex items-center justify-center text-tertiary text-center px-8">
                Log moods on at least two days and your trend line will appear here.
              </div>
            )}
            <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-slate-300 font-semibold py-1 pointer-events-none">
              <span>High</span>
              <span>Mid</span>
              <span>Low</span>
            </div>
          </div>
        </PuffyCard>

        <PuffyCard hover={false} className="p-8 md:p-10">
          <div className="mb-8">
            <h2 className="font-display text-2xl md:text-3xl font-bold">Weekly Average</h2>
            <p className="text-tertiary">Mood by day of week</p>
          </div>
          <div className="space-y-4">
            {DAY_NAMES.map((d, i) => (
              <div key={d} className="flex items-center gap-4">
                <span className="w-8 text-xs font-bold text-slate-400">{d}</span>
                <div className="flex-1 bg-surface-container-low h-8 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-700"
                    style={{ width: weekday[i] !== null ? `${(weekday[i]! / 10) * 100}%` : '0%' }}
                  />
                </div>
                <span className="text-xs font-bold w-8 text-right">{weekday[i] !== null ? weekday[i]!.toFixed(1) : '–'}</span>
              </div>
            ))}
          </div>
          {weekday[bestWeekdayIdx] !== null && (
            <div className="mt-8 p-4 bg-red-50 rounded-2xl text-primary text-sm font-semibold flex items-center gap-2">
              <Icon name="info" />
              Your {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][bestWeekdayIdx]} moods shine brightest!
            </div>
          )}
        </PuffyCard>
      </div>

      <PuffyCard hover={false} className="mt-10 !bg-primary text-white p-10 md:p-12 text-center relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="font-display text-2xl md:text-3xl font-bold mb-3">Want to lift your daily score?</h2>
          <p className="mb-8 opacity-90 max-w-xl mx-auto">A quick chat or a slow breath can reset the whole afternoon. I'm here whenever you're ready.</p>
          <button
            onClick={() => navigate('/chat')}
            className="bg-white text-primary font-bold px-10 py-4 rounded-full hover:scale-105 active:scale-95 transition-all shadow-xl"
          >
            Talk to TadBuddy
          </button>
        </div>
      </PuffyCard>
    </PageShell>
  )
}
