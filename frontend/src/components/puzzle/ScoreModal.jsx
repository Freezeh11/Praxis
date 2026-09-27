/**
 * ScoreModal — the completion overlay. Graded stages get the three-metric score
 * breakdown (the local estimate, overwritten by the server result when it
 * arrives); the sandbox gets the same chassis with an unscored attempt summary,
 * because nothing is awarded or persisted there.
 *
 * The body scrolls while the action row stays put, so the primary button is
 * reachable even on a 320px-tall phone.
 */
import { AnimatePresence, motion } from 'framer-motion'

export default function ScoreModal({
  showSuccess, onClose, isTutorialActive, shortViewport, isSandbox, isCustomSandbox,
  steps, optimalSteps, hintsUsed, guidesUsed, scoreResult, earnedXp, puzzle, level,
  stageNum, onNewExpression, onRandomize, onNextStage, onBackToStages, onReset,
}) {
  return (
  <AnimatePresence>
    {showSuccess && (
      <motion.div
        key="success-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className={`fixed inset-0 z-50 flex items-center justify-center p-3 cursor-pointer ${
          isTutorialActive ? 'bg-transparent' : 'bg-white/60 backdrop-blur-[8px]'
        }`}
        onClick={() => onClose()}
      >
        <motion.div
          data-tutorial="score-modal"
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -6 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className={`bg-white rounded-2xl flex flex-col items-center shadow-2xl max-w-[420px] w-full border border-border cursor-default praxis-modal-panel ${
            shortViewport ? 'py-3' : 'py-8'
          }`}
          onClick={e => e.stopPropagation()}
        >
          {/* Scrollable body + fixed action row: on a 390px-tall phone the
              metrics scroll while the buttons stay put, so nothing is cut
              off and the primary action is never covered. */}
          <div
            data-testid="score-modal-body"
            className={`w-full flex-1 min-h-0 overflow-y-auto overscroll-contain flex flex-col items-center ${
              shortViewport ? 'px-4' : 'px-8'
            }`}
          >
          <div className={`leading-none ${shortViewport ? 'text-[26px] mb-0.5' : 'text-[44px] mb-1'}`}>🎉</div>
          <h2 className={`font-extrabold text-accent ${shortViewport ? 'text-[19px] mb-0.5' : 'text-[26px] mb-1'}`}>
            {isSandbox ? 'Problem Simplified!' : 'Stage Complete!'}
          </h2>
          <p className={`text-xs text-text-3 ${shortViewport ? 'praxis-hide-short mb-2' : 'mb-5'}`}>
            {isSandbox
              ? 'Sandbox practice is unscored — here is how this attempt went'
              : "Here's how you did across the three metrics"}
          </p>

          {/* Sandbox: compact attempt summary instead of a score breakdown */}
          {isSandbox && (
            <div className={`w-full flex flex-col ${shortViewport ? 'gap-2 mb-3' : 'gap-3 mb-5'}`}>
              <div className="flex items-center justify-center gap-1.5">
                <span className={`font-extrabold ${shortViewport ? 'text-2xl' : 'text-3xl'} ${
                  optimalSteps === 0 || steps.length <= optimalSteps ? 'text-green-600' : 'text-amber-600'
                }`}>{steps.length}</span>
                <span className="text-sm text-text-3 font-medium">
                  step{steps.length === 1 ? '' : 's'}
                  {optimalSteps > 0 ? ` / optimal ${optimalSteps}` : ''}
                </span>
              </div>
              <div className={`bg-bg rounded-xl flex flex-col ${shortViewport ? 'px-3 py-2 gap-1' : 'px-4 py-3 gap-1.5'}`}>
                <div className="flex justify-between text-[11px]">
                  <span className="text-text-2 font-semibold">Problem</span>
                  <span className="text-text-1 font-bold">{isCustomSandbox ? 'Your expression' : 'Random practice'}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-text-2 font-semibold">Assistance used</span>
                  <span className="text-text-1 font-bold">
                    {(() => {
                      const h = hintsUsed || 0
                      const g = guidesUsed || 0
                      if (h === 0 && g === 0) return 'None'
                      if (h > 0 && g === 0) return `${h} hint${h !== 1 ? 's' : ''}`
                      if (h === 0 && g > 0) return `${g} guide${g !== 1 ? 's' : ''}`
                      return `${h} hint${h !== 1 ? 's' : ''}, ${g} guide${g !== 1 ? 's' : ''}`
                    })()}
                  </span>
                </div>
                <div className="flex justify-between text-[11px] gap-3">
                  <span className="text-text-2 font-semibold shrink-0">Laws applied</span>
                  <span className="text-text-1 font-bold text-right">
                    {steps.length === 0
                      ? '—'
                      : [...new Set(steps.map(s => s?.law).filter(Boolean))].join(', ')}
                  </span>
                </div>
              </div>
              <div className={`text-[11px] text-sky-900 bg-sky-50 border border-sky-200 rounded-lg leading-relaxed text-center ${shortViewport ? 'p-2' : 'p-2.5'}`}>
                🧪 No points, stars, or progress were recorded for this attempt.
              </div>
            </div>
          )}

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
                <div key={label} className={`bg-bg rounded-xl ${shortViewport ? 'px-3 py-1.5' : 'px-4 py-3'}`}>
                  <div className={`flex justify-between items-baseline ${shortViewport ? 'mb-1' : 'mb-1.5'}`}>
                    <span className="text-[13px] font-semibold text-text-1">{label}</span>
                    <span className="text-[13px] font-bold text-text-1">{score}<span className="text-text-3 font-normal text-xs"> / {max}</span></span>
                  </div>
                  <div className={`w-full bg-border rounded-full overflow-hidden ${shortViewport ? 'h-1.5' : 'h-2'}`}>
                    <div
                      className={`h-full rounded-full ${color} transition-all duration-700`}
                      style={{ width: `${(score / max) * 100}%` }}
                    />
                  </div>
                  <div className={`text-[11px] text-text-3 ${shortViewport ? 'mt-0.5' : 'mt-1'}`}>{sub}</div>
                </div>
              ))}

              {/* Optimal hint shown if efficiency < max */}
              {scoreResult.efficiency < 40 && puzzle?.optimalHint && (
                <div className={`text-[12px] text-amber-800 bg-amber-50 border border-amber/30 rounded-lg w-full leading-relaxed ${shortViewport ? 'praxis-hide-short p-2' : 'p-3'}`}>
                  <strong>💡 Tip:</strong> {puzzle.optimalHint}
                </div>
              )}
            </div>
          )}

          {!isSandbox && (
            <div className={`inline-block text-[14px] font-bold text-amber-600 bg-amber-50 border-2 border-amber px-4 py-1.5 rounded-full shadow-sm ${shortViewport ? 'mb-2' : 'mb-5'}`}>
              +{earnedXp + (scoreResult?.earnedPoints ?? 0)} Points
            </div>
          )}
          </div>{/* end scrollable modal body */}

          {/* Sticky-safe action row: it lives OUTSIDE the scroll area, so
              the primary button is always on screen even at 320px tall. */}
          <div className={`praxis-modal-actions flex flex-col gap-2.5 w-full shrink-0 ${shortViewport ? 'px-4 pt-2' : 'px-8 pt-2'}`}>
            <div className="flex gap-3 w-full">
              {isSandbox ? (
                isCustomSandbox ? (
                  <button
                    data-tutorial="new-expression-modal-btn"
                    className={`flex-1 bg-accent text-white rounded-lg font-semibold text-sm transition-all shadow-md hover:bg-text-1 hover:shadow-lg hover:-translate-y-px cursor-pointer ${shortViewport ? 'py-2.5' : 'py-3'}`}
                    onClick={() => onNewExpression()}
                  >
                    ✎ New expression
                  </button>
                ) : (
                  <button
                    data-tutorial="randomize-modal-btn"
                    className={`flex-1 bg-accent text-white rounded-lg font-semibold text-sm transition-all shadow-md hover:bg-text-1 hover:shadow-lg hover:-translate-y-px cursor-pointer ${shortViewport ? 'py-2.5' : 'py-3'}`}
                    onClick={() => onRandomize()}
                  >
                    🎲 New Problem
                  </button>
                )
              ) : level && stageNum + 1 < level.puzzles.length ? (
                <button
                  disabled={isTutorialActive}
                  className={`flex-1 bg-accent text-white rounded-lg font-semibold text-sm transition-all shadow-md ${shortViewport ? 'py-2.5' : 'py-3'} ${
                    isTutorialActive
                      ? 'opacity-40 cursor-not-allowed'
                      : 'hover:bg-text-1 hover:shadow-lg hover:-translate-y-px cursor-pointer'
                  }`}
                  onClick={onNextStage}
                >
                  Next Stage →
                </button>
              ) : (
                <button
                  disabled={isTutorialActive}
                  className={`flex-1 bg-accent text-white rounded-lg font-semibold text-sm transition-all shadow-md ${shortViewport ? 'py-2.5' : 'py-3'} ${
                    isTutorialActive
                      ? 'opacity-40 cursor-not-allowed'
                      : 'hover:bg-text-1 hover:shadow-lg hover:-translate-y-px cursor-pointer'
                  }`}
                  onClick={() => onBackToStages()}
                >
                  Back to Stages
                </button>
              )}
              <button
                disabled={isTutorialActive}
                className={`px-5 border-[1.5px] border-border text-text-2 font-semibold text-sm rounded-lg bg-transparent transition-all ${shortViewport ? 'py-2.5' : 'py-3'} ${
                  isTutorialActive
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:bg-bg hover:border-border-dark cursor-pointer'
                }`}
                onClick={onReset}
              >
                {isSandbox ? 'Replay' : 'Try Again'}
              </button>
            </div>

            {/* Review Completed Derivation Button */}
            <button
              data-tutorial="review-derivation-btn"
              className={`w-full border border-slate-200 text-text-2 font-semibold text-xs rounded-lg bg-slate-50 transition-all hover:bg-slate-100 hover:text-text-1 flex items-center justify-center gap-1.5 cursor-pointer ${shortViewport ? 'py-2' : 'py-2.5'}`}
              onClick={() => onClose()}
            >
              <span>🔍</span> Review Completed Derivation
            </button>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
  )
}
