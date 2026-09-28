/**
 * @file useSpotlightRects.js
 * @description Tracks the rectangles the spotlight highlights: the active
 * equation while a law is applied, the current step's target and its optional
 * secondary target — refreshed on resize/scroll and on a 200 ms interval.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  buildEquationHighlight,
  buildScoreModalFallbackHighlight,
  buildSecondaryHighlight,
  buildTargetHighlight,
  isSameRect,
} from './spotlightRects'
import { TIMING } from '../../config/gameRules.js'

export function useSpotlightRects({
  stageIdx,
  currentStep,
  currentStepIdx,
  sel,
  steps,
  expr,
  isComplete,
  isPreLawHighlight,
  isAnimating,
}) {
  const [highlightRect, setHighlightRect] = useState(null)
  const [secondaryHighlightRect, setSecondaryHighlightRect] = useState(null)

  const highlightRectRef = useRef(null)
  const secondaryHighlightRectRef = useRef(null)

  // Track bounding rectangle of targeted tutorial elements
  const updateTargetRect = useCallback(() => {
    const hasScoreModal = Boolean(document.querySelector('[data-tutorial="score-modal"]'))

    // The equation cutout remains active from the moment the law is pressed (isPreLawHighlight),
    // throughout the transformation animation (isAnimating), and until the stage complete modal pops up!
    const shouldSpotlightEquation = (isPreLawHighlight || isAnimating) && !hasScoreModal

    if (shouldSpotlightEquation) {
      const eqEl = document.querySelector('[data-tutorial="active-equation"]')
      if (eqEl) {
        const nextHighlight = buildEquationHighlight(eqEl.getBoundingClientRect())

        if (!isSameRect(highlightRectRef.current, nextHighlight)) {
          highlightRectRef.current = nextHighlight
          setHighlightRect(nextHighlight)
        }
        if (secondaryHighlightRectRef.current !== null) {
          secondaryHighlightRectRef.current = null
          setSecondaryHighlightRect(null)
        }
        return
      }
    }

    let effectiveTarget = currentStep?.target
    if (stageIdx === 3 && currentStep?.id === 'challenge-solve' && steps.length > 0) {
      const isAbsorptionDeadEnd = Boolean(steps[steps.length - 1]?.law?.includes('Absorption') && !isComplete)
      if (isAbsorptionDeadEnd) {
        effectiveTarget = '[data-tutorial="undo-reset-group"]'
      }
    }

    if (!currentStep || !effectiveTarget) {
      if (highlightRectRef.current !== null) {
        highlightRectRef.current = null
        setHighlightRect(null)
      }
      if (secondaryHighlightRectRef.current !== null) {
        secondaryHighlightRectRef.current = null
        setSecondaryHighlightRect(null)
      }
      return
    }

    try {
      let el = document.querySelector(effectiveTarget)
      let elRect = el ? el.getBoundingClientRect() : null

      // If the target element has zero dimensions (e.g. step-history-panel inside a closed drawer on mobile)
      if (el && (elRect.width === 0 || elRect.height === 0)) {
        if (effectiveTarget.includes('step-history-panel')) {
          const fallbackEl = document.querySelector('[data-tutorial="step-history-toggle"], [data-testid="step-history-toggle"]')
          if (fallbackEl && fallbackEl.getBoundingClientRect().width > 0) {
            el = fallbackEl
            elRect = fallbackEl.getBoundingClientRect()
            effectiveTarget = '[data-tutorial="step-history-toggle"]'
          } else {
            el = null
            elRect = null
          }
        } else {
          el = null
          elRect = null
        }
      }

      if (el && elRect && elRect.width > 0 && elRect.height > 0) {
        const nextHighlight = buildTargetHighlight(elRect, effectiveTarget)

        if (!isSameRect(highlightRectRef.current, nextHighlight)) {
          highlightRectRef.current = nextHighlight
          setHighlightRect(nextHighlight)
        }
      } else {
        // If the target element is score-modal and hasn't mounted yet, keep highlighting the active-equation rather than flashing/vanishing to null!
        if (currentStep.target?.includes('score-modal')) {
          const eqEl = document.querySelector('[data-tutorial="active-equation"]')
          if (eqEl) {
            const nextHighlight = buildScoreModalFallbackHighlight(eqEl.getBoundingClientRect())
            if (!isSameRect(highlightRectRef.current, nextHighlight)) {
              highlightRectRef.current = nextHighlight
              setHighlightRect(nextHighlight)
            }
            return
          }
        }

        if (highlightRectRef.current !== null) {
          highlightRectRef.current = null
          setHighlightRect(null)
        }
      }

      // Secondary target support (e.g. drop target 'z' during drag-and-drop step)
      if (currentStep.secondaryTarget) {
        const secEl = document.querySelector(currentStep.secondaryTarget)
        if (secEl) {
          const nextSecHighlight = buildSecondaryHighlight(secEl.getBoundingClientRect(), currentStep.secondaryTarget)

          if (!isSameRect(secondaryHighlightRectRef.current, nextSecHighlight)) {
            secondaryHighlightRectRef.current = nextSecHighlight
            setSecondaryHighlightRect(nextSecHighlight)
          }
        } else {
          if (secondaryHighlightRectRef.current !== null) {
            secondaryHighlightRectRef.current = null
            setSecondaryHighlightRect(null)
          }
        }
      } else {
        if (secondaryHighlightRectRef.current !== null) {
          secondaryHighlightRectRef.current = null
          setSecondaryHighlightRect(null)
        }
      }
    } catch {
      if (highlightRectRef.current !== null) {
        highlightRectRef.current = null
        setHighlightRect(null)
      }
      if (secondaryHighlightRectRef.current !== null) {
        secondaryHighlightRectRef.current = null
        setSecondaryHighlightRect(null)
      }
    }
  }, [currentStep, isPreLawHighlight, isAnimating, steps.length])

  useEffect(() => {
    updateTargetRect()
    const handleResize = () => updateTargetRect()
    window.addEventListener('resize', handleResize)
    window.addEventListener('scroll', handleResize, true)
    const intervalId = setInterval(updateTargetRect, TIMING.spotlightRectPollMs)

    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('scroll', handleResize, true)
      clearInterval(intervalId)
    }
  }, [updateTargetRect, sel, steps, expr, currentStepIdx, isPreLawHighlight, isAnimating])

  return { highlightRect, secondaryHighlightRect }
}
