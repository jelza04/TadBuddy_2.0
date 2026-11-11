export interface User {
  name: string
  passwordHash: string
  createdAt: string
}

export interface MoodEntry {
  id: string
  user: string
  score: number
  note?: string
  date: string // ISO date (yyyy-mm-dd)
  createdAt: string
}

export interface ChatMessage {
  id: string
  user: string
  role: 'user' | 'assistant'
  text: string
  createdAt: string
}

export interface TaskItem {
  id: string
  user: string
  title: string
  done: boolean
  due?: string
  createdAt: string
}

export interface Reminder {
  id: string
  user: string
  label: string
  time: string // HH:mm
  enabled: boolean
}

/** Extra context carried into the chat, e.g. the result of a symptom check. */
export interface ChatContext {
  user: string
  source: 'symptom_check'
  /** sent to the backend so the LLM knows what happened */
  summary: string
  /** TadBuddy's first message when the chat opens */
  opener: string
  openerShown?: boolean
  createdAt: string
}

export interface Settings {
  soundEnabled: boolean
  ttsEnabled: boolean
}
