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

export interface Settings {
  soundEnabled: boolean
  ttsEnabled: boolean
}
