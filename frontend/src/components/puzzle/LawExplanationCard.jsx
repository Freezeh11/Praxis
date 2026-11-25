import Icon from '../ui/Icon'

/**
 * LawExplanationCard — the card that explains the law behind an inspected
 * derivation step. It hangs off the inspected line inside the shared
 * collision-aware popup layer; the caller decides when it is open.
 *
 * Reading order is the point: which law (header), what the law says in algebra
 * (formula chips), what that means in words (prose), and only then where it was
 * applied in this derivation (from → to). The old card printed the algebraic
 * line as if it were the explanation, so the plain-language sentence never
 * showed and nothing said what the law actually did to the expression.
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
    if (lower.includes('demorgan') || lower.includes('de morgan')) {
      return 'Negated group expanded: (AB)\' = A\' + B\' or (A+B)\' = A\'B\'.'
    }
    return `Applied ${lawName}.`
}

/** The law's algebraic identities, as mono chips. Absent for meta steps. */
function FormulaChips({ formulas }) {
  if (!Array.isArray(formulas) || formulas.length === 0) return null
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {formulas.map((formula) => (
        <span
          key={formula}
          className="rounded-md bg-teal/10 px-1.5 py-0.5 font-mono text-[11.5px] leading-tight text-teal dark:bg-cyan-400/10 dark:text-cyan-300"
        >
          {formula}
        </span>
      ))}
    </div>
  )
}

export default function LawExplanationCard({ lawName, explanation, formulas, from, to, ready, onClose }) {
  const meaning = explanation || getLawExplanation(lawName)
  const applied = Boolean(from && to)

  return (
    <div
      data-inspect-card="true"
      className={`bg-bg-card/95 backdrop-blur-sm border border-teal/40 ring-1 ring-teal/15 shadow-2xl rounded-2xl text-left select-none pointer-events-auto p-3.5 w-[288px] max-w-[calc(100vw-32px)] ${
        ready ? 'opacity-100' : 'opacity-0'
      }`}
      style={{ transition: 'opacity 0.15s ease' }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-teal/10 text-[13px] text-teal dark:bg-cyan-400/10 dark:text-cyan-300">
            <Icon name="scale" />
          </span>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-3">Law applied</div>
            <div className="truncate text-[13px] font-bold leading-tight text-text-1">{lawName}</div>
          </div>
        </div>
        <button
          type="button"
          data-testid="inspect-card-close"
          onClick={() => onClose()}
          className="-mr-1 mt-0.5 grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-md text-[13px] text-text-3 transition-colors hover:bg-bg hover:text-text-1"
          title="Close explanation"
        >
          <Icon name="close" />
        </button>
      </div>

      <FormulaChips formulas={formulas} />

      {meaning && (
        <p className="mt-2 text-[12.5px] leading-relaxed text-text-2">{meaning}</p>
      )}

      {applied && (
        <div className="mt-2.5 border-t border-border pt-2">
          <div className="break-words font-mono text-[11px] leading-snug text-text-2">
            <span>{from}</span>
            <span aria-hidden="true" className="px-1 text-text-3">→</span>
            <span>{to}</span>
          </div>
        </div>
      )}
    </div>
  )
}
