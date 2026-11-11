import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import type { TadMood } from './TadFace'

interface TadBot3DProps {
  /** facial/body expression */
  mood?: TadMood
  /** mouth animates as if speaking, on top of the current expression */
  talking?: boolean
  /** overall width in px; height scales automatically */
  width?: number
  className?: string
}

/** Per-expression pose: head tilt, arm angles, heart pulse, body bounce, eyes, brows. */
interface Pose {
  headTilt: number
  headY: number
  leftArm: number // + = outward
  rightArm: number // - = outward
  wave?: boolean // right arm waves
  heartScale: number
  heartSpeed: number // seconds per pulse
  heartOpacity: number
  bounce: number // px
  eyes: 'dot' | 'big' | 'half' | 'arc' | 'soft'
  brows?: 'worried' | 'raised'
}

const POSES: Record<TadMood, Pose> = {
  neutral: { headTilt: 0, headY: 0, leftArm: 0, rightArm: 0, heartScale: 1.12, heartSpeed: 1.6, heartOpacity: 1, bounce: 0, eyes: 'dot' },
  good: { headTilt: 0, headY: 0, leftArm: 0, rightArm: 0, heartScale: 1.12, heartSpeed: 1.6, heartOpacity: 1, bounce: 0, eyes: 'dot' },
  happy: { headTilt: 0, headY: 0, leftArm: 8, rightArm: -8, heartScale: 1.15, heartSpeed: 1.2, heartOpacity: 1, bounce: 3, eyes: 'arc' },
  low: { headTilt: 0, headY: 2, leftArm: 0, rightArm: 0, heartScale: 1.08, heartSpeed: 2, heartOpacity: 0.9, bounce: 0, eyes: 'dot' },
  sad: { headTilt: -4, headY: 3, leftArm: -4, rightArm: 4, heartScale: 1.06, heartSpeed: 2.4, heartOpacity: 0.85, bounce: 0, eyes: 'dot', brows: 'worried' },
  talking: { headTilt: 0, headY: 0, leftArm: 0, rightArm: 0, heartScale: 1.12, heartSpeed: 1.6, heartOpacity: 1, bounce: 0, eyes: 'dot' },
  // reactions to the user's message
  listening: { headTilt: 8, headY: 0, leftArm: 0, rightArm: 0, heartScale: 1.1, heartSpeed: 1.6, heartOpacity: 1, bounce: 0, eyes: 'big' },
  concerned: { headTilt: -6, headY: 2, leftArm: 32, rightArm: -32, heartScale: 1.1, heartSpeed: 2.2, heartOpacity: 0.95, bounce: 0, eyes: 'dot', brows: 'worried' },
  calm: { headTilt: 0, headY: 0, leftArm: 6, rightArm: -6, heartScale: 1.2, heartSpeed: 4, heartOpacity: 1, bounce: 0, eyes: 'soft' },
  excited: { headTilt: 0, headY: -2, leftArm: 25, rightArm: -55, wave: true, heartScale: 1.2, heartSpeed: 0.8, heartOpacity: 1, bounce: 8, eyes: 'arc' },
  sleepy: { headTilt: 5, headY: 4, leftArm: -3, rightArm: 3, heartScale: 1.05, heartSpeed: 3.5, heartOpacity: 0.7, bounce: 0, eyes: 'half' },
  surprised: { headTilt: 0, headY: -4, leftArm: 14, rightArm: -14, heartScale: 1.15, heartSpeed: 1, heartOpacity: 1, bounce: 0, eyes: 'big', brows: 'raised' },
}

const ink = '#1f2937'
const stroke = { stroke: ink, strokeWidth: 3, fill: 'none', strokeLinecap: 'round' as const }

/**
 * TadBot3D — a full-body, soft-3D inflatable robot rendered in SVG.
 * Radial gradients + inner shadows fake volumetric shading. Breathes, blinks,
 * sways, and changes expression: head tilt, arm pose, eyes, brows, mouth,
 * and the heart core's pulse speed all follow `mood`.
 */
