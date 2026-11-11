import type { ReactNode } from 'react'
import TopNav from './TopNav'
import BottomNav from './BottomNav'
import Footer from './Footer'
import FloatingBuddy from './FloatingBuddy'

export default function PageShell({ children, footer = true }: { children: ReactNode; footer?: boolean }) {
  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <TopNav />
      <main className="pt-24 lg:pt-28 px-4 md:px-6 max-w-7xl mx-auto w-full flex-1 min-w-0">{children}</main>
      {footer && <Footer />}
      <BottomNav />
      <FloatingBuddy />
    </div>
  )
}
