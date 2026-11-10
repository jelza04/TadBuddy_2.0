import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

export type TadMood = 'sad' | 'low' | 'neutral' | 'good' | 'happy' | 'talking'

export function moodFromScore(score: number): TadMood {
  if (score <= 2) return 'sad'
  if (score <= 4) return 'low'
  if (score <= 6) return 'neutral'
  if (score <= 8) return 'good'
  return 'happy'
}

interface TadFaceProps {
  mood?: TadMood
  size?: number
  /** show the puffy white body circle behind the face */
  body?: boolean
  className?: string
}

/**
 * TadBuddy's minimalist inflatable-robot face: two dot eyes joined by a line,
 * with a mouth that changes by mood. Blinks on an interval.
 */
export default function TadFace({ mood = 'neutral', size = 120, body = true, className = '' }: TadFaceProps) {
  const [blink, setBlink] = useState(false)

  useEffect(() => {
    let closeTimer: ReturnType<typeof setTimeout>
    const timer = setInterval(() => {
      setBlink(true)
      closeTimer = setTimeout(() => setBlink(false), 140)
    }, 3200 + Math.random() * 1500)
    return () => {
      clearInterval(timer)
      clearTimeout(closeTimer)
    }
  }, [])

  const eyeRy = blink ? 0.6 : 5
  const mouth: Record<TadMood, JSX.Element | null> = {
    sad: <path d="M 42 74 Q 50 66 58 74" stroke="#121c28" strokeWidth="2.5" fill="none" strokeLinecap="round" />,
    low: <path d="M 42 72 Q 50 69 58 72" stroke="#121c28" strokeWidth="2.5" fill="none" strokeLinecap="round" />,
    neutral: null,
    good: <path d="M 42 68 Q 50 76 58 68" stroke="#121c28" strokeWidth="2.5" fill="none" strokeLinecap="round" />,
    happy: <path d="M 40 66 Q 50 80 60 66" stroke="#121c28" strokeWidth="3" fill="none" strokeLinecap="round" />,
    talking: (
      <motion.ellipse
        cx="50"
        cy="71"
        rx="5"
        fill="#121c28"
        animate={{ ry: [2, 4.5, 2.5, 5, 2] }}
        transition={{ repeat: Infinity, duration: 0.9 }}
      />
    ),
  }

  return (
    <motion.svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      initial={false}
      animate={{ scale: mood === 'happy' ? [1, 1.04, 1] : 1 }}
      transition={{ repeat: mood === 'happy' ? Infinity : 0, duration: 2.4, ease: 'easeInOut' }}
    >
      {body && (
        <>
          <circle cx="50" cy="50" r="48" fill="#ffffff" />
          <circle cx="50" cy="50" r="48" fill="none" stroke="#f1f5f9" strokeWidth="1.5" />
          {/* soft top highlight for the inflatable look */}
          <ellipse cx="40" cy="30" rx="24" ry="14" fill="#f8fafc" opacity="0.8" />
        </>
      )}
      {/* eyes + connecting line */}
      <motion.ellipse cx="30" cy="50" rx="5" animate={{ ry: eyeRy }} transition={{ duration: 0.08 }} fill="#121c28" />
      <motion.ellipse cx="70" cy="50" rx="5" animate={{ ry: eyeRy }} transition={{ duration: 0.08 }} fill="#121c28" />
      <rect x="34" y="49" width="32" height="2" rx="1" fill="#121c28" />
      {mouth[mood]}
    </motion.svg>
  )
}
