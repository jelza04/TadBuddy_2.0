import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageShell from '../components/PageShell'
import PuffyCard from '../components/PuffyCard'
import TadFace, { moodFromScore } from '../components/TadFace'
import Icon from '../components/Icon'
import { moodBg, moodColor, moodBarColor, moodLabel } from '../lib/mood'
import { extractKeywords } from '../lib/keywords'
import { useMyMoods, useMyMessages } from '../store/useAppStore'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

export default function MoodHistory() {
  const navigate = useNavigate()
  const moods = useMyMoods()
  const messages = useMyMessages()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

  const byDate = useMemo(() => {
    const map = new Map<string, number[]>()
    for (const m of moods) {
      const arr = map.get(m.date) ?? []
      arr.push(m.score)
      map.set(m.date, arr)
    }
    return map
  }, [moods])

  const monthAvg = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`
    const scores = moods.filter((m) => m.date.startsWith(prefix)).map((m) => m.score)
    return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null
  }, [moods, year, month])

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const shiftMonth = (d: number) => {
    const next = new Date(year, month + d, 1)
    setYear(next.getFullYear())
    setMonth(next.getMonth())
  }

  // Journal entries: pair each mood with same-day user chat text
  const entries = useMemo(() => {
    return [...moods]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 12)
      .map((m) => {
        const dayMsgs = messages.filter((msg) => msg.role === 'user' && msg.createdAt.slice(0, 10) === m.date)
        const note = m.note ?? dayMsgs[0]?.text
        const keywords = dayMsgs.flatMap((msg) => extractKeywords(msg.text)).slice(0, 4)
        return { ...m, note, keywords }
      })
  }, [moods, messages])

  return (
    <PageShell>
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 px-2 pb-20 md:pb-0" style={{ paddingBottom: 0 }}>
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 bg-white rounded-full puffy-shadow flex items-center justify-center overflow-hidden">
            <TadFace size={64} body={false} mood="good" className="mt-2" />
          </div>
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-bold">Mood History</h1>
            <p className="text-on-surface-variant flex items-center gap-2 mt-1">
              <Icon name="trending_up" filled className="text-primary-bright" />
              Average this month:{' '}
              <span className="font-bold text-primary">{monthAvg !== null ? monthAvg.toFixed(1) : '—'}</span>
            </p>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <button onClick={() => shiftMonth(-1)} className="p-4 bg-white rounded-full puffy-shadow-soft text-on-surface-variant hover:text-primary transition-colors">
            <Icon name="chevron_left" />
          </button>
          <div className="px-6 py-4 bg-white rounded-full puffy-shadow-soft font-display font-semibold">
            {MONTHS[month]} {year}
          </div>
          <button onClick={() => shiftMonth(1)} className="p-4 bg-white rounded-full puffy-shadow-soft text-on-surface-variant hover:text-primary transition-colors">
            <Icon name="chevron_right" />
          </button>
        </div>
      </header>

      <PuffyCard hover={false} className="p-6 md:p-10 mb-14">
        <div className="grid grid-cols-7 gap-2 md:gap-4">
          {DAYS.map((d) => (
            <div key={d} className="text-center text-xs font-semibold tracking-widest text-on-surface-variant pb-3">
              {d}
            </div>
          ))}
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`sp-${i}`} className="aspect-square" />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
            const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const scores = byDate.get(key)
            const avg = scores ? scores.reduce((a, b) => a + b, 0) / scores.length : null
            return avg !== null ? (
              <motion.div
                key={day}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.92 }}
                className={`aspect-square ${moodBg(avg)} rounded-2xl flex flex-col items-center justify-center border-2 border-transparent hover:border-primary-bright/20 cursor-pointer`}
                title={`${moodLabel(avg)} (${avg.toFixed(1)})`}
              >
                <span className="text-xs md:text-sm text-slate-400 font-display">{day}</span>
                <span className={`font-bold text-sm md:text-base ${moodColor(avg)}`}>{avg.toFixed(1)}</span>
              </motion.div>
            ) : (
              <div key={day} className="aspect-square bg-white border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center text-slate-300">
                <span className="text-xs md:text-sm font-display">{day}</span>
              </div>
            )
          })}
        </div>
      </PuffyCard>

      <section>
        <div className="flex items-center justify-between mb-6 px-2">
          <h2 className="font-display text-2xl md:text-3xl font-bold">Recent Entries</h2>
          <button onClick={() => navigate('/mood')} className="text-primary font-bold flex items-center gap-2 hover:underline">
            New check-in <Icon name="arrow_forward" className="!text-sm" />
          </button>
        </div>

        {entries.length === 0 ? (
          <PuffyCard hover={false} className="p-10 text-center text-on-surface-variant">
            No entries yet. Do a mood check-in and chat with TadBuddy — your journal will grow here.
          </PuffyCard>
        ) : (
          <div className="flex gap-6 overflow-x-auto pb-8 snap-x snap-mandatory">
            {entries.map((e) => (
              <PuffyCard key={e.id} className="snap-start flex-none w-[300px] md:w-[320px] p-8 flex flex-col gap-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-semibold tracking-widest text-on-surface-variant uppercase">
                      {new Date(e.createdAt).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}
                    </p>
                    <h3 className={`font-display text-xl font-semibold mt-1 ${moodColor(e.score)}`}>{moodLabel(e.score)}</h3>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-full">
                    <TadFace size={36} mood={moodFromScore(e.score)} />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="h-2 flex-grow bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${moodBarColor(e.score)} rounded-full`} style={{ width: `${e.score * 10}%` }} />
                  </div>
                  <span className={`font-display font-semibold ${moodColor(e.score)}`}>{e.score}</span>
                </div>
                {e.note && <p className="text-on-surface-variant italic line-clamp-3">“{e.note}”</p>}
                {e.keywords.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {e.keywords.map((k) => (
                      <span key={k} className="text-xs bg-red-50 text-primary rounded-full px-3 py-1 font-semibold">
                        {k}
                      </span>
                    ))}
                  </div>
                )}
              </PuffyCard>
            ))}
          </div>
        )}
      </section>
    </PageShell>
  )
}
