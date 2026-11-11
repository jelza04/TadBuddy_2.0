import { useEffect, useState } from 'react'
import { backendEnabled, deleteMemory, fetchMemories, type Memory } from '../lib/backend'
import { useNavigate } from 'react-router-dom'
import PageShell from '../components/PageShell'
import PuffyCard from '../components/PuffyCard'
import TadFace from '../components/TadFace'
import Icon from '../components/Icon'
import { useAppStore, useMyReminders } from '../store/useAppStore'

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`w-14 h-8 rounded-full p-1 transition-colors ${on ? 'bg-primary-bright' : 'bg-slate-200'}`}
      role="switch"
      aria-checked={on}
    >
      <div className={`w-6 h-6 bg-white rounded-full shadow transition-transform ${on ? 'translate-x-6' : ''}`} />
    </button>
  )
}

export default function Settings() {
  const navigate = useNavigate()
  const settings = useAppStore((s) => s.settings)
  const setSettings = useAppStore((s) => s.setSettings)
  const currentUser = useAppStore((s) => s.currentUser)
  const logout = useAppStore((s) => s.logout)
  const clearMyData = useAppStore((s) => s.clearMyData)
  const reminders = useMyReminders()
  const addReminder = useAppStore((s) => s.addReminder)
  const toggleReminder = useAppStore((s) => s.toggleReminder)
  const deleteReminder = useAppStore((s) => s.deleteReminder)

  const [label, setLabel] = useState('')
  const [time, setTime] = useState('09:00')
  const [confirmClear, setConfirmClear] = useState(false)
  const [memories, setMemories] = useState<Memory[] | null>(null)
  const [memoryError, setMemoryError] = useState<string | null>(null)

  useEffect(() => {
    if (!backendEnabled() || !currentUser) return
    fetchMemories(currentUser)
      .then(setMemories)
      .catch(() => setMemoryError("Couldn't reach the TADBuddy server."))
  }, [currentUser])

  const forget = async (id?: number) => {
    if (!currentUser) return
    try {
      await deleteMemory(currentUser, id)
      setMemories((prev) => (id === undefined ? [] : (prev ?? []).filter((m) => m.id !== id)))
    } catch {
      setMemoryError("Couldn't delete that right now. Try again in a moment.")
    }
  }

  return (
    <PageShell>
      <div className="max-w-3xl mx-auto">
        <header className="flex items-center gap-5 mb-10">
          <div className="w-20 h-20 bg-white rounded-full puffy-shadow flex items-center justify-center overflow-hidden">
            <TadFace size={64} body={false} className="mt-2" />
          </div>
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-bold">Settings</h1>
            <p className="text-on-surface-variant mt-1">Signed in as <span className="font-bold text-primary">{currentUser}</span></p>
          </div>
        </header>

        <PuffyCard hover={false} className="p-8 mb-8">
          <h2 className="font-display text-xl font-semibold mb-6">Sound & Voice</h2>
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">Speak replies aloud</p>
                <p className="text-sm text-slate-400">TadBuddy reads its messages using your device's voice.</p>
              </div>
              <Toggle on={settings.ttsEnabled} onChange={() => setSettings({ ttsEnabled: !settings.ttsEnabled })} />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">Welcome sounds</p>
                <p className="text-sm text-slate-400">Spoken greeting on the opening screen.</p>
              </div>
              <Toggle on={settings.soundEnabled} onChange={() => setSettings({ soundEnabled: !settings.soundEnabled })} />
            </div>
          </div>
        </PuffyCard>

        <PuffyCard hover={false} className="p-8 mb-8">
          <h2 className="font-display text-xl font-semibold mb-2">Gentle Reminders</h2>
          <p className="text-sm text-slate-400 mb-6">Little nudges while the app is open — like a daily check-in time.</p>
          <form
            className="flex flex-col sm:flex-row gap-3 mb-6"
            onSubmit={(e) => {
              e.preventDefault()
              if (!label.trim()) return
              addReminder(label, time)
              setLabel('')
            }}
          >
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Evening mood check-in"
              className="flex-1 bg-surface-container-low border-none rounded-full px-6 py-3.5 focus:ring-4 focus:ring-primary-bright/10 outline-none placeholder:text-slate-400"
            />
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="bg-surface-container-low border-none rounded-full px-6 py-3.5 outline-none text-slate-500"
            />
            <button type="submit" className="bg-primary-bright text-white font-bold px-6 py-3.5 rounded-full hover:scale-105 active:scale-95 transition-transform">
              Add
            </button>
          </form>
          {reminders.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">No reminders yet.</p>
          ) : (
            <div className="space-y-3">
              {reminders.map((r) => (
                <div key={r.id} className="flex items-center gap-4 bg-surface-container-low rounded-2xl px-5 py-4">
                  <Icon name="alarm" className="text-primary-bright" />
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium truncate ${r.enabled ? '' : 'text-slate-400 line-through'}`}>{r.label}</p>
                    <p className="text-xs text-slate-400">{r.time}</p>
                  </div>
                  <Toggle on={r.enabled} onChange={() => toggleReminder(r.id)} />
                  <button onClick={() => deleteReminder(r.id)} className="text-slate-300 hover:text-primary-bright" aria-label="Delete reminder">
                    <Icon name="delete" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </PuffyCard>

        {backendEnabled() && (
          <PuffyCard hover={false} className="p-8 mb-8">
            <h2 className="font-display text-xl font-semibold mb-2">What TadBuddy remembers</h2>
            <p className="text-sm text-slate-400 mb-6">
              Little things you've shared that help TadBuddy follow along between chats. Remove anything you'd rather it forgot.
            </p>
            {memoryError && <p className="text-sm text-primary-bright mb-4">{memoryError}</p>}
            {memories === null && !memoryError ? (
              <p className="text-sm text-slate-400 text-center py-4">Loading…</p>
            ) : memories && memories.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">Nothing remembered yet.</p>
            ) : (
              <>
                <div className="space-y-3 mb-6">
                  {(memories ?? []).map((m) => (
                    <div key={m.id} className="flex items-center gap-4 bg-surface-container-low rounded-2xl px-5 py-4">
                      <Icon name="psychology" className="text-primary-bright" />
                      <p className="flex-1 min-w-0">{m.content}</p>
                      <button onClick={() => forget(m.id)} className="text-slate-300 hover:text-primary-bright" aria-label="Forget this">
                        <Icon name="delete" />
                      </button>
                    </div>
                  ))}
                </div>
                {memories && memories.length > 0 && (
                  <button
                    onClick={() => forget()}
                    className="bg-red-50 text-primary font-bold px-6 py-3.5 rounded-full hover:scale-105 active:scale-95 transition-transform"
                  >
                    Forget everything
                  </button>
                )}
              </>
            )}
          </PuffyCard>
        )}

        <PuffyCard hover={false} className="p-8 mb-8">
          <h2 className="font-display text-xl font-semibold mb-6">Privacy & Data</h2>
          <p className="text-sm text-slate-500 mb-6">
            {backendEnabled()
              ? 'Mood entries, tasks and reminders stay in this browser. Chat messages are sent to your TADBuddy server so it can reply and remember context.'
              : "Everything you share with TadBuddy stays in this browser (localStorage). Nothing is uploaded anywhere. You're in control."}
          </p>
          <div className="flex flex-wrap gap-4">
            {!confirmClear ? (
              <button
                onClick={() => setConfirmClear(true)}
                className="bg-red-50 text-primary font-bold px-6 py-3.5 rounded-full hover:scale-105 active:scale-95 transition-transform"
              >
                Delete all my data
              </button>
            ) : (
              <>
                <button
                  onClick={() => {
                    clearMyData()
                    if (backendEnabled()) forget()
                    setConfirmClear(false)
                  }}
                  className="bg-primary-bright text-white font-bold px-6 py-3.5 rounded-full hover:scale-105 active:scale-95 transition-transform"
                >
                  Yes, delete everything
                </button>
                <button onClick={() => setConfirmClear(false)} className="bg-surface-container-low font-bold px-6 py-3.5 rounded-full">
                  Keep my data
                </button>
              </>
            )}
            <button
              onClick={() => {
                logout()
                navigate('/login')
              }}
              className="bg-surface-container-low font-bold px-6 py-3.5 rounded-full hover:scale-105 active:scale-95 transition-transform flex items-center gap-2"
            >
              <Icon name="logout" className="!text-lg" /> Log out
            </button>
          </div>
        </PuffyCard>
      </div>
    </PageShell>
  )
}
