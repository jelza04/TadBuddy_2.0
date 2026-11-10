/**
 * ============================================================
 *  TADBUDDY AI CONFIG — paste your xAI API key here to go live
 * ============================================================
 * 1. Set XAI_API_KEY to your key (or use import.meta.env.VITE_XAI_API_KEY via a .env file)
 * 2. Everything else works automatically. If the key is empty,
 *    the app uses a friendly built-in mock so the UI still works.
 *
 * NOTE: calling xAI directly from the browser exposes your key.
 * Fine for local dev — move behind a backend before deploying.
 */
export const XAI_API_KEY: string = (import.meta.env.VITE_XAI_API_KEY as string | undefined) ?? ''
export const XAI_MODEL = 'grok-4-1-fast' // adjust to your available model
export const XAI_URL = 'https://api.x.ai/v1/chat/completions'

export const SYSTEM_PROMPT = `You are TadBuddy, a caring, friendly, non-medical AI health companion with a soft, huggable inflatable-robot personality.
- Always be empathetic, gentle, warm, and slightly humorous.
- Never diagnose conditions, prescribe medication, or give medical advice.
- Add a brief "I'm not a medical professional" note when health topics come up.
- Encourage professional help for serious physical or mental health issues.
- Keep replies short and conversational (2-4 sentences).`
