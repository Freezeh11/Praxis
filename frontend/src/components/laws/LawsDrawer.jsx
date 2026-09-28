import { useEffect, useRef } from 'react'
import LawCard from './LawCard'

/**
 * Sliding law-reference drawer (scrim + panel) for desktop, tablet, and mobile.
 * Spans the full height of the right edge with a clean, comfortable reading width,
 * smooth animations, accessible close target, and escape-key dismissal.
 */
export default function LawsDrawer({ show, onClose, laws, placement }) {
  const scrollRef = useRef(null)

  // Reset scroll to top whenever the drawer opens so the first law is never clipped
  useEffect(() => {
    if (show && scrollRef.current) {
      scrollRef.current.scrollTop = 0
    }
  }, [show])

  // Dismiss on Escape key for desktop keyboard accessibility
  useEffect(() => {
    if (!show) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [show, onClose])

  return (
    <>
      {/* Backdrop scrim */}
      <div
        className={`fixed inset-0 bg-accent/35 backdrop-blur-[2px] z-[100] transition-opacity duration-300 ${
          show ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        data-testid="laws-drawer"
        className={`praxis-drawer-panel fixed top-0 bottom-0 right-0 h-full max-h-screen w-[420px] max-w-[92vw] bg-white border-l border-slate-200/90 shadow-2xl z-[110] flex flex-col transition-transform duration-300 ease-out ${
          show ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Sticky Header */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/80 backdrop-blur-sm flex items-center justify-between shrink-0">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="text-lg" aria-hidden="true">📖</span>
              <h2 className="text-base font-extrabold text-slate-800 tracking-tight">Law Reference</h2>
            </div>
            <p className="text-[11.5px] text-slate-500 font-medium">Boolean identities & equivalence rules</p>
          </div>
          <button
            type="button"
            data-testid="laws-close"
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center font-bold text-sm transition-all cursor-pointer active:scale-95"
            onClick={onClose}
            aria-label="Close Law Reference"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Law Cards Body */}
        <div
          ref={scrollRef}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 flex flex-col gap-3.5 praxis-safe-b praxis-laws-scroll"
        >
          {laws && laws.map(law => (
            <LawCard key={law.id} law={law} />
          ))}
        </div>
      </div>
    </>
  )
}
