import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import type { TadMood } from './TadFace'

interface TadBot3DProps {
  mood?: TadMood
  /** overall width in px; height scales automatically */
  width?: number
  className?: string
}

/**
 * TadBot3D — a full-body, soft-3D inflatable robot rendered in SVG.
 * Radial gradients + inner shadows fake volumetric shading, so it looks
 * puffy and dimensional without a heavy WebGL scene. Breathes, blinks,
 * sways its arms, and its glowing heart core pulses.
 */
export default function TadBot3D({ mood = 'neutral', width = 280, className = '' }: TadBot3DProps) {
  const [blink, setBlink] = useState(false)

  useEffect(() => {
    let closeTimer: ReturnType<typeof setTimeout>
    const timer = setInterval(() => {
      setBlink(true)
      closeTimer = setTimeout(() => setBlink(false), 150)
    }, 3000 + Math.random() * 2000)
    return () => {
      clearInterval(timer)
      clearTimeout(closeTimer)
    }
  }, [])

  const eyeRy = blink ? 0.7 : 6

  const mouth: Record<TadMood, JSX.Element | null> = {
    sad: <path d="M 118 96 Q 130 88 142 96" stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" />,
    low: <path d="M 118 94 Q 130 91 142 94" stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" />,
    neutral: null,
    good: <path d="M 118 90 Q 130 100 142 90" stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" />,
    happy: <path d="M 115 88 Q 130 104 145 88" stroke="#1f2937" strokeWidth="3.5" fill="none" strokeLinecap="round" />,
    talking: (
      <motion.ellipse
        cx="130"
        cy="93"
        rx="6"
        fill="#1f2937"
        animate={{ ry: [2.5, 5.5, 3, 6, 2.5] }}
        transition={{ repeat: Infinity, duration: 0.9 }}
      />
    ),
  }

  return (
    <motion.svg
      viewBox="0 0 260 340"
      width={width}
      height={(width / 260) * 340}
      className={className}
      animate={{ scale: [1, 1.02, 1] }}
      transition={{ repeat: Infinity, duration: 3.4, ease: 'easeInOut' }}
      style={{ transformOrigin: '50% 90%' }}
    >
      <defs>
        {/* soft volumetric shading */}
        <radialGradient id="bodyGrad" cx="38%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="55%" stopColor="#f8fafc" />
          <stop offset="82%" stopColor="#e8edf5" />
          <stop offset="100%" stopColor="#d3dbe8" />
        </radialGradient>
        <radialGradient id="headGrad" cx="40%" cy="28%" r="85%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="60%" stopColor="#f9fafc" />
          <stop offset="85%" stopColor="#eaeff6" />
          <stop offset="100%" stopColor="#d8e0eb" />
        </radialGradient>
        <radialGradient id="armGrad" cx="35%" cy="25%" r="90%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="70%" stopColor="#f0f4f9" />
          <stop offset="100%" stopColor="#d9e1ec" />
        </radialGradient>
        <radialGradient id="heartGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ff8ba0" />
          <stop offset="55%" stopColor="#e30613" />
          <stop offset="100%" stopColor="#b3001b" />
        </radialGradient>
        <filter id="softDrop" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="14" stdDeviation="14" floodColor="#0f172a" floodOpacity="0.14" />
        </filter>
        <filter id="glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* ground shadow */}
      <motion.ellipse
        cx="130"
        cy="322"
        rx="78"
        ry="12"
        fill="#0f172a"
        animate={{ opacity: [0.1, 0.14, 0.1] }}
        transition={{ repeat: Infinity, duration: 3.4, ease: 'easeInOut' }}
      />

      {/* left arm */}
      <motion.g animate={{ rotate: [-2, 2, -2] }} transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }} style={{ transformOrigin: '62px 180px' }}>
        <ellipse cx="48" cy="215" rx="26" ry="58" fill="url(#armGrad)" filter="url(#softDrop)" transform="rotate(12 48 215)" />
      </motion.g>
      {/* right arm */}
      <motion.g animate={{ rotate: [2, -2, 2] }} transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }} style={{ transformOrigin: '198px 180px' }}>
        <ellipse cx="212" cy="215" rx="26" ry="58" fill="url(#armGrad)" filter="url(#softDrop)" transform="rotate(-12 212 215)" />
      </motion.g>

      {/* legs */}
      <ellipse cx="98" cy="292" rx="30" ry="36" fill="url(#armGrad)" />
      <ellipse cx="162" cy="292" rx="30" ry="36" fill="url(#armGrad)" />

      {/* body */}
      <motion.g animate={{ scaleY: [1, 1.015, 1] }} transition={{ repeat: Infinity, duration: 3.4, ease: 'easeInOut' }} style={{ transformOrigin: '130px 230px' }}>
        <ellipse cx="130" cy="212" rx="86" ry="98" fill="url(#bodyGrad)" filter="url(#softDrop)" />
        {/* belly highlight */}
        <ellipse cx="108" cy="176" rx="42" ry="30" fill="#ffffff" opacity="0.75" />
        {/* seam hint for the inflatable look */}
        <path d="M 60 250 Q 130 274 200 250" stroke="#e2e8f0" strokeWidth="2" fill="none" opacity="0.8" />

        {/* glowing heart core */}
        <motion.g animate={{ scale: [1, 1.12, 1] }} transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }} style={{ transformOrigin: '130px 206px' }}>
          <circle cx="130" cy="206" r="24" fill="#ffffff" stroke="#f1f5f9" strokeWidth="2" />
          <path
            d="M 130 216 C 122 208 116 203 116 197.5 C 116 193 119.5 190 123.5 190 C 126.5 190 129 192 130 194 C 131 192 133.5 190 136.5 190 C 140.5 190 144 193 144 197.5 C 144 203 138 208 130 216 Z"
            fill="url(#heartGlow)"
            filter="url(#glow)"
          />
        </motion.g>
      </motion.g>

      {/* head */}
      <motion.g animate={{ rotate: [0, 1.5, 0, -1.5, 0], y: [0, -2, 0] }} transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut' }} style={{ transformOrigin: '130px 118px' }}>
        <ellipse cx="130" cy="78" rx="62" ry="48" fill="url(#headGrad)" filter="url(#softDrop)" />
        {/* head highlight */}
        <ellipse cx="112" cy="58" rx="28" ry="15" fill="#ffffff" opacity="0.85" />
        {/* face: dot – line – dot */}
        <motion.ellipse cx="102" cy="76" rx="6" animate={{ ry: eyeRy }} transition={{ duration: 0.08 }} fill="#1f2937" />
        <motion.ellipse cx="158" cy="76" rx="6" animate={{ ry: eyeRy }} transition={{ duration: 0.08 }} fill="#1f2937" />
        <rect x="106" y="74.5" width="48" height="3" rx="1.5" fill="#1f2937" />
        {mouth[mood]}
      </motion.g>
    </motion.svg>
  )
}
