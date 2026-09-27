/**
 * @file InteractiveTutorial.jsx
 * @description Redesigned Interactive Tutorial Component for Praxis.
 * Features a deep dark backdrop, seamless modal cross-fade, cinematic fade reveal,
 * and adaptive floating coach cards. Thin orchestrator: the step machine, the
 * spotlight-rect tracking, the coach-card placement and the three visual pieces
 * live in ./tutorial/*.
 */

import { useEffect } from 'react'
import { useTutorialProgress } from './tutorial/useTutorialProgress'
import { useSpotlightRects } from './tutorial/useSpotlightRects'
import { useCoachCardPlacement } from './tutorial/useCoachCardPlacement'
import WelcomeModal from './tutorial/WelcomeModal'
import Spotlight from './tutorial/Spotlight'
import CoachCard from './tutorial/CoachCard'

/**
 * @param {Object} props
 * @param {number} props.stageIdx - Current stage index (0, 1, 2, 3)
 * @param {Array} props.sel - Selected paths in expression
 * @param {Array} props.steps - Derivation steps history
 * @param {Object} props.expr - Current expression AST
 * @param {Array} props.applicableLaws - Currently applicable Boolean laws
 * @param {boolean} props.isComplete - Whether stage is solved
 * @param {boolean} props.isPreLawHighlight - Whether a pressed law is highlighting the equation
 * @param {boolean} props.isAnimating - Whether a law transformation is animating
 * @param {boolean} props.showSuccess - Whether the success feedback is showing
 * @param {() => void} props.onResetStage - Callback to restore the current stage's initial state
 * @param {() => void} props.onNextStage - Callback to advance to next tutorial stage
 * @param {() => void} props.onFinish - Callback to conclude tutorial
 * @param {() => void} props.onSkip - Callback to dismiss tutorial
 */
export default function InteractiveTutorial({
  stageIdx = 0,
  sel = [],
  steps = [],
  expr = null,
  applicableLaws = [],
  isComplete = false,
  isPreLawHighlight = false,
  isAnimating = false,
  showSuccess = false,
  onResetStage,
  onNextStage,
  onFinish,
  onSkip,
}) {
  const {
    stepsForStage,
    currentStep,
    currentStepIdx,
    showWelcomeModal,
    setShowWelcomeModal,
    currentSlideIdx,
    setCurrentSlideIdx,
    handleActionButton,
  } = useTutorialProgress({
    stageIdx,
    sel,
    steps,
    expr,
    applicableLaws,
    isComplete,
    showSuccess,
    onResetStage,
    onNextStage,
    onFinish,
  })

  const { highlightRect, secondaryHighlightRect } = useSpotlightRects({
    stageIdx,
    currentStep,
    currentStepIdx,
    sel,
    steps,
    expr,
    isComplete,
    isPreLawHighlight,
    isAnimating,
  })

  const cardRef = useCoachCardPlacement({ currentStep, highlightRect, secondaryHighlightRect })

  // Intercept and prevent clicks/pointerdowns on non-target elements during active tutorial steps
  useEffect(() => {
    if (showWelcomeModal || !currentStep || currentStep.noOverlay) return

    // Allow full interaction on free challenge solve step
    if (stageIdx === 3 && currentStep.id === 'challenge-solve') return

    const handleCapturePointer = (e) => {
      // Always allow interactions with the coach tooltip card
      if (e.target.closest('[data-tutorial-card]')) return

      // Always allow interactions with tutorial controls (skip, exit)
      if (e.target.closest('[data-tutorial-exit]') || e.target.closest('[data-tutorial-skip]')) return

      // Allow interaction if target is within the primary tutorial target
      if (currentStep.target) {
        const targetEl = document.querySelector(currentStep.target)
        if (targetEl && (targetEl === e.target || targetEl.contains(e.target))) {
          return
        }
      }

      // Allow interaction if target is within the secondary tutorial target
      if (currentStep.secondaryTarget) {
        const secTargetEl = document.querySelector(currentStep.secondaryTarget)
        if (secTargetEl && (secTargetEl === e.target || secTargetEl.contains(e.target))) {
          return
        }
      }

      // Block all unauthorized clicks on other variables/terms/cards to prevent breaking tutorial state
      e.stopPropagation()
      e.preventDefault()
    }

    window.addEventListener('click', handleCapturePointer, true)
    window.addEventListener('mousedown', handleCapturePointer, true)
    window.addEventListener('pointerdown', handleCapturePointer, true)

    return () => {
      window.removeEventListener('click', handleCapturePointer, true)
      window.removeEventListener('mousedown', handleCapturePointer, true)
      window.removeEventListener('pointerdown', handleCapturePointer, true)
    }
  }, [showWelcomeModal, currentStep, stageIdx])

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* ── 1. CINEMATIC WELCOME MODAL WITH FAST GPU-ACCELERATED TRANSITIONS ── */}
      <WelcomeModal
        showWelcomeModal={showWelcomeModal}
        currentSlideIdx={currentSlideIdx}
        setCurrentSlideIdx={setCurrentSlideIdx}
        setShowWelcomeModal={setShowWelcomeModal}
        onResetStage={onResetStage}
      />

      {/* ── 2. IN-SITU WORKSPACE SPOTLIGHT & COACH OVERLAY ── */}
      <Spotlight
        showWelcomeModal={showWelcomeModal}
        currentStep={currentStep}
        stageIdx={stageIdx}
        steps={steps}
        isComplete={isComplete}
        isPreLawHighlight={isPreLawHighlight}
        highlightRect={highlightRect}
        secondaryHighlightRect={secondaryHighlightRect}
      />

      {/* Floating Coach Tooltip Card */}
      <CoachCard
        showWelcomeModal={showWelcomeModal}
        currentStep={currentStep}
        currentStepIdx={currentStepIdx}
        stepsForStage={stepsForStage}
        stageIdx={stageIdx}
        steps={steps}
        isComplete={isComplete}
        isPreLawHighlight={isPreLawHighlight}
        isAnimating={isAnimating}
        highlightRect={highlightRect}
        cardRef={cardRef}
        onSkip={onSkip}
        onActionButton={handleActionButton}
      />
    </div>
  )
}
