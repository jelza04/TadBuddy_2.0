import Icon from './Icon'

export default function Disclaimer({ className = '' }: { className?: string }) {
  return (
    <p className={`flex items-center justify-center gap-1.5 text-xs text-slate-400 ${className}`}>
      <Icon name="info" className="!text-sm" />
      TadBuddy is a friendly companion, not a medical professional. For medical concerns, please consult a clinician.
    </p>
  )
}
