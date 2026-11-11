import Icon from '../ui/Icon'
/**
 * LawPanel — the law-first palette under the canvas. It is a horizontally
 * scrollable strip on phone landscape / narrow windows, a grid on tablet
 * portrait and the wrapped default otherwise; once the stage is solved the same
 * dock becomes the completion bar.
 *
 * Presentational: the law list, the layout flags and the callbacks come in.
 */
import { memo, useEffect, useMemo, useRef } from 'react'
import { independentChoices } from '../../engine/index.js'

function LawPanel({
  isComplete, isSandbox, isCustomSandbox, steps, optimalSteps,
  sel, lawsAsStrip, lawsAsGrid, touchTargets, onApplyLaw,
  level, stageNum, onOpenScoreSummary, onNextStage, onBackToStages,
  onRandomize, onNewExpression, referenceLaws = [], busy = false,
  selectedLaw, onChooseLaw, lawIds = null, allowExpand = false,
}) {
  // independentChoices walks the law list and filters it; without this memo the
  // palette re-derived on every workspace render, including pure UI toggles.
  const choices = useMemo(
    () => independentChoices(referenceLaws, { lawIds, allowExpand }),
    [referenceLaws, lawIds, allowExpand],
  )
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
        ? 'border-t-[1.5px] border-border bg-bg-card shrink-0 px-2 py-1.5 shadow-[0_-1px_0_0_rgba(15,23,42,0.04)]'
        : lawsAsGrid
          ? 'border-t-[1.5px] border-border p-3 bg-bg-card shrink-0 max-h-[46vh] overflow-y-auto shadow-[0_-1px_0_0_rgba(15,23,42,0.04)]'
          : 'border-t-[1.5px] border-border p-3 px-5 pb-4 bg-bg-card shrink-0 max-h-[35vh] overflow-y-auto shadow-[0_-1px_0_0_rgba(15,23,42,0.04)]'}
    >
      {isComplete ? (
        <div className={`flex items-center justify-between gap-4 flex-wrap ${lawsAsStrip ? 'gap-2 py-0' : 'py-1'}`}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-sm shrink-0">
              <Icon name="check" />
            </div>
            <div>
              <div className={`font-bold text-text-1 ${lawsAsStrip ? 'text-[14px]' : 'text-[13px]'}`}>
                {isSandbox ? 'Problem Simplified!' : 'Stage Completed!'} <Icon name="celebration" />
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
                  className={`px-5 py-2 bg-accent text-on-accent rounded-lg font-semibold transition-all shadow-sm hover:bg-accent-hover hover:shadow-md hover:-translate-y-px cursor-pointer ${lawsAsStrip ? 'text-[14px]' : 'text-sm'}`}
                  onClick={() => onNewExpression()}
                >
                  <Icon name="edit" /> New expression
                </button>
              ) : (
                <button
                  data-tutorial="randomize-next-btn"
                  className={`px-5 py-2 bg-accent text-on-accent rounded-lg font-semibold transition-all shadow-sm hover:bg-accent-hover hover:shadow-md hover:-translate-y-px cursor-pointer ${lawsAsStrip ? 'text-[14px]' : 'text-sm'}`}
                  onClick={() => onRandomize()}
                >
                  <Icon name="dice" /> Randomize
                </button>
              )
            ) : (
              <>
            <button
              data-tutorial="reopen-score-btn"
              className={`cursor-pointer rounded-lg border border-slate-200 bg-white font-semibold text-slate-700 shadow-chip transition-colors hover:bg-slate-100 hover:text-slate-900 dark:border-white/10 dark:bg-slate-800/80 dark:text-slate-200 dark:shadow-none dark:hover:bg-slate-700 dark:hover:text-white ${lawsAsStrip ? 'text-[14px]' : 'text-xs'}`}
              onClick={onOpenScoreSummary}
            >
              <Icon name="chart" /> Score Summary
            </button>
            {level && stageNum + 1 < level.puzzles.length ? (
              <button
                data-tutorial="next-stage-btn"
                className={`px-5 py-2 rounded-lg bg-indigo-600 bg-gradient-to-r from-indigo-600 to-cyan-600 font-semibold text-white shadow-lg shadow-indigo-600/25 ring-1 ring-inset ring-white/20 transition-[filter,box-shadow] hover:brightness-105 hover:shadow-xl hover:shadow-indigo-600/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 dark:bg-indigo-500 dark:from-indigo-500 dark:to-cyan-500 dark:shadow-lg dark:shadow-indigo-500/25 dark:focus-visible:ring-cyan-400/60 ${lawsAsStrip ? 'text-[14px]' : 'text-sm'}`}
                onClick={onNextStage}
              >
                Next Stage →
              </button>
            ) : (
              <button
                data-tutorial="next-stage-btn"
                className={`px-5 py-2 rounded-lg bg-indigo-600 bg-gradient-to-r from-indigo-600 to-cyan-600 font-semibold text-white shadow-lg shadow-indigo-600/25 ring-1 ring-inset ring-white/20 transition-[filter,box-shadow] hover:brightness-105 hover:shadow-xl hover:shadow-indigo-600/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 dark:bg-indigo-500 dark:from-indigo-500 dark:to-cyan-500 dark:shadow-lg dark:shadow-indigo-500/25 dark:focus-visible:ring-cyan-400/60 ${lawsAsStrip ? 'text-[14px]' : 'text-sm'}`}
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

            <button
              type="button" data-tutorial="apply-law" data-testid="apply-selected-law"
              disabled={busy || !selectedLaw || sel.length === 0}
              onClick={() => onApplyLaw(selectedLaw)}
              className="min-h-[44px] rounded-lg bg-indigo-600 bg-gradient-to-r from-indigo-600 to-cyan-600 px-4 py-2 font-semibold text-white shadow-lg shadow-indigo-600/25 ring-1 ring-inset ring-white/20 transition-[filter,box-shadow] hover:brightness-105 hover:shadow-xl hover:shadow-indigo-600/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none dark:bg-indigo-500 dark:from-indigo-500 dark:to-cyan-500 dark:focus-visible:ring-cyan-400/60"
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
                className={`shrink-0 min-h-[44px] border-[1.5px] rounded-md px-3 py-2 text-left transition-all disabled:opacity-50 ${lawsAsGrid ? 'w-full' : 'min-w-[160px] max-w-[260px]'} ${selectedLaw?.id === law.id ? 'border-indigo-500 bg-indigo-500/10 ring-2 ring-indigo-500/30 shadow-[0_10px_22px_-16px_rgba(79,70,229,0.60)] dark:border-cyan-400 dark:bg-cyan-400/10 dark:ring-cyan-400' : 'bg-white border-slate-200/80 shadow-chip hover:-translate-y-px hover:border-indigo-300 hover:bg-white hover:shadow-[0_10px_20px_-14px_rgba(79,70,229,0.45)] dark:bg-slate-800/90 dark:shadow-none dark:border-white/10 dark:hover:border-indigo-400/40 dark:hover:bg-slate-800'}`}
                onClick={() => onChooseLaw(law)}
              >
                <div className={`font-semibold text-text-1 ${touchTargets ? 'text-[14px]' : 'text-[13px]'}`}>{law.name}</div>
                <div className="font-mono text-xs text-indigo-700 dark:text-cyan-300">{law.formula}</div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default memo(LawPanel)
