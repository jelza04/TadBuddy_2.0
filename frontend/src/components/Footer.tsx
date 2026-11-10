export default function Footer() {
  return (
    <footer className="bg-slate-50 w-full pt-16 pb-24 md:pb-10 px-8 border-t border-slate-100 mt-16">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex flex-col gap-1 items-center md:items-start">
          <span className="text-lg font-bold font-display text-slate-900">TadBuddy</span>
          <p className="font-display text-sm text-slate-500">© 2026 TadBuddy. Your friendly AI health companion.</p>
        </div>
        <div className="flex gap-6 flex-wrap justify-center">
          {['Privacy Policy', 'Terms of Service', 'Help Center', 'Contact'].map((l) => (
            <a key={l} className="text-slate-400 hover:text-slate-600 hover:underline transition-colors text-sm font-display" href="#">
              {l}
            </a>
          ))}
        </div>
      </div>
    </footer>
  )
}
