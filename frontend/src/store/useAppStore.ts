import { useMemo } from 'react'
import { create } from 'zustand'
import { load, save, uid } from '../lib/storage'
import { sha256 } from '../lib/hash'
import type { ChatContext, ChatMessage, MoodEntry, Reminder, Settings, TaskItem, User } from '../lib/types'

interface AppState {
  currentUser: string | null
  users: User[]
  moods: MoodEntry[]
  messages: ChatMessage[]
  tasks: TaskItem[]
  reminders: Reminder[]
  settings: Settings
  todayMood: number | null
  /** context to carry into the next chat (symptom check result) */
  chatContext: ChatContext | null
  /** chat has been "minimized" into the floating bubble */
  buddyDocked: boolean

  setChatContext: (ctx: Omit<ChatContext, 'user' | 'createdAt'> | null) => void
  markContextOpened: () => void
  setBuddyDocked: (docked: boolean) => void

  register: (name: string, password: string) => Promise<string | null>
  login: (name: string, password: string) => Promise<string | null>
  logout: () => void

  addMood: (score: number, note?: string) => void
  addMessage: (role: 'user' | 'assistant', text: string) => ChatMessage
  updateMessage: (id: string, text: string) => void

  addTask: (title: string, due?: string) => void
  toggleTask: (id: string) => void
  deleteTask: (id: string) => void

  addReminder: (label: string, time: string) => void
  toggleReminder: (id: string) => void
  deleteReminder: (id: string) => void

  setSettings: (patch: Partial<Settings>) => void
  clearMyData: () => void
}

const today = () => new Date().toISOString().slice(0, 10)

export const useAppStore = create<AppState>((set, get) => ({
  currentUser: load<string | null>('currentUser', null),
  users: load<User[]>('users', []),
  moods: load<MoodEntry[]>('moods', []),
  messages: load<ChatMessage[]>('messages', []),
  tasks: load<TaskItem[]>('tasks', []),
  reminders: load<Reminder[]>('reminders', []),
  settings: load<Settings>('settings', { soundEnabled: true, ttsEnabled: false }),
  todayMood: null,
  chatContext: load<ChatContext | null>('chatContext', null),
  buddyDocked: load<boolean>('buddyDocked', false),

  setChatContext: (ctx) => {
    const user = get().currentUser
    const next = ctx && user ? { ...ctx, user, createdAt: new Date().toISOString() } : null
    save('chatContext', next)
    set({ chatContext: next })
  },

  markContextOpened: () => {
    const ctx = get().chatContext
    if (!ctx) return
    const next = { ...ctx, openerShown: true }
    save('chatContext', next)
    set({ chatContext: next })
  },

  setBuddyDocked: (docked) => {
    save('buddyDocked', docked)
    set({ buddyDocked: docked })
  },

  register: async (name, password) => {
    const clean = name.trim()
    if (clean.length < 2) return 'Name must be at least 2 characters.'
    if (password.length < 6) return 'Password must be at least 6 characters.'
    const { users } = get()
    if (users.some((u) => u.name.toLowerCase() === clean.toLowerCase()))
      return 'That name is already taken. Please choose another.'
    const user: User = { name: clean, passwordHash: await sha256(password), createdAt: new Date().toISOString() }
    const next = [...users, user]
    save('users', next)
    save('currentUser', clean)
    set({ users: next, currentUser: clean })
    return null
  },

  login: async (name, password) => {
    const clean = name.trim()
    const user = get().users.find((u) => u.name.toLowerCase() === clean.toLowerCase())
    if (!user) return "We couldn't find that name. Try signing up instead?"
    if (user.passwordHash !== (await sha256(password))) return 'Incorrect password. Please try again.'
    save('currentUser', user.name)
    set({ currentUser: user.name })
    return null
  },

  logout: () => {
    save('currentUser', null)
    set({ currentUser: null, todayMood: null })
  },

  addMood: (score, note) => {
    const user = get().currentUser
    if (!user) return
    const entry: MoodEntry = { id: uid(), user, score, note, date: today(), createdAt: new Date().toISOString() }
    const next = [...get().moods, entry]
    save('moods', next)
    set({ moods: next, todayMood: score })
  },

  addMessage: (role, text) => {
    const user = get().currentUser ?? 'guest'
    const msg: ChatMessage = { id: uid(), user, role, text, createdAt: new Date().toISOString() }
    const next = [...get().messages, msg]
    save('messages', next)
    set({ messages: next })
    return msg
  },

  updateMessage: (id, text) => {
    const next = get().messages.map((m) => (m.id === id ? { ...m, text } : m))
    save('messages', next)
    set({ messages: next })
  },

  addTask: (title, due) => {
    const user = get().currentUser
    if (!user || !title.trim()) return
    const next = [...get().tasks, { id: uid(), user, title: title.trim(), done: false, due, createdAt: new Date().toISOString() }]
    save('tasks', next)
    set({ tasks: next })
  },

  toggleTask: (id) => {
    const next = get().tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    save('tasks', next)
    set({ tasks: next })
  },

  deleteTask: (id) => {
    const next = get().tasks.filter((t) => t.id !== id)
    save('tasks', next)
    set({ tasks: next })
  },

  addReminder: (label, time) => {
    const user = get().currentUser
    if (!user || !label.trim()) return
    const next = [...get().reminders, { id: uid(), user, label: label.trim(), time, enabled: true }]
    save('reminders', next)
    set({ reminders: next })
  },

  toggleReminder: (id) => {
    const next = get().reminders.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    save('reminders', next)
    set({ reminders: next })
  },

  deleteReminder: (id) => {
    const next = get().reminders.filter((r) => r.id !== id)
    save('reminders', next)
    set({ reminders: next })
  },

  setSettings: (patch) => {
    const next = { ...get().settings, ...patch }
    save('settings', next)
    set({ settings: next })
  },

  clearMyData: () => {
    const user = get().currentUser
    if (!user) return
    const moods = get().moods.filter((m) => m.user !== user)
    const messages = get().messages.filter((m) => m.user !== user)
    const tasks = get().tasks.filter((t) => t.user !== user)
    const reminders = get().reminders.filter((r) => r.user !== user)
    save('moods', moods)
    save('messages', messages)
    save('tasks', tasks)
    save('reminders', reminders)
    set({ moods, messages, tasks, reminders, todayMood: null })
  },
}))

// Convenient memoized selectors (avoid returning fresh arrays from the store selector)
export function useMyMoods(): MoodEntry[] {
  const moods = useAppStore((s) => s.moods)
  const user = useAppStore((s) => s.currentUser)
  return useMemo(() => moods.filter((m) => m.user === user), [moods, user])
}
export function useMyMessages(): ChatMessage[] {
  const messages = useAppStore((s) => s.messages)
  const user = useAppStore((s) => s.currentUser)
  return useMemo(() => messages.filter((m) => m.user === user), [messages, user])
}
export function useMyTasks(): TaskItem[] {
  const tasks = useAppStore((s) => s.tasks)
  const user = useAppStore((s) => s.currentUser)
  return useMemo(() => tasks.filter((t) => t.user === user), [tasks, user])
}
export function useMyReminders(): Reminder[] {
  const reminders = useAppStore((s) => s.reminders)
  const user = useAppStore((s) => s.currentUser)
  return useMemo(() => reminders.filter((r) => r.user === user), [reminders, user])
}
