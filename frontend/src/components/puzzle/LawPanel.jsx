/**
 * LawPanel — the applicable-laws dock under the canvas. It is a horizontally
 * scrollable strip on phone landscape / narrow windows, a grid on tablet
 * portrait and the wrapped default otherwise; once the stage is solved the same
 * dock becomes the completion bar.
 *
 * Presentational: the law list, the layout flags and the callbacks come in.
 */
import { useEffect, useRef } from 'react'

export default function LawPanel({
  isComplete, isSandbox, isCustomSandbox, steps, optimalSteps,
  applicableLaws, sel, lawsAsStrip, lawsAsGrid, touchTargets, onApplyLaw,
  onOpenLaws, level, stageNum, onOpenScoreSummary, onNextStage, onBackToStages,
  onRandomize, onNewExpression,
}) {
  /** Identity of the applicable-law set, used to re-anchor the law strip. */
  const applicableLawKey = applicableLaws.map(l => l.id).join('|')
  const lawsStripRef = useRef(null)

  // Applicable laws are inserted at the HEAD of the phone-landscape strip. If the
  // strip is already scrolled (e.g. the learner was browsing the reference
  // chips), the newly actionable law would land off-screen, so re-anchor it.
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
          : 'border-t-[1.5px] border-border p-3 px-5 pb-4 bg-white shrink-0'}
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
      ) : lawsAsStrip ? (
        /* Phone landscape / narrow window: one thumb-reachable, horizontally
           scrollable rail. It carries ONLY the laws that apply right now — the
           full reference lives behind the Laws button so the strip cannot turn
           into a wall of chips. */
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-[14px] font-bold tracking-[1px] uppercase text-text-3 whitespace-nowrap">Laws</span>
          <div
            data-testid="laws-list"
            data-layout="strip"
            ref={lawsStripRef}
            className="praxis-rail items-stretch flex-1 min-w-0 min-h-[44px] py-0.5"
          >
            {applicableLaws.length === 0 && (
              <span className="shrink-0 inline-flex min-h-[44px] items-center px-1 text-[14px] text-text-3 italic">
                {sel.length === 0 ? '← Select a term to begin' : 'No laws apply, try again'}
              </span>
            )}
            {applicableLaws.map((law, i) => (
              <button
                key={i}
                data-tutorial={`law-card-${i}`}
                data-law-id={law.id}
                className="snap-start shrink-0 min-h-[44px] min-w-[180px] max-w-[260px] bg-white border-[1.5px] border-border rounded-md px-3 py-1.5 text-left cursor-pointer transition-all hover:border-text-1 hover:bg-bg flex flex-col justify-center"
                onClick={() => onApplyLaw(law)}
              >
                <div className="text-[14px] font-semibold text-text-1 leading-tight">{law.name}</div>
                <div className="font-mono text-[14px] text-teal leading-tight">{law.formula}</div>
              </button>
            ))}
            <button
              type="button"
              data-testid="laws-rail-reference"
              className="snap-start shrink-0 min-h-[44px] inline-flex items-center gap-1.5 rounded-md border border-dashed border-border bg-bg px-3 text-[14px] font-semibold text-text-2 cursor-pointer transition-all hover:bg-border/60 hover:text-text-1"
              onClick={() => onOpenLaws()}
            >
              <span aria-hidden="true">📖</span> All laws
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className={`flex items-center gap-3 ${lawsAsGrid ? 'mb-2' : 'mb-2.5'}`}>
            <span className={`font-bold tracking-[1px] uppercase text-text-3 whitespace-nowrap ${touchTargets ? 'text-[14px]' : 'text-[11px]'}`}>APPLICABLE LAWS</span>
            {applicableLaws.length === 0 && (
              <span className={`text-text-3 italic ${touchTargets ? 'text-[14px]' : 'text-xs'}`}>
                {sel.length === 0 ? '← Select a term or variable to begin' : 'No laws apply, try a different selection'}
              </span>
            )}
          </div>
          {applicableLaws.length > 0 && (
            <div
              data-testid="laws-list"
              data-layout={lawsAsGrid ? 'grid' : 'wrap'}
              className={lawsAsGrid ? 'grid grid-cols-2 lg:grid-cols-3 gap-2' : 'flex flex-wrap gap-2'}
            >
              {applicableLaws.map((law, i) => (
                <button
                  key={i}
                  data-tutorial={`law-card-${i}`}
                  data-law-id={law.id}
                  className={`bg-white border-[1.5px] border-border rounded-md px-3.5 py-2.5 text-left cursor-pointer transition-all hover:border-text-1 hover:bg-bg hover:shadow-sm hover:-translate-y-[1px] ${lawsAsGrid ? 'min-h-[44px] w-full' : 'min-w-[160px] max-w-[240px]'}`}
                  onClick={() => onApplyLaw(law)}
                >
                  <div className={`font-semibold text-text-1 mb-0.5 ${touchTargets ? 'text-[14px]' : 'text-[13px]'}`}>{law.name}</div>
                  <div className={`font-mono text-teal mb-1 ${touchTargets ? 'text-[13px]' : 'text-[11px]'}`}>{law.formula}</div>
                  <div className="text-[12px] text-text-3 leading-tight">{law.desc}</div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
