/**
 * @file CoachCard.jsx
 * @description The floating coach tooltip card: step counter, dead-end aware
 * title/description, exit control, manual action button, and its own
 * pre-measurement placement style helper.
 */
import { motion, AnimatePresence } from 'framer-motion'
import { getTooltipStyle } from './coachCardFallbackStyle'

export default function CoachCard({
  showWelcomeModal,
  currentStep,
  currentStepIdx,
  stepsForStage,
  stageIdx,
  steps,
  isComplete,
  isPreLawHighlight,
  isAnimating,
  highlightRect,
  cardRef,
  onSkip,
  onActionButton,
}) {
  return (
    <AnimatePresence mode="wait">
      {!showWelcomeModal && !isPreLawHighlight && !isAnimating && currentStep && (
        <motion.div
          ref={cardRef}
          data-tutorial-card="true"
          key={currentStep.id}
          initial={{ opacity: 0, scale: 0.96, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -6 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="praxis-modal-panel fixed bg-white rounded-2xl p-5 [@media(max-height:480px)]:p-4 shadow-2xl border border-border w-[330px] [@media(max-height:480px)]:w-auto flex flex-col gap-3 [@media(max-height:480px)]:gap-2.5 pointer-events-auto"
          style={{
            zIndex: 55,
            ...getTooltipStyle(currentStep, highlightRect),
          }}
        >
        {/* Card Header: Subtle minimalist step tracker without pill badges */}
        <div className="flex items-center justify-between pb-1 border-b border-border/50 [@media(max-height:480px)]:sticky [@media(max-height:480px)]:top-0 [@media(max-height:480px)]:z-[2] [@media(max-height:480px)]:bg-white">
          <span className="text-[11px] font-bold text-teal tracking-wider uppercase">
            Step {currentStepIdx + 1} of {stepsForStage.length}
          </span>
          <button
            data-tutorial-exit="true"
            type="button"
            onClick={onSkip}
            className="text-[11px] [@media(max-height:480px)]:min-h-11 [@media(max-height:480px)]:px-2 [@media(max-height:480px)]:inline-flex [@media(max-height:480px)]:items-center font-semibold text-text-3 hover:text-text-1 hover:underline transition-colors"
          >
            Exit Tutorial
          </button>
        </div>

        {/* Title & Description */}
        <div className="py-0.5">
          <h4 className="text-[14.5px] font-extrabold text-text-1 mb-1 tracking-tight">
            {(() => {
              if (stageIdx === 3 && currentStep.id === 'challenge-solve') {
                const lastLaw = steps.length > 0 ? steps[steps.length - 1]?.law : null
                if (lastLaw?.includes('Absorption') && !isComplete) {
                  return 'Dead End Reached ⚠️'
                }
                return currentStep.title
              }
              return currentStep.title
            })()}
          </h4>
          <p className="text-[12.5px] text-text-2 leading-relaxed">
            {(() => {
              if (stageIdx === 3 && currentStep.id === 'challenge-solve') {
                const lastLaw = steps.length > 0 ? steps[steps.length - 1]?.law : null
                if (lastLaw?.includes('Absorption') && !isComplete) {
                  return 'Absorbing "xy" into "x" left "x + x\'y", which cannot be simplified further. Use "↶ Undo" or "↺ Reset" at the top to retrace your move and try a different approach (like factoring common variables)!'
                }
                return currentStep.desc
              }
              return currentStep.desc
            })()}
          </p>
        </div>

        {/* Card Footer Actions (Rendered for manual navigation steps) */}
        {['button', 'next_stage', 'finish'].includes(currentStep.actionType) && (
          <div className="praxis-modal-actions flex items-center justify-end pt-2.5 border-t border-border/70 mt-0.5">
            <button
              type="button"
              onClick={onActionButton}
              className="px-4 py-1.5 [@media(max-height:480px)]:min-h-11 [@media(max-height:480px)]:flex [@media(max-height:480px)]:items-center rounded-xl text-xs font-bold bg-accent text-white hover:bg-slate-800 shadow-sm transition-all ml-auto cursor-pointer"
            >
              {currentStep.buttonText || 'Next →'}
            </button>
          </div>
        )}
      </motion.div>
    )}
    </AnimatePresence>
  )
}
