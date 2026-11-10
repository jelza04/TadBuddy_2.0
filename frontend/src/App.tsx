import { HashRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { useAppStore } from './store/useAppStore'
import Splash from './screens/Splash'
import Login from './screens/Login'
import MoodCheck from './screens/MoodCheck'
import Chat from './screens/Chat'
import MoodHistory from './screens/MoodHistory'
import Insights from './screens/Insights'
import SymptomChecker from './screens/SymptomChecker'
import Tasks from './screens/Tasks'
import Settings from './screens/Settings'
import Dashboard from './screens/Dashboard'

function RequireAuth() {
  const currentUser = useAppStore((s) => s.currentUser)
  return currentUser ? <Outlet /> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Splash />} />
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth />}>
          <Route path="/mood" element={<MoodCheck />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/history" element={<MoodHistory />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/symptoms" element={<SymptomChecker />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
