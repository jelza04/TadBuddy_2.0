import { NavLink, useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import TadFace from './TadFace'
import Icon from './Icon'

const LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/history', label: 'Health Log' },
  { to: '/insights', label: 'Insights' },
  { to: '/chat', label: 'Companion' },
  { to: '/tasks', label: 'Tasks' },
]

export default function TopNav() {
  const navigate = useNavigate()
  const currentUser = useAppStore((s) => s.currentUser)
  const logout = useAppStore((s) => s.logout)

  return (
    <nav className="fixed top-0 left-0 right-0 z-50">
      <div className="bg-white/80 backdrop-blur-md rounded-full mt-4 mx-auto w-[95%] max-w-7xl shadow-[0_20px_50px_rgba(219,0,49,0.1)] flex justify-between items-center px-6 md:px-10 py-3">
        <button className="flex items-center gap-3" onClick={() => navigate('/dashboard')}>
          <div className="w-10 h-10 bg-white rounded-full border-2 border-slate-100 shadow-sm overflow-hidden">
            <TadFace size={36} body={false} mood="neutral" className="mt-1.5" />
          </div>
          <span className="text-xl md:text-2xl font-black font-display text-primary-bright tracking-tight">TadBuddy</span>
        </button>

        <div className="hidden lg:flex items-center gap-6 xl:gap-8">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `font-display text-base transition-all duration-300 hover:scale-105 ${
                  isActive
                    ? 'text-primary-bright border-b-4 border-primary-bright pb-1 font-bold'
                    : 'text-slate-500 font-medium hover:text-primary-bright'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            className="hidden sm:block text-slate-400 hover:text-primary-bright transition-colors"
            title="Settings"
            onClick={() => navigate('/settings')}
          >
            <Icon name="settings" />
          </button>
          {currentUser && (
            <button
              className="text-slate-400 hover:text-primary-bright transition-colors flex items-center gap-1 text-sm"
              title="Log out"
              onClick={() => {
                logout()
                navigate('/login')
              }}
            >
              <Icon name="logout" />
            </button>
          )}
          <a
            href="tel:988"
            className="bg-primary-bright text-white px-4 md:px-6 py-2 rounded-full font-bold hover:scale-105 active:scale-95 transition-transform text-sm md:text-base"
          >
            Emergency
          </a>
        </div>
      </div>
    </nav>
  )
}
