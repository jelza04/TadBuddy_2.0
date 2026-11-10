interface IconProps {
  name: string
  filled?: boolean
  className?: string
}

export default function Icon({ name, filled = false, className = '' }: IconProps) {
  return (
    <span className={`material-symbols-outlined select-none ${filled ? 'mso-fill' : ''} ${className}`} aria-hidden>
      {name}
    </span>
  )
}
