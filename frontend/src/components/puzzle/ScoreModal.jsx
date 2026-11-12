import Icon from '../ui/Icon'
/**
 * ScoreModal: the completion overlay. Graded stages get the three-metric score
 * breakdown; the sandbox gets the compact attempt summary with law pills,
 * because nothing is awarded or persisted there.
 */
import { useMemo } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import useDialogA11y from '../../hooks/useDialogA11y'

export default function ScoreModal({
  showSuccess, onClose, isTutorialActive, shortViewport, isSandbox, isCustomSandbox,
  steps, optimalSteps, hintsUsed, guidesUsed, scoreResult, earnedXp, puzzle, level,
  stageNum, onNewExpression, onRandomize, onNextStage, onBackToStages, onReset,
}) {
  const uniqueLaws = useMemo(() => {
    return [...new Set(steps.map(s => s?.law).filter(Boolean))]
  }, [steps])

  // Completion is a dialog: focus moves into the panel, Tab stays inside it,
  // Escape dismisses, and focus returns to whatever opened it on close.
  const panelRef = useDialogA11y(showSuccess, onClose)

  const problemExprText = puzzle?.expr || (isCustomSandbox ? 'Your expression' : 'Random practice')

  const assistanceText = useMemo(() => {
    const h = hintsUsed || 0
    const g = guidesUsed || 0
    if (h === 0 && g === 0) return 'None'
    if (h > 0 && g === 0) return `${h} hint${h !== 1 ? 's' : ''}`
    if (h === 0 && g > 0) return `${g} guide${g !== 1 ? 's' : ''}`
    return `${h} hint${h !== 1 ? 's' : ''}, ${g} guide${g !== 1 ? 's' : ''}`
  }, [hintsUsed, guidesUsed])

  return (
    <AnimatePresence>
      {showSuccess && (
        <m.div
          key="success-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className={`fixed inset-0 z-50 flex items-center justify-center p-3 cursor-pointer will-change-[opacity] ${
            isTutorialActive ? 'bg-transparent' : 'bg-black/45 dark:bg-black/70'
          }`}
          onClick={() => onClose()}
        >
          <m.div
            ref={panelRef}
            data-tutorial="score-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="score-modal-title"
            aria-describedby="score-modal-desc"
            tabIndex={-1}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className={`bg-bg-card rounded-3xl flex flex-col items-center shadow-2xl max-w-[430px] w-full border border-slate-200/80 cursor-default praxis-modal-panel transform-gpu will-change-transform ${
              shortViewport ? 'p-4' : 'p-6 sm:p-7'
            }`}
            onClick={e => e.stopPropagation()}
          >
            {/* Scrollable body on short viewports */}
            <div
              data-testid="score-modal-body"
              className="w-full flex flex-col items-center text-center"
            >
              {/* Header icon and titles */}
              <div className="text-[40px] leading-none mb-2 select-none"><Icon name="celebration" /></div>
              <h2 id="score-modal-title" className="text-[22px] sm:text-[24px] font-black text-text-1 tracking-tight mb-1">
                {isSandbox ? 'Problem Simplified!' : 'Stage Complete!'}
              </h2>
              <p id="score-modal-desc" className="text-xs text-text-3 font-normal mb-4">
                {isSandbox
                  ? 'Sandbox practice is unscored: here is how this attempt went'
                  : "Here's how you did across the three metrics"}
              </p>

              {/* Sandbox: compact attempt summary */}
              {isSandbox && (
                <div className="w-full flex flex-col items-center">
                  {/* Solved in X steps | optimal Y pill */}
                  <div className="mb-4 inline-flex select-none items-center justify-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-1 text-xs font-medium text-slate-600 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-300">
                    <span>
                      Solved in <strong className="font-bold text-emerald-600 text-[13px]">{steps.length}</strong> {steps.length === 1 ? 'step' : 'steps'}
                    </span>
                    {optimalSteps > 0 && (
                      <>
                        <span className="text-slate-300 dark:text-slate-600">|</span>
                        <span>
                          optimal <strong className="font-bold text-slate-700 dark:text-slate-200">{optimalSteps}</strong>
                        </span>
                      </>
                    )}
                  </div>

                  {/* Summary card */}
                  <div className="w-full bg-bg border border-border rounded-2xl p-4 flex flex-col gap-2.5 mb-3.5 text-left">
                    {/* Problem row */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-3 font-semibold">Problem</span>
                      <span className="font-mono font-bold text-text-1">{problemExprText}</span>
                    </div>

                    {/* Assistance used row */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-3 font-semibold">Assistance used</span>
                      <span className="font-bold text-text-1">{assistanceText}</span>
                    </div>

                    {/* Divider */}
                    <div className="h-px bg-border my-0.5" />

                    {/* Laws Applied header */}
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-text-3">
                        LAWS APPLIED
                      </span>
                      <span className="text-[11px] font-medium text-text-3">
                        {uniqueLaws.length} used
                      </span>
                    </div>

                    {/* Laws chips */}
                    <div className="flex flex-wrap gap-1.5 mt-0.5">
                      {uniqueLaws.length === 0 ? (
                        <span className="text-xs text-text-3 italic">None</span>
                      ) : (
                        uniqueLaws.map((lawName, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 bg-bg-card border border-border rounded-full text-xs font-semibold text-text-2 shadow-2xs"
                          >
                            {lawName}
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Free practice notice */}
                  <div className="mb-4 flex w-full select-none items-center justify-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-medium text-sky-700 dark:border-cyan-400/30 dark:bg-cyan-500/10 dark:text-cyan-300">
                    <span className="text-sm"><Icon name="flask" /></span>
                    <span>Free practice: no points or progress recorded.</span>
                  </div>
                </div>
              )}

              {/* Graded level score breakdown */}
              {!isSandbox && scoreResult && (
                <div className={`w-full flex flex-col ${shortViewport ? 'gap-2 mb-3' : 'gap-3 mb-5'}`}>
                  {/* Total score badge */}
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <span className={`font-extrabold ${shortViewport ? 'text-2xl' : 'text-3xl'} ${
                      scoreResult.total >= 80 ? 'text-green-600' :
                      scoreResult.total >= 50 ? 'text-amber-600' : 'text-red-500'
                    }`}>{scoreResult.total}</span>
                    <span className="text-sm text-text-3 font-medium">/ 100</span>
                  </div>

                  {/* Metric rows */}
                  {[
                    { icon: 'bolt', label: 'Efficiency', score: scoreResult.efficiency, max: 40,
                      sub: `${scoreResult.breakdown?.stepsUsed ?? 0} steps (${puzzle?.targetLaws?.length ? 'target-law optimal' : 'optimal'}: ${scoreResult.breakdown?.optimalSteps ?? 1})`,
                      color: 'bg-sky-500' },
                    { icon: 'target', label: 'Target Laws', score: scoreResult.targetLaw, max: 30,
                      sub: (scoreResult.breakdown?.targetLawsRequired || []).length === 0
                        ? 'No required laws'
                        : `Used ${(scoreResult.breakdown?.targetLawsUsed || []).length} / ${(scoreResult.breakdown?.targetLawsRequired || []).length} required`,
                      color: 'bg-violet-500' },
                    { icon: 'bulb', label: 'Assistance use', score: scoreResult.hintIndependence, max: 30,
                      sub: (() => {
                        const h = scoreResult.breakdown?.hintsUsed ?? 0
                        const g = scoreResult.breakdown?.guidesUsed ?? 0
                        if (h === 0 && g === 0) return 'No hints or guides used (30 / 30)'
                        if (h > 0 && g === 0) return `${h} hint${h !== 1 ? 's' : ''} used`
                        if (h === 0 && g > 0) return `${g} guide${g !== 1 ? 's' : ''} used`
                        return `${h} hint${h !== 1 ? 's' : ''}, ${g} guide${g !== 1 ? 's' : ''} used`
                      })(),
                      color: 'bg-teal' },
                  ].map(({ icon, label, score, max, sub, color }) => (
                    <div key={label} className={`bg-bg rounded-xl ${shortViewport ? 'px-3 py-1.5' : 'px-4 py-3'} text-left`}>
                      <div className={`flex justify-between items-baseline ${shortViewport ? 'mb-1' : 'mb-1.5'}`}>
                        <span className="text-[13px] font-semibold text-text-1"><Icon name={icon} /> {label}</span>
                        <span className="text-[13px] font-bold text-text-1">{score}<span className="text-text-3 font-normal text-xs"> / {max}</span></span>
                      </div>
                      <div className={`w-full bg-border rounded-full overflow-hidden ${shortViewport ? 'h-1.5' : 'h-2'}`}>
                        <div
                          className={`h-full rounded-full ${color} transition-[width] duration-700 ease-out`}
                          style={{ width: `${(score / max) * 100}%` }}
                        />
                      </div>
                      <div className={`text-[11px] text-text-3 ${shortViewport ? 'mt-0.5' : 'mt-1'}`}>{sub}</div>
                    </div>
                  ))}

                  {/* Optimal hint shown if efficiency < max */}
                  {scoreResult.efficiency < 40 && puzzle?.optimalHint && (
                    <div className={`w-full rounded-lg border border-amber-200 bg-amber-50 text-[12px] leading-relaxed text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200 ${shortViewport ? 'praxis-hide-short p-2' : 'p-3'} text-left`}>
                      <strong><Icon name="bulb" /> Tip:</strong> {puzzle.optimalHint}
                    </div>
                  )}

                  <div className="mt-1 inline-block rounded-full border border-amber-300 bg-amber-50 px-4 py-1.5 text-[14px] font-bold text-amber-700 shadow-sm dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-300">
                    +{earnedXp + (scoreResult?.earnedPoints ?? 0)} Points
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2.5 w-full mt-1">
              <div className="flex items-center gap-2.5 w-full">
                {isSandbox ? (
                  <button
                    type="button"
                    data-autofocus
                    data-tutorial="new-expression-modal-btn"
                    className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-indigo-600 bg-gradient-to-r from-indigo-600 to-cyan-700 px-4 py-3 text-xs font-bold text-white shadow-md shadow-indigo-500/20 transition-[filter] hover:brightness-105 active:scale-[0.99] dark:bg-indigo-600 dark:from-indigo-600 dark:to-cyan-700 dark:shadow-lg dark:shadow-indigo-500/25"
                    onClick={() => {
                      if (isCustomSandbox) onNewExpression()
                      else onRandomize()
                    }}
                  >
                    {isCustomSandbox ? (
                      <svg className="w-3.5 h-3.5 text-white shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                      </svg>
                    ) : (
                      <span><Icon name="dice" /></span>
                    )}
                    <span>{isCustomSandbox ? 'New Expression' : 'New Problem'}</span>
                  </button>
                ) : level && stageNum + 1 < level.puzzles.length ? (
                  <button
                    type="button"
                    disabled={isTutorialActive}
                    className={`flex-1 bg-indigo-600 bg-gradient-to-r from-indigo-600 to-cyan-700 text-white font-bold text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-indigo-500/20 transition-[filter] hover:brightness-105 dark:bg-indigo-600 dark:from-indigo-600 dark:to-cyan-700 dark:shadow-lg dark:shadow-indigo-500/25 ${
                      isTutorialActive ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer active:scale-[0.99]'
                    }`}
                    data-autofocus
                    onClick={onNextStage}
                  >
                    Next Stage →
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isTutorialActive}
                    className={`flex-1 bg-indigo-600 bg-gradient-to-r from-indigo-600 to-cyan-700 text-white font-bold text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-indigo-500/20 transition-[filter] hover:brightness-105 dark:bg-indigo-600 dark:from-indigo-600 dark:to-cyan-700 dark:shadow-lg dark:shadow-indigo-500/25 ${
                      isTutorialActive ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer active:scale-[0.99]'
                    }`}
                    data-autofocus
                    onClick={onBackToStages}
                  >
                    Back to Stages
                  </button>
                )}

                {/* Replay button */}
                <button
                  type="button"
                  disabled={isTutorialActive}
                  className={`shrink-0 rounded-xl bg-transparent text-slate-600 font-bold text-xs py-3 px-3 sm:px-4 flex items-center justify-center gap-1.5 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 ${
                    isTutorialActive ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                  }`}
                  onClick={onReset}
                >
                  <svg className="w-3.5 h-3.5 text-text-2 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                  </svg>
                  <span>{isSandbox ? 'Replay' : 'Try Again'}</span>
                </button>
              </div>

              {/* Review Completed Derivation Button */}
              <button
                type="button"
                data-tutorial="review-derivation-btn"
                className="w-full bg-bg hover:bg-border border border-border text-text-2 hover:text-text-1 font-semibold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                onClick={() => onClose()}
              >
                <span><Icon name="search" /></span>
                <span>Review Completed Derivation</span>
              </button>
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  )
}
