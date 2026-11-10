export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`tadbuddy:${key}`)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function save<T>(key: string, value: T): void {
  try {
    localStorage.setItem(`tadbuddy:${key}`, JSON.stringify(value))
  } catch {
    // storage full or unavailable — fail silently
  }
}

export function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}
