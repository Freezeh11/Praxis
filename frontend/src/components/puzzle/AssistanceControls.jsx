/**
 * AssistanceControls — the Hint + Guide pair. `compact` places them in the
 * header (no side column); otherwise they fill the side panel's action row.
 * Hint and Guide are graded-level aids: the Guide costs `guideCost` points,
 * which the sandbox sets to 0.
 */
export default function AssistanceControls({
  compact, isComplete, isSandbox, guideCost, points, onHint, onGuide, chromeText, chromeHeight,
}) {
  return (
    <div data-tutorial="assistance-group" className={compact ? 'flex gap-1.5 shrink-0' : 'flex gap-2'}>
      <button
        data-tutorial="hint-button"
        className={`${compact ? 'shrink-0 px-3' : 'flex-1 px-2.5'} py-2 rounded-lg font-semibold border border-border bg-bg text-text-2 transition-all hover:bg-border/60 hover:text-text-1 flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-bg disabled:hover:text-text-2 ${chromeText} ${chromeHeight}`}
        onClick={onHint}
        disabled={isComplete}
        title={isComplete ? 'Expression is already simplified' : 'Get a hint for the next step'}
      >
        <span>💡</span> Hint
      </button>
      <button
        data-tutorial="guide-button"
        className={`${compact ? 'shrink-0 px-3' : 'flex-1 px-2'} py-2 rounded-lg font-semibold border border-amber/50 bg-amber-50/80 text-amber-900 transition-all hover:bg-amber-100 hover:border-amber flex items-center justify-center gap-1 shadow-xs disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-amber-50/80 disabled:hover:border-amber/50 ${chromeText} ${chromeHeight}`}
        onClick={onGuide}
        disabled={isComplete || (!isSandbox && (points ?? 0) < guideCost)}
        title={isSandbox
          ? 'Highlight terms for the next move (free in the sandbox)'
          : isComplete
            ? 'Expression is already simplified'
            : `Highlight terms for the next move (Costs ${guideCost} pts)`}
      >
        <span>🎯</span> Guide <span className="text-[10px] text-amber-700 font-normal">{isSandbox ? '(Free)' : `(${guideCost}p)`}</span>
      </button>
    </div>
  )
}
