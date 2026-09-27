/**
 * @file useTutorialProgress.js
 * @description The tutorial step state machine: stage step lists, current step
 * index, welcome-modal/slide state, the reactive auto-advance effect and the
 * manual action-button handler.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TUTORIAL_STAGES } from '../../lib/tutorialData'

export function useTutorialProgress({
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
}) {
  const stepsForStage = useMemo(() => TUTORIAL_STAGES[stageIdx] || [], [stageIdx])
  const [currentStepIdx, setCurrentStepIdx] = useState(0)
  
  // Show the welcome modal exclusively on Stage 0 (first load)
  const [showWelcomeModal, setShowWelcomeModal] = useState(() => stageIdx === 0)
  const [currentSlideIdx, setCurrentSlideIdx] = useState(0)


  const onResetStageRef = useRef(onResetStage)
  useEffect(() => {
    onResetStageRef.current = onResetStage
  })

  const currentStep = stepsForStage[currentStepIdx] || null

  const prevStepsLenRef = useRef(steps.length)

  // Reset steps and stage state when stage changes
  useEffect(() => {
    setCurrentStepIdx(0)
    prevStepsLenRef.current = 0
    onResetStageRef.current?.()
    if (stageIdx === 0) {
      setShowWelcomeModal(true)
      setCurrentSlideIdx(0)
    } else {
      setShowWelcomeModal(false)
    }
  }, [stageIdx])

  const advanceStep = useCallback(() => {
    if (currentStepIdx + 1 < stepsForStage.length) {
      setCurrentStepIdx(prev => prev + 1)
    }
  }, [currentStepIdx, stepsForStage.length])

  // React to user interactions automatically (with full bi-directional reactive selection recovery)
  useEffect(() => {
    if (!currentStep || showWelcomeModal) return

    // ── Stage 3 (T4): Challenge Solve completion reactive check ──
    if (stageIdx === 3 && currentStep.id === 'challenge-solve') {
      if (isComplete || showSuccess) {
        advanceStep()
        return
      }
    }

    // ── Stage 0 (T1): Fully reactive selection state machine for "x + xy" ──
    if (stageIdx === 0 && currentStepIdx <= 3) {
      const hasLoneX = sel.some(s => s.path === 'R.0')
      // Whole term xy is selected ONLY when path is 'R.1' (whole term, not 'R.1.0' or 'R.1.1')
      const hasWholeXY = sel.some(s => s.path === 'R.1')
      const hasSubVarXY = sel.some(s => s.path === 'R.1.0' || s.path === 'R.1.1')

      if (steps.length > prevStepsLenRef.current) {
        prevStepsLenRef.current = steps.length
        advanceStep()
        return
      }

      if (!hasLoneX && !hasWholeXY && !hasSubVarXY) {
        if (currentStepIdx !== 0) setCurrentStepIdx(0)
        return
      }

      if (!hasLoneX && (hasWholeXY || hasSubVarXY)) {
        // xy (or a variable inside it) is selected but lone x is not -> prompt to select lone x (Step 0)
        if (currentStepIdx !== 0) setCurrentStepIdx(0)
        return
      }

      if (hasLoneX && !hasWholeXY) {
        // lone x is selected, but whole term xy is not yet selected (even if user clicked variable y inside xy)
        // -> stay on Step 1 (prompt to select the whole term xy)
        if (currentStepIdx !== 1) setCurrentStepIdx(1)
        return
      }

      if (hasLoneX && hasWholeXY) {
        // Both lone x AND whole term xy are selected -> step 2 (Ready to Simplify)
        if (currentStepIdx === 0 || currentStepIdx === 1) {
          setCurrentStepIdx(2)
        }
        return
      }
    }

    switch (currentStep.actionType) {
      case 'select':
      case 'select_var': {
        if (sel.length >= 1) {
          advanceStep()
        }
        break
      }
      case 'select_both': {
        if (sel.length >= 2) {
          advanceStep()
        } else if (sel.length === 0 && currentStepIdx > 0 && stepsForStage[currentStepIdx - 1]?.actionType === 'select_var') {
          // If user unselected everything, step back to pick the first variable
          setCurrentStepIdx(currentStepIdx - 1)
        }
        break
      }
      case 'button': {
        break
      }
      case 'apply_law': {
        if (steps.length > prevStepsLenRef.current) {
          prevStepsLenRef.current = steps.length
          if (stageIdx === 3 && currentStep.id === 'challenge-solve') {
            if (isComplete || showSuccess) {
              advanceStep()
            }
          } else {
            advanceStep()
          }
        } else if (stageIdx === 3 && currentStep.id === 'challenge-solve' && (isComplete || showSuccess)) {
          advanceStep()
        } else if (currentStep.id === 'apply-distributive-factor' && (sel.length < 2 || !applicableLaws.some(l => l.name?.includes('Distributive')))) {
          setCurrentStepIdx(2)
        } else if (currentStep.id === 'apply-complement' && (sel.length < 2 || !applicableLaws.some(l => l.name?.includes('Complement')))) {
          setCurrentStepIdx(4)
        } else if (currentStep.id === 'apply-identity' && (sel.length === 0 || !applicableLaws.some(l => l.name?.includes('Identity')))) {
          setCurrentStepIdx(6)
        } else if (currentStep.id === 'apply-demorgan') {
          const isNotSelected = sel.length === 1 && (sel[0].path === 'R.0' || sel[0].type === 'not') && applicableLaws.some(l => l.name?.includes("De Morgan"))
          if (!isNotSelected) {
            setCurrentStepIdx(1)
          }
        } else if (currentStep.id === 'apply-idempotent' && (sel.length < 2 || !applicableLaws.some(l => l.name?.includes('Idempotent')))) {
          setCurrentStepIdx(3)
        }
        break
      }
      case 'swap': {
        const terms = expr?.type === 'sum' ? expr.terms : []
        // Swapped when the two 2-variable terms (x'y and xy) are placed side-by-side at index 0 and 1
        const hasSwapped = terms.length === 3 && terms[0]?.factors?.length === 2 && terms[1]?.factors?.length === 2
        if (hasSwapped) {
          advanceStep()
        }
        break
      }
      case 'click_not': {
        // Only advance when the NOT capsule itself is selected (path R.0 or type 'not' with De Morgan available), NOT an inner sub-variable
        const isNotSelected = sel.length === 1 && (sel[0].path === 'R.0' || sel[0].type === 'not') && applicableLaws.some(l => l.name?.includes("De Morgan"))
        if (isNotSelected) {
          const timer = setTimeout(() => {
            advanceStep()
          }, 1000)
          return () => clearTimeout(timer)
        }
        break
      }
      case 'click_review': {
        if (!showSuccess) {
          advanceStep()
        }
        break
      }
      default:
        break
    }
  }, [sel, steps, expr, applicableLaws, currentStep, currentStepIdx, stageIdx, stepsForStage, showWelcomeModal, showSuccess, advanceStep])

  const handleActionButton = () => {
    if (!currentStep) return
    if (currentStep.actionType === 'next_stage') {
      onNextStage?.()
    } else if (currentStep.actionType === 'finish') {
      onFinish?.()
    } else {
      advanceStep()
    }
  }

  return {
    stepsForStage,
    currentStep,
    currentStepIdx,
    showWelcomeModal,
    setShowWelcomeModal,
    currentSlideIdx,
    setCurrentSlideIdx,
    advanceStep,
    handleActionButton,
  }
}
