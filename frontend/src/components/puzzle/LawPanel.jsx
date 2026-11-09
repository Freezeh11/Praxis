/**
 * LawPanel — the law-first palette under the canvas. It is a horizontally
 * scrollable strip on phone landscape / narrow windows, a grid on tablet
 * portrait and the wrapped default otherwise; once the stage is solved the same
 * dock becomes the completion bar.
 *
 * Presentational: the law list, the layout flags and the callbacks come in.
 */
import { useEffect, useRef } from 'react'
import { independentChoices } from '../../engine/index.js'

export default function LawPanel({
  isComplete, isSandbox, isCustomSandbox, steps, optimalSteps,
  sel, lawsAsStrip, lawsAsGrid, touchTargets, onApplyLaw,
  onOpenLaws, level, stageNum, onOpenScoreSummary, onNextStage, onBackToStages,
  onRandomize, onNewExpression, referenceLaws = [], busy = false,
  selectedLaw, onChooseLaw, lawIds = null, allowExpand = false,
}) {
  const choices = independentChoices(referenceLaws, { lawIds, allowExpand })
  /** Re-anchor the strip only when the available palette changes. */
  const applicableLawKey = choices.map(l => l.id).join('|')
  const lawsStripRef = useRef(null)

  // Newly unlocked choices start at the visible edge of the strip.
  useEffect(() => {
    const strip = lawsStripRef.current
    if (strip) strip.scrollLeft = 0
  }, [applicableLawKey])

  return (
    // ── APPLICABLE LAWS / STAGE COMPLETE BAR ──
    <div
      data-tutorial="laws-dock"
      className={lawsAsStrip
        ? 'border-t-[1.5px] border-border bg-white shrink-0 px-2 py-1.5'
        : lawsAsGrid
          ? 'border-t-[1.5px] border-border p-3 bg-white shrink-0 max-h-[46vh] overflow-y-auto'
          : 'border-t-[1.5px] border-border p-3 px-5 pb-4 bg-white shrink-0 max-h-[35vh] overflow-y-auto'}
    >
      {isComplete ? (
        <div className={`flex items-center justify-between gap-4 flex-wrap ${lawsAsStrip ? 'gap-2 py-0' : 'py-1'}`}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-sm shrink-0">
              ✓
            </div>
            <div>
              <div className={`font-bold text-text-1 ${lawsAsStrip ? 'text-[14px]' : 'text-[13px]'}`}>
                {isSandbox ? 'Problem Simplified! 🎉' : 'Stage Completed! 🎉'}
              </div>
              <div className={`text-text-3 ${lawsAsStrip ? 'text-[14px] max-w-[46vw] truncate' : 'text-[11px]'}`}>
                {isSandbox
                  ? (isCustomSandbox
                    ? `Solved in ${steps.length} step${steps.length === 1 ? '' : 's'}${optimalSteps > 0 ? ` (optimal: ${optimalSteps})` : ''}. Type a new expression whenever you're ready.`
                    : `Solved in ${steps.length} step${steps.length === 1 ? '' : 's'}${optimalSteps > 0 ? ` (optimal: ${optimalSteps})` : ''}. Randomize for a new problem whenever you're ready.`)
                  : 'Click past steps above to review derivations, or move on to the next puzzle.'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {isSandbox ? (
              isCustomSandbox ? (
                <button
                  data-tutorial="new-expression-next-btn"
                  className={`px-5 py-2 bg-accent text-white rounded-lg font-semibold transition-all shadow-sm hover:bg-text-1 hover:shadow-md hover:-translate-y-px cursor-pointer ${lawsAsStrip ? 'text-[14px]' : 'text-sm'}`}
                  onClick={() => onNewExpression()}
                >
                  ✎ New expression
                </button>
              ) : (
                <button
                  data-tutorial="randomize-next-btn"
                  className={`px-5 py-2 bg-accent text-white rounded-lg font-semibold transition-all shadow-sm hover:bg-text-1 hover:shadow-md hover:-translate-y-px cursor-pointer ${lawsAsStrip ? 'text-[14px]' : 'text-sm'}`}
                  onClick={() => onRandomize()}
                >
                  🎲 Randomize
                </button>
              )
            ) : (
              <>
            <button
              data-tutorial="reopen-score-btn"
              className={`px-3.5 py-2 border border-slate-200 text-text-2 font-semibold rounded-lg bg-slate-50 hover:bg-slate-100 hover:text-text-1 transition-all cursor-pointer ${lawsAsStrip ? 'text-[14px]' : 'text-xs'}`}
              onClick={onOpenScoreSummary}
            >
              📊 Score Summary
            </button>
            {level && stageNum + 1 < level.puzzles.length ? (
              <button
                data-tutorial="next-stage-btn"
                className={`px-5 py-2 bg-accent text-white rounded-lg font-semibold transition-all shadow-sm hover:bg-text-1 hover:shadow-md hover:-translate-y-px ${lawsAsStrip ? 'text-[14px]' : 'text-sm'}`}
                onClick={onNextStage}
              >
                Next Stage →
              </button>
            ) : (
              <button
                data-tutorial="next-stage-btn"
                className={`px-5 py-2 bg-accent text-white rounded-lg font-semibold transition-all shadow-sm hover:bg-text-1 hover:shadow-md hover:-translate-y-px ${lawsAsStrip ? 'text-[14px]' : 'text-sm'}`}
                onClick={() => onBackToStages()}
              >
                Back to Stages
              </button>
            )}
              </>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="font-bold text-xs tracking-wide uppercase text-text-3">Law palette</span>
            <span className="text-xs text-text-2 flex-1" aria-live="polite">
              {selectedLaw ? `${selectedLaw.name} selected / ${sel.length} item${sel.length === 1 ? '' : 's'} selected` : '1. Choose a law / 2. Select term(s) / 3. Apply'}
            </span>
            <button type="button" onClick={onOpenLaws} className="text-xs text-teal underline min-h-[44px] px-2">Law reference</button>
            <button
              type="button" data-tutorial="apply-law" data-testid="apply-selected-law"
              disabled={busy || !selectedLaw || sel.length === 0}
              onClick={() => onApplyLaw(selectedLaw)}
              className="min-h-[44px] px-4 py-2 bg-accent text-white font-semibold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
            >Apply{selectedLaw ? ` ${selectedLaw.name}` : ''}</button>
          </div>
          {lawIds && <p className="text-xs text-text-3 mb-2">Level 1: more laws join your palette as you advance through the stages.</p>}
          <div
            data-testid="laws-list" data-layout={lawsAsStrip ? 'strip' : lawsAsGrid ? 'grid' : 'wrap'}
            ref={lawsStripRef}
            className={lawsAsStrip ? 'praxis-rail items-stretch min-h-[44px] py-0.5' : lawsAsGrid ? 'grid grid-cols-2 lg:grid-cols-3 gap-2' : 'flex flex-wrap gap-2'}
          >
            {choices.map((law, i) => (
              <button
                type="button" key={law.id} data-tutorial={`law-card-${i}`} data-law-id={law.id}
                aria-pressed={selectedLaw?.id === law.id} disabled={busy}
                className={`shrink-0 min-h-[44px] border-[1.5px] rounded-md px-3 py-2 text-left transition-all disabled:opacity-50 ${lawsAsGrid ? 'w-full' : 'min-w-[160px] max-w-[260px]'} ${selectedLaw?.id === law.id ? 'border-accent bg-accent/10 ring-1 ring-accent' : 'bg-white border-border hover:border-text-1 hover:bg-bg'}`}
                onClick={() => onChooseLaw(law)}
              >
                <div className={`font-semibold text-text-1 ${touchTargets ? 'text-[14px]' : 'text-[13px]'}`}>{law.name}</div>
                <div className="font-mono text-xs text-teal">{law.formula}</div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
