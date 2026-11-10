# TadBuddy — Your Friendly AI Health Companion (Frontend)

Warm, empathetic health-companion web app with an inflatable-robot mascot, daily 1–10 mood check-ins, an AI chat that doubles as a journal, mood history, insights, a gentle symptom checker, wellness tasks, and reminders.

## Run it

```bash
npm install
npm run dev      # open the printed localhost URL
npm run build    # production build (verified passing)
```

## Connect the TADBuddy backend (RAG + memory)

The chat can talk to the v2 API in `../backend` (local LLM via Ollama, counseling-example retrieval, long-term memory).

1. Start the backend (see `../backend/ARCHITECTURE.md`, "Running it"): `docker compose up api`
2. Create `.env` here:
   ```
   VITE_TADBUDDY_API_URL=http://localhost:8000
   ```
3. `npm run dev` (must be on port 5173 — the API's CORS allows that origin).

Chat priority: TADBuddy API → xAI (if `VITE_XAI_API_KEY` set) → built-in mock. With the backend on, **Settings → What TadBuddy remembers** lists stored memories and lets you delete them. Identity is a per-user UUID sent as `X-User-Id` (backend `AUTH_MODE=dev`) — replace with real auth before deploying.

## Connect the real LLM (xAI Grok) — alternative

Create a `.env` file in the project root:

```
VITE_XAI_API_KEY=your-key-here
```

Model/endpoint/system-prompt live in `src/config/ai.ts`. Without a key, chat runs in a friendly built-in mock mode so the whole UI is usable.

> Note: a key in frontend code is visible to anyone using the site. Fine for local dev; put the call behind a small backend before deploying publicly.

## Screens & flow

1. **Splash** (`/`) — sound on/off choice, inflate + blink animation, spoken greeting (Web Speech TTS)
2. **Login** (`/login`) — sign up / sign in, unique-name check, password show/hide toggle, SHA-256 hashed passwords in localStorage
3. **Mood Check** (`/mood`) — 10 hover-pop mood bubbles (deflated → inflated), warm per-score comment, auto-transition to chat
4. **Chat** (`/chat`) — streaming replies, mic input (Web Speech STT), optional spoken replies, keyword highlighting, crisis keyword detection with helpline info, saved as journal
5. **Mood History** (`/history`) — color-coded calendar + recent journal entry cards
6. **Insights** (`/insights`) — 30-day trend line, weekday averages, auto-generated insight cards (weekend effect, best day, trend shift)
7. **Symptom Checker** (`/symptoms`) — guided non-diagnostic questions with self-care suggestions
8. **Tasks** (`/tasks`) — wellness to-dos with progress bar
9. **Settings** (`/settings`) — voice toggles, reminders, privacy (delete all data), logout
10. **Dashboard** (`/dashboard`) — greeting, streak, shortcuts to everything

## Stack

Vite · React 18 · TypeScript · Tailwind CSS · Framer Motion · Zustand · React Router · Web Speech API. All data stays in the browser (localStorage) — no server.

## Where things live

- `src/config/ai.ts` — API key, model, system prompt
- `src/lib/` — ai streaming, mood responses, crisis detection, keyword highlighting, speech (TTS/STT), hashing, storage
- `src/store/useAppStore.ts` — all app state + persistence
- `src/components/TadFace.tsx` — the mascot (SVG, blinks, mood-reactive)
- `src/screens/` — one file per screen
