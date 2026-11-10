import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageShell from '../components/PageShell'
import PuffyCard from '../components/PuffyCard'
import TadFace from '../components/TadFace'
import Icon from '../components/Icon'
import Disclaimer from '../components/Disclaimer'

interface Question {
  id: string
  text: string
  options: string[]
}

const QUESTIONS: Question[] = [
  { id: 'area', text: 'Where are you feeling it most?', options: ['Head', 'Chest', 'Stomach', 'Muscles / joints', 'Mostly my mood', 'Somewhere else'] },
  { id: 'duration', text: 'How long has it been going on?', options: ['Just today', 'A few days', 'About a week', 'Longer than a week'] },
  { id: 'severity', text: 'How much is it affecting your day?', options: ['Barely at all', 'A little annoying', 'Hard to ignore', "It's really disrupting things"] },
  { id: 'sleep', text: 'How has your sleep been lately?', options: ['Pretty good', 'A bit off', 'Poor', 'Barely sleeping'] },
  { id: 'care', text: 'Have you been able to eat, hydrate, and rest today?', options: ['Yes, all three', 'Some of them', 'Not really'] },
]

function buildSummary(answers: Record<string, string>): { headline: string; tips: string[]; urgent: boolean } {
  const urgent = answers.severity === "It's really disrupting things" || answers.duration === 'Longer than a week' || answers.sleep === 'Barely sleeping'
  const tips: string[] = []
  if (answers.area === 'Head') tips.push('Screen breaks, hydration, and a dim, quiet room often help head discomfort.')
  if (answers.area === 'Stomach') tips.push('Gentle foods, warm water, and rest are kind to an unsettled stomach.')
  if (answers.area === 'Muscles / joints') tips.push('Light stretching and warmth can ease tense muscles.')
  if (answers.area === 'Chest') tips.push('Chest symptoms deserve prompt attention from a medical professional — please don’t wait on these.')
  if (answers.area === 'Mostly my mood') tips.push('Moods are health too. A chat, a walk, or reaching out to someone you trust all count as real care.')
  if (answers.sleep === 'Poor' || answers.sleep === 'Barely sleeping') tips.push('Prioritizing sleep tonight may help more than anything else — try a consistent wind-down hour.')
  if (answers.care === 'Not really') tips.push('Start tiny: a glass of water and a small snack are a genuine first step.')
  if (tips.length === 0) tips.push('Keep listening to your body, rest when you can, and be patient with yourself.')
  return {
    headline: urgent
      ? 'Please consider checking in with a healthcare professional soon.'
      : 'This sounds manageable with some gentle self-care.',
    tips,
    urgent,
  }
}

export default function SymptomChecker() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const done = step >= QUESTIONS.length
  const summary = done ? buildSummary(answers) : null

  const answer = (opt: string) => {
    setAnswers((a) => ({ ...a, [QUESTIONS[step].id]: opt }))
    setStep((s) => s + 1)
  }

  return (
    <PageShell>
      <div className="max-w-3xl mx-auto">
        <header className="text-center mb-10">
          <div className="flex justify-center mb-4">
            <TadFace size={100} mood={done ? 'good' : 'neutral'} />
          </div>
          <h1 className="font-display text-4xl font-bold mb-2">Gentle Symptom Check</h1>
          <p className="text-tertiary max-w-lg mx-auto">
            A few soft questions to help you reflect. This is guidance for self-care only — never a diagnosis.
          </p>
        </header>

        {/* progress */}
        <div className="w-full h-2 bg-surface-variant rounded-full overflow-hidden mb-10">
          <motion.div
            className="h-full bg-primary-bright rounded-full"
            animate={{ width: `${(Math.min(step, QUESTIONS.length) / QUESTIONS.length) * 100}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>

        <AnimatePresence mode="wait">
          {!done ? (
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.35 }}
            >
              <PuffyCard hover={false} className="p-8 md:p-10">
                <p className="text-xs font-semibold tracking-widest text-slate-400 uppercase mb-2">
                  Question {step + 1} of {QUESTIONS.length}
                </p>
                <h2 className="font-display text-2xl font-semibold mb-8">{QUESTIONS[step].text}</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  {QUESTIONS[step].options.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => answer(opt)}
                      className="text-left bg-surface-container-low hover:bg-red-50 hover:text-primary border-2 border-transparent hover:border-primary-bright/20 rounded-3xl px-6 py-5 transition-all hover:scale-[1.02] active:scale-95 font-medium"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                {step > 0 && (
                  <button onClick={() => setStep((s) => s - 1)} className="mt-6 text-sm text-slate-400 hover:text-primary flex items-center gap-1">
                    <Icon name="arrow_back" className="!text-sm" /> Back
                  </button>
                )}
              </PuffyCard>
            </motion.div>
          ) : (
            <motion.div key="result" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
              <PuffyCard hover={false} className={`p-8 md:p-10 ${summary!.urgent ? 'ring-4 ring-primary-bright/20' : ''}`}>
                <div className="flex items-center gap-4 mb-6">
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center ${summary!.urgent ? 'bg-red-50 text-primary' : 'bg-emerald-50 text-emerald-600'}`}>
                    <Icon name={summary!.urgent ? 'medical_services' : 'spa'} filled />
                  </div>
                  <h2 className="font-display text-2xl font-semibold leading-tight">{summary!.headline}</h2>
                </div>
                <ul className="space-y-4 mb-8">
                  {summary!.tips.map((t) => (
                    <li key={t} className="flex items-start gap-3 text-on-surface-variant">
                      <Icon name="favorite" filled className="text-primary-bright !text-lg mt-0.5 shrink-0" />
                      {t}
                    </li>
                  ))}
                </ul>
                {summary!.urgent && (
                  <div className="bg-red-50 rounded-2xl p-5 mb-8 text-primary text-sm font-medium flex items-start gap-3">
                    <Icon name="emergency" className="shrink-0" />
                    Symptoms that are severe, persistent, or worrying deserve real medical eyes. Please reach out to a clinician — and for emergencies, contact local emergency services right away.
                  </div>
                )}
                <div className="flex flex-wrap gap-4">
                  <button
                    onClick={() => navigate('/chat')}
                    className="bg-primary-bright text-white font-bold px-8 py-4 rounded-full hover:scale-105 active:scale-95 transition-transform"
                  >
                    Talk it through with TadBuddy
                  </button>
                  <button
                    onClick={() => {
                      setStep(0)
                      setAnswers({})
                    }}
                    className="bg-surface-container-low font-bold px-8 py-4 rounded-full hover:scale-105 active:scale-95 transition-transform"
                  >
                    Start over
                  </button>
                </div>
                <Disclaimer className="mt-8 !justify-start" />
              </PuffyCard>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageShell>
  )
}
