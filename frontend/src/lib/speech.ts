// Text-to-Speech via Web Speech API
export function speak(text: string, enabled: boolean): void {
  if (!enabled || !('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utter = new SpeechSynthesisUtterance(text)
  utter.rate = 0.95
  utter.pitch = 1.1
  const voices = window.speechSynthesis.getVoices()
  const preferred = voices.find((v) => v.lang.startsWith('en') && /female|samantha|zira|google us/i.test(v.name))
  if (preferred) utter.voice = preferred
  window.speechSynthesis.speak(utter)
}

export function stopSpeaking(): void {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
}

// Speech-to-Text via Web Speech API (with vendor prefix fallback)
type SpeechRecognitionLike = {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: ((e: unknown) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

export function createRecognizer(
  onResult: (text: string) => void,
  onEnd: () => void,
  onError: (msg: string) => void
): SpeechRecognitionLike | null {
  const w = window as unknown as Record<string, unknown>
  const Ctor = (w.SpeechRecognition || w.webkitSpeechRecognition) as (new () => SpeechRecognitionLike) | undefined
  if (!Ctor) {
    onError('Voice input is not supported in this browser. Please type instead.')
    return null
  }
  const rec = new Ctor()
  rec.lang = 'en-US'
  rec.interimResults = false
  rec.continuous = false
  rec.onresult = (e) => {
    const transcript = Array.from({ length: e.results.length }, (_, i) => e.results[i][0].transcript).join(' ')
    onResult(transcript)
  }
  rec.onerror = () => onError('Could not hear you clearly. Please try again or type instead.')
  rec.onend = onEnd
  return rec
}
