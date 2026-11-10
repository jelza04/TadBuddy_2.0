import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import PageShell from '../components/PageShell'
import PuffyCard from '../components/PuffyCard'
import TadFace from '../components/TadFace'
import Icon from '../components/Icon'
import { useAppStore, useMyTasks } from '../store/useAppStore'

export default function Tasks() {
  const tasks = useMyTasks()
  const addTask = useAppStore((s) => s.addTask)
  const toggleTask = useAppStore((s) => s.toggleTask)
  const deleteTask = useAppStore((s) => s.deleteTask)

  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')

  const open = tasks.filter((t) => !t.done)
  const doneList = tasks.filter((t) => t.done)
  const progress = tasks.length ? Math.round((doneList.length / tasks.length) * 100) : 0

  return (
    <PageShell>
      <div className="max-w-3xl mx-auto">
        <header className="flex items-center gap-5 mb-10">
          <div className="w-20 h-20 bg-white rounded-full puffy-shadow flex items-center justify-center overflow-hidden">
            <TadFace size={64} body={false} mood={progress >= 70 ? 'happy' : 'neutral'} className="mt-2" />
          </div>
          <div>
            <h1 className="font-display text-4xl md:text-5xl font-bold">Wellness Tasks</h1>
            <p className="text-on-surface-variant mt-1">Tiny steps count. I'll cheer for every one.</p>
          </div>
        </header>

        {tasks.length > 0 && (
          <PuffyCard hover={false} className="p-6 mb-8 flex items-center gap-5">
            <div className="flex-1">
              <div className="flex justify-between text-sm mb-2">
                <span className="font-semibold">Today's progress</span>
                <span className="text-primary font-bold">{progress}%</span>
              </div>
              <div className="h-3 bg-surface-container-low rounded-full overflow-hidden">
                <motion.div className="h-full bg-primary-bright rounded-full" animate={{ width: `${progress}%` }} transition={{ duration: 0.6 }} />
              </div>
            </div>
            {progress === 100 && <Icon name="celebration" filled className="text-primary-bright !text-3xl" />}
          </PuffyCard>
        )}

        <PuffyCard hover={false} className="p-6 mb-10">
          <form
            className="flex flex-col sm:flex-row gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (!title.trim()) return
              addTask(title, due || undefined)
              setTitle('')
              setDue('')
            }}
          >
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Add a gentle goal… e.g. 10-minute walk"
              className="flex-1 bg-surface-container-low border-none rounded-full px-6 py-4 focus:ring-4 focus:ring-primary-bright/10 outline-none placeholder:text-slate-400"
            />
            <input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="bg-surface-container-low border-none rounded-full px-6 py-4 focus:ring-4 focus:ring-primary-bright/10 outline-none text-slate-500"
            />
            <button
              type="submit"
              className="bg-primary-bright text-white font-bold px-8 py-4 rounded-full hover:scale-105 active:scale-95 transition-transform flex items-center gap-2 justify-center"
            >
              <Icon name="add" /> Add
            </button>
          </form>
        </PuffyCard>

        {tasks.length === 0 && (
          <PuffyCard hover={false} className="p-12 text-center text-on-surface-variant">
            No tasks yet. Add something small and kind to yourself — like “drink a glass of water.”
          </PuffyCard>
        )}

        <div className="space-y-4">
          <AnimatePresence>
            {[...open, ...doneList].map((t) => (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 40 }}
                className={`bg-white rounded-3xl puffy-shadow-soft px-6 py-5 flex items-center gap-4 ${t.done ? 'opacity-60' : ''}`}
              >
                <button
                  onClick={() => toggleTask(t.id)}
                  className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition-all active:scale-90 ${
                    t.done ? 'bg-primary-bright border-primary-bright text-white' : 'border-slate-300 hover:border-primary-bright'
                  }`}
                  aria-label={t.done ? 'Mark as not done' : 'Mark as done'}
                >
                  {t.done && <Icon name="check" className="!text-lg" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`font-medium truncate ${t.done ? 'line-through text-slate-400' : ''}`}>{t.title}</p>
                  {t.due && (
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                      <Icon name="event" className="!text-xs" />
                      {new Date(t.due + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </p>
                  )}
                </div>
                <button onClick={() => deleteTask(t.id)} className="text-slate-300 hover:text-primary-bright transition-colors" aria-label="Delete task">
                  <Icon name="delete" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </PageShell>
  )
}
