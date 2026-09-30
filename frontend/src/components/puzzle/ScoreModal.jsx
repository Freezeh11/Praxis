/**
 * ScoreModal: the completion overlay. Graded stages get the three-metric score
 * breakdown; the sandbox gets the compact attempt summary with law pills,
 * because nothing is awarded or persisted there.
 */
import { useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

export default function ScoreModal({
  showSuccess, onClose, isTutorialActive, shortViewport, isSandbox, isCustomSandbox,
  steps, optimalSteps, hintsUsed, guidesUsed, scoreResult, earnedXp, puzzle, level,
  stageNum, onNewExpression, onRandomize, onNextStage, onBackToStages, onReset,
}) {
  const uniqueLaws = useMemo(() => {
    return [...new Set(steps.map(s => s?.law).filter(Boolean))]
  }, [steps])

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
        <motion.div
          key="success-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className={`fixed inset-0 z-50 flex items-center justify-center p-3 cursor-pointer will-change-[opacity] ${
            isTutorialActive ? 'bg-transparent' : 'bg-black/45'
          }`}
          onClick={() => onClose()}
        >
          <motion.div
            data-tutorial="score-modal"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className={`bg-white rounded-3xl flex flex-col items-center shadow-2xl max-w-[430px] w-full border border-slate-200/80 cursor-default praxis-modal-panel transform-gpu will-change-transform ${
              shortViewport ? 'p-4' : 'p-6 sm:p-7'
            }`}
            onClick={e => e.stopPropagation()}
          >
            {/* Scrollable body on short viewports */}
            <div
              data-testid="score-modal-body"
              className="w-full flex flex-col items-center text-center"
            >
              {/* Header emoji and titles */}
              <div className="text-[40px] leading-none mb-2 select-none">🎉</div>
              <h2 className="text-[22px] sm:text-[24px] font-black text-[#111827] tracking-tight mb-1">
                {isSandbox ? 'Problem Simplified!' : 'Stage Complete!'}
              </h2>
              <p className="text-xs text-[#6B7280] font-normal mb-4">
                {isSandbox
                  ? 'Sandbox practice is unscored: here is how this attempt went'
                  : "Here's how you did across the three metrics"}
              </p>

              {/* Sandbox: compact attempt summary */}
              {isSandbox && (
                <div className="w-full flex flex-col items-center">
                  {/* Solved in X steps | optimal Y pill */}
                  <div className="inline-flex items-center justify-center gap-2 px-4 py-1 rounded-full border border-sky-100 bg-sky-50/70 text-xs text-slate-600 font-medium mb-4 select-none">
                    <span>
                      Solved in <strong className="font-bold text-emerald-600 text-[13px]">{steps.length}</strong> {steps.length === 1 ? 'step' : 'steps'}
                    </span>
                    {optimalSteps > 0 && (
                      <>
                        <span className="text-slate-300">|</span>
                        <span>
                          optimal <strong className="font-bold text-slate-700">{optimalSteps}</strong>
                        </span>
                      </>
                    )}
                  </div>

                  {/* Summary card */}
                  <div className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-4 flex flex-col gap-2.5 mb-3.5 text-left">
                    {/* Problem row */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#64748B] font-semibold">Problem</span>
                      <span className="font-mono font-bold text-[#0F172A]">{problemExprText}</span>
                    </div>

                    {/* Assistance used row */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#64748B] font-semibold">Assistance used</span>
                      <span className="font-bold text-[#0F172A]">{assistanceText}</span>
                    </div>

                    {/* Divider */}
                    <div className="h-px bg-[#E2E8F0] my-0.5" />

                    {/* Laws Applied header */}
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                        LAWS APPLIED
                      </span>
                      <span className="text-[11px] font-medium text-[#94A3B8]">
                        {uniqueLaws.length} used
                      </span>
                    </div>

                    {/* Laws chips */}
                    <div className="flex flex-wrap gap-1.5 mt-0.5">
                      {uniqueLaws.length === 0 ? (
                        <span className="text-xs text-[#94A3B8] italic">None</span>
                      ) : (
                        uniqueLaws.map((lawName, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 bg-white border border-[#E2E8F0] rounded-full text-xs font-semibold text-[#334155] shadow-2xs"
                          >
                            {lawName}
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Free practice notice */}
                  <div className="w-full border border-[#BAE6FD] bg-[#F0F9FF] text-[#0369A1] rounded-xl py-2 px-3 text-xs font-medium flex items-center justify-center gap-1.5 mb-4 select-none">
                    <span className="text-sm">🧪</span>
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
                    { label: '⚡ Efficiency', score: scoreResult.efficiency, max: 40,
                      sub: `${scoreResult.breakdown?.stepsUsed ?? 0} steps (optimal: ${scoreResult.breakdown?.optimalSteps ?? 1})`,
                      color: 'bg-sky-500' },
                    { label: '🎯 Target Laws', score: scoreResult.targetLaw, max: 30,
                      sub: (scoreResult.breakdown?.targetLawsRequired || []).length === 0
                        ? 'No required laws'
                        : `Used ${(scoreResult.breakdown?.targetLawsUsed || []).length} / ${(scoreResult.breakdown?.targetLawsRequired || []).length} required`,
                      color: 'bg-violet-500' },
                    { label: '💡 Independence', score: scoreResult.hintIndependence, max: 30,
                      sub: (() => {
                        const h = scoreResult.breakdown?.hintsUsed ?? 0
                        const g = scoreResult.breakdown?.guidesUsed ?? 0
                        if (h === 0 && g === 0) return 'No hints or guides used (30 / 30)'
                        if (h > 0 && g === 0) return `${h} hint${h !== 1 ? 's' : ''} used`
                        if (h === 0 && g > 0) return `${g} guide${g !== 1 ? 's' : ''} used`
                        return `${h} hint${h !== 1 ? 's' : ''}, ${g} guide${g !== 1 ? 's' : ''} used`
                      })(),
                      color: 'bg-teal' },
                  ].map(({ label, score, max, sub, color }) => (
                    <div key={label} className={`bg-bg rounded-xl ${shortViewport ? 'px-3 py-1.5' : 'px-4 py-3'} text-left`}>
                      <div className={`flex justify-between items-baseline ${shortViewport ? 'mb-1' : 'mb-1.5'}`}>
                        <span className="text-[13px] font-semibold text-text-1">{label}</span>
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
                    <div className={`text-[12px] text-amber-800 bg-amber-50 border border-amber/30 rounded-lg w-full leading-relaxed ${shortViewport ? 'praxis-hide-short p-2' : 'p-3'} text-left`}>
                      <strong>💡 Tip:</strong> {puzzle.optimalHint}
                    </div>
                  )}

                  <div className="inline-block text-[14px] font-bold text-amber-600 bg-amber-50 border-2 border-amber px-4 py-1.5 rounded-full shadow-sm mt-1">
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
                    data-tutorial="new-expression-modal-btn"
                    className="flex-1 bg-[#1E2433] hover:bg-[#2B3347] text-white font-bold text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer active:scale-[0.99]"
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
                      <span>🎲</span>
                    )}
                    <span>{isCustomSandbox ? 'New Expression' : 'New Problem'}</span>
                  </button>
                ) : level && stageNum + 1 < level.puzzles.length ? (
                  <button
                    type="button"
                    disabled={isTutorialActive}
                    className={`flex-1 bg-[#1E2433] hover:bg-[#2B3347] text-white font-bold text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all ${
                      isTutorialActive ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer active:scale-[0.99]'
                    }`}
                    onClick={onNextStage}
                  >
                    Next Stage →
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isTutorialActive}
                    className={`flex-1 bg-[#1E2433] hover:bg-[#2B3347] text-white font-bold text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all ${
                      isTutorialActive ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer active:scale-[0.99]'
                    }`}
                    onClick={onBackToStages}
                  >
                    Back to Stages
                  </button>
                )}

                {/* Replay button */}
                <button
                  type="button"
                  disabled={isTutorialActive}
                  className={`shrink-0 bg-transparent hover:bg-slate-100 text-[#334155] font-bold text-xs py-3 px-3 sm:px-4 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                    isTutorialActive ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                  }`}
                  onClick={onReset}
                >
                  <svg className="w-3.5 h-3.5 text-[#334155] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
                className="w-full bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] text-[#475569] hover:text-[#1E293B] font-semibold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                onClick={() => onClose()}
              >
                <span>🔍</span>
                <span>Review Completed Derivation</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
