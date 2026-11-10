import type { HTMLAttributes, ReactNode } from 'react'

interface PuffyCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  hover?: boolean
}

export default function PuffyCard({ children, hover = true, className = '', ...rest }: PuffyCardProps) {
  return (
    <div
      className={`bg-white rounded-[2.5rem] puffy-shadow-soft border border-white/50 transition-transform duration-300 ${
        hover ? 'hover:-translate-y-1' : ''
      } ${className}`}
      {...rest}
    >
      {children}
    </div>
  )
}
