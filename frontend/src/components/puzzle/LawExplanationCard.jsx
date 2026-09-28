/**
 * LawExplanationCard — the card that explains the law behind an inspected
 * derivation step. It hangs off the inspected line inside the shared
 * collision-aware popup layer; the caller decides when it is open.
 */

/** Plain-language explanation of a law, by the name it was recorded under. */
function getLawExplanation(lawName) {
    if (!lawName) return null
    const lower = String(lawName).toLowerCase()
    if (lower.includes('initial')) {
      return 'Starting problem expression.'
    }
    if (lower.includes('distributive')) {
      return 'Factored out a common variable (AB + AC = A(B+C)) or applied POS dual distribution ((A+B)(A+C) = A + BC).'
    }
    if (lower.includes('absorption')) {
      return 'Redundant term absorbed: A + AB = A in sums, and A(A + B) = A in products.'
    }
    if (lower.includes('complement')) {
      return 'Opposites evaluated: A + A\' = 1 in sums, and A · A\' = 0 in products.'
    }
    if (lower.includes('idempotent')) {
      return 'Duplicate terms combined: A + A = A in sums, and A · A = A in products.'
    }
    if (lower.includes('identity')) {
      return 'Neutral element dropped: A + 0 = A in sums, and A · 1 = A in products.'
    }
    if (lower.includes('annulment')) {
      return 'Dominant value takes over: A + 1 = 1 in sums, and A · 0 = 0 in products.'
    }
    if (lower.includes('double neg')) {
      return 'Double NOT cancels out: (A\')\' = A.'
    }
    if (lower.includes('demorgan')) {
      return 'Negated group expanded: (AB)\' = A\' + B\' or (A+B)\' = A\'B\'.'
    }
    return `Applied ${lawName}.`
}

export default function LawExplanationCard({ lawName, ready, onClose }) {
  return (
    <div
      data-inspect-card="true"
      className={`bg-white/95 backdrop-blur-xs border border-teal/30 shadow-xl rounded-xl text-left select-none pointer-events-auto p-3 w-[280px] max-w-[calc(100vw-32px)] ring-1 ring-teal/10 ${
        ready ? 'opacity-100' : 'opacity-0'
      }`}
      style={{ transition: 'opacity 0.15s ease' }}
    >
      <div className="flex items-center justify-between gap-1.5 border-b border-slate-100 pb-1.5 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs shrink-0 select-none">⚖️</span>
          <span className="text-[12px] font-bold text-teal uppercase tracking-wide truncate">
            {lawName}
          </span>
        </div>
        <button
          type="button"
          data-testid="inspect-card-close"
          onClick={() => onClose()}
          className="w-7 h-7 -mr-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg flex items-center justify-center font-bold text-xs transition-colors shrink-0 cursor-pointer"
          title="Close explanation"
        >
          ✕
        </button>
      </div>
      <div className="text-slate-700 text-[12.5px] leading-relaxed font-sans font-normal">
        {getLawExplanation(lawName)}
      </div>
    </div>
  )
}