export default function TadBot3D({ mood = 'neutral', talking = false, width = 280, className = '' }: TadBot3DProps) {
  const [blink, setBlink] = useState(false)
  const pose = POSES[mood] ?? POSES.neutral

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

  const spring = { type: 'spring' as const, stiffness: 120, damping: 14 }

  // ---- eyes
  const eye = (cx: number) => {
    if (pose.eyes === 'arc') return <path key={cx} d={`M ${cx - 7} 79 Q ${cx} 69 ${cx + 7} 79`} {...stroke} />
    if (pose.eyes === 'soft') return <path key={cx} d={`M ${cx - 6} 75 Q ${cx} 80 ${cx + 6} 75`} {...stroke} />
    const rx = pose.eyes === 'big' ? 7 : 6
    const open = pose.eyes === 'big' ? 7.5 : pose.eyes === 'half' ? 2.2 : 6
    return (
      <motion.ellipse key={cx} cx={cx} cy={76} rx={rx} animate={{ ry: blink ? 0.7 : open }} transition={{ duration: 0.08 }} fill={ink} />
    )
  }

  // ---- brows
  const brows =
    pose.brows === 'worried' ? (
      <>
        <path d="M 93 62 L 108 58" {...stroke} strokeWidth={2.5} />
        <path d="M 167 62 L 152 58" {...stroke} strokeWidth={2.5} />
      </>
    ) : pose.brows === 'raised' ? (
      <>
        <path d="M 93 60 Q 102 53 111 59" {...stroke} strokeWidth={2.5} />
        <path d="M 149 59 Q 158 53 167 60" {...stroke} strokeWidth={2.5} />
      </>
    ) : null

  // ---- mouth
  const mouths: Partial<Record<TadMood, JSX.Element>> = {
    sad: <path d="M 118 96 Q 130 88 142 96" {...stroke} />,
    low: <path d="M 118 94 Q 130 91 142 94" {...stroke} />,
    good: <path d="M 118 90 Q 130 100 142 90" {...stroke} />,
    happy: <path d="M 115 88 Q 130 104 145 88" {...stroke} strokeWidth={3.5} />,
    concerned: <path d="M 120 95 Q 130 91 140 95" {...stroke} />,
    calm: <path d="M 120 91 Q 130 97 140 91" {...stroke} />,
    excited: <path d="M 113 87 Q 130 108 147 87 Z" fill={ink} />,
    sleepy: <ellipse cx="130" cy="94" rx="3.5" ry="2.5" fill={ink} />,
    surprised: <ellipse cx="130" cy="95" rx="5" ry="6.5" fill={ink} />,
    listening: <path d="M 122 92 Q 130 96 138 92" {...stroke} strokeWidth={2.5} />,
  }
  const mouth =
    talking || mood === 'talking' ? (
      <motion.ellipse
        cx="130"
        cy="93"
        rx="6"
        fill={ink}
        animate={{ ry: [2.5, 5.5, 3, 6, 2.5] }}
        transition={{ repeat: Infinity, duration: 0.9 }}
      />
    ) : (
      mouths[mood] ?? null
    )

  return (
    <motion.svg
      viewBox="0 0 260 340"
      width={width}
      height={(width / 260) * 340}
      className={className}
      animate={{ scale: [1, 1.02, 1] }}
      transition={{ repeat: Infinity, duration: pose.heartSpeed > 3 ? 4.5 : 3.4, ease: 'easeInOut' }}
      style={{ transformOrigin: '50% 90%' }}
      aria-label={`TadBuddy looking ${mood}`}
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

      {/* whole robot bounces when excited */}
      <motion.g
        animate={{ y: pose.bounce ? [0, -pose.bounce, 0] : 0 }}
        transition={pose.bounce ? { repeat: Infinity, duration: 0.7, ease: 'easeInOut' } : spring}
      >
        {/* left arm: outer group = pose, inner = idle sway */}
        <motion.g animate={{ rotate: pose.leftArm }} transition={spring} style={{ transformOrigin: '62px 180px' }}>
          <motion.g animate={{ rotate: [-2, 2, -2] }} transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }} style={{ transformOrigin: '62px 180px' }}>
            <ellipse cx="48" cy="215" rx="26" ry="58" fill="url(#armGrad)" filter="url(#softDrop)" transform="rotate(12 48 215)" />
          </motion.g>
        </motion.g>
        {/* right arm */}
        <motion.g animate={{ rotate: pose.rightArm }} transition={spring} style={{ transformOrigin: '198px 180px' }}>
          <motion.g
            animate={{ rotate: pose.wave ? [0, -18, 0, -18, 0] : [2, -2, 2] }}
            transition={{ repeat: Infinity, duration: pose.wave ? 1.2 : 4, ease: 'easeInOut' }}
            style={{ transformOrigin: '198px 180px' }}
          >
            <ellipse cx="212" cy="215" rx="26" ry="58" fill="url(#armGrad)" filter="url(#softDrop)" transform="rotate(-12 212 215)" />
          </motion.g>
        </motion.g>

        {/* legs */}
        <ellipse cx="98" cy="292" rx="30" ry="36" fill="url(#armGrad)" />
        <ellipse cx="162" cy="292" rx="30" ry="36" fill="url(#armGrad)" />

        {/* body */}
        <motion.g animate={{ scaleY: [1, 1.015, 1] }} transition={{ repeat: Infinity, duration: 3.4, ease: 'easeInOut' }} style={{ transformOrigin: '130px 230px' }}>
          <ellipse cx="130" cy="212" rx="86" ry="98" fill="url(#bodyGrad)" filter="url(#softDrop)" />
          <ellipse cx="108" cy="176" rx="42" ry="30" fill="#ffffff" opacity="0.75" />
          <path d="M 60 250 Q 130 274 200 250" stroke="#e2e8f0" strokeWidth="2" fill="none" opacity="0.8" />

          {/* glowing heart core: pulse speed follows the expression (slow = calm "breathe with me") */}
          <motion.g
            key={`${pose.heartSpeed}-${pose.heartScale}`}
            animate={{ scale: [1, pose.heartScale, 1], opacity: pose.heartOpacity }}
            transition={{ repeat: Infinity, duration: pose.heartSpeed, ease: 'easeInOut' }}
            style={{ transformOrigin: '130px 206px' }}
          >
            <circle cx="130" cy="206" r="24" fill="#ffffff" stroke="#f1f5f9" strokeWidth="2" />
            <path
              d="M 130 216 C 122 208 116 203 116 197.5 C 116 193 119.5 190 123.5 190 C 126.5 190 129 192 130 194 C 131 192 133.5 190 136.5 190 C 140.5 190 144 193 144 197.5 C 144 203 138 208 130 216 Z"
              fill="url(#heartGlow)"
              filter="url(#glow)"
            />
          </motion.g>
        </motion.g>

        {/* head: outer group = expression tilt, inner = idle bob */}
        <motion.g animate={{ rotate: pose.headTilt, y: pose.headY }} transition={spring} style={{ transformOrigin: '130px 118px' }}>
          <motion.g animate={{ rotate: [0, 1.5, 0, -1.5, 0], y: [0, -2, 0] }} transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut' }} style={{ transformOrigin: '130px 118px' }}>
            <ellipse cx="130" cy="78" rx="62" ry="48" fill="url(#headGrad)" filter="url(#softDrop)" />
            <ellipse cx="112" cy="58" rx="28" ry="15" fill="#ffffff" opacity="0.85" />
            {brows}
            {/* face: dot – line – dot */}
            {eye(102)}
            {eye(158)}
            <rect x="106" y="74.5" width="48" height="3" rx="1.5" fill={ink} />
            {mouth}
          </motion.g>
        </motion.g>
      </motion.g>
    </motion.svg>
  )
}
