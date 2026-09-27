import LawCard from './LawCard'

/**
 * Sliding law-reference sheet (scrim + panel) placed by the caller's popup placement
 * band. Presentational: visibility, data and the measured band all arrive as props.
 */
export default function LawsDrawer({ show, onClose, laws, placement }) {
  const band = placement ? placement.band : null

  return (
    <>
      <div
        className={`fixed inset-0 bg-accent/30 z-[100] transition-opacity duration-300 ${show ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      <div
        data-testid="laws-drawer"
        className={`praxis-sheet-panel fixed right-0 max-w-[92vw] bg-white shadow-2xl z-[110] flex flex-col transition-transform duration-300 ${show ? 'translate-x-0' : 'translate-x-full'}`}
        style={{
          top: `${Math.round(band ? band.top : 0)}px`,
          maxHeight: `${Math.round(band ? band.maxHeight : 0)}px`,
          width: `${Math.round(band ? band.maxWidth : 340)}px`,
          opacity: placement ? 1 : 0,
        }}
      >
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-base font-bold text-text-1">Law Reference</h2>
          <button data-testid="laws-close" className="praxis-touch-target shrink-0 rounded-full border-none bg-bg text-lg text-text-2 flex items-center justify-center hover:bg-border transition-all" onClick={onClose}>✕</button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 flex flex-col gap-3 praxis-safe-b">
          {laws && laws.map(law => (
            <LawCard key={law.id} law={law} />
          ))}
        </div>
      </div>
    </>
  )
}
