import { NavLink } from 'react-router-dom'
import Icon from './Icon'

const ITEMS = [
  { to: '/dashboard', icon: 'home_health', label: 'Home' },
  { to: '/chat', icon: 'favorite', label: 'Buddy' },
  { to: '/history', icon: 'analytics', label: 'History' },
  { to: '/settings', icon: 'person', label: 'Profile' },
]

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-5 pt-3 bg-white shadow-[0_-10px_40px_rgba(0,0,0,0.04)] rounded-t-[40px] border-t border-slate-100 md:hidden">
      {ITEMS.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center transition-all ${
              isActive
                ? 'bg-primary-bright text-white rounded-full w-14 h-14 shadow-lg shadow-primary-bright/30 -translate-y-3'
                : 'text-slate-400 hover:text-primary-bright'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Icon name={it.icon} filled={isActive} className={isActive ? '' : ''} />
              <span className={`font-display font-medium ${isActive ? 'text-[10px] font-bold' : 'text-xs mt-1'}`}>{it.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
