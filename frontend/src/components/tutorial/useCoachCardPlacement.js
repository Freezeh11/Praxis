/**
 * @file useCoachCardPlacement.js
 * @description Owns the coach card's measured placement: its DOM node ref, the
 * post-commit placement pass, and the resize/orientation/scroll/interval reflow.
 */
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import {
  CARD_EDGE_MARGIN,
  CARD_MIN_WIDTH,
  CARD_NATURAL_WIDTH,
  collectCardObstacles,
} from './coachCardGeometry'
import { pickCoachPlacement } from './coachCardPlacement'
import { cutoutRectOf } from './spotlightRects'
import { CARD_ANCHOR_ZONES } from './tutorialTargets'
import { TIMING } from '../../config/gameRules.js'

/** @returns {import('react').RefObject} the coach-card DOM node ref. */
export function useCoachCardPlacement({ currentStep, highlightRect, secondaryHighlightRect }) {
  // ── Coach-card geometry bookkeeping (see pickCoachPlacement) ────────────
  const cardRef = useRef(null)
  /** Natural (unclamped) card size, kept so a shrunk sheet never feeds back. */
  const cardNaturalRef = useRef({ w: CARD_NATURAL_WIDTH, h: 220 })
  /** True while the card is rendered with an applied max-height/width clamp. */
  const cardClampedRef = useRef(false)
  /** Step the measured size belongs to; a new step re-measures from scratch. */
  const cardStepRef = useRef(null)

  /* ── Collision-aware coach-card placement ────────────────────────────────
     Runs after every commit (before paint), on resize/orientation change and
     on a slow interval, because the target moves as the tutorial advances and
     the law transforms re-lay-out the workspace. The result is written
     straight onto the node: the card is positioned by measurement rather than
     by render state, so a placement pass cannot trigger a render loop. */
  const placeCoachCard = useCallback(() => {
    const el = cardRef.current
    if (!el) return
    const vw = window.innerWidth
    const vh = window.innerHeight
    const margin = CARD_EDGE_MARGIN

    // A new step means new copy, so re-measure the natural size from scratch.
    const stepKey = currentStep?.id || 'none'
    if (cardStepRef.current !== stepKey) {
      cardStepRef.current = stepKey
      cardClampedRef.current = false
    }

    const naturalW = Math.min(CARD_NATURAL_WIDTH, Math.max(CARD_MIN_WIDTH, vw - margin * 2))
    if (!cardClampedRef.current) {
      // Measure unclamped: a previously applied max-height must not become
      // the "natural" height on the next pass.
      el.style.maxHeight = 'none'
      el.style.right = 'auto'
      el.style.width = `${naturalW}px`
      cardNaturalRef.current = { w: naturalW, h: el.offsetHeight || cardNaturalRef.current.h }
    }
    const naturalH = cardNaturalRef.current.h || 220

    // (a) the element this step highlights, (b) every other control the
    // learner may need. Both are forbidden: the card must never cover a box
    // the learner has to read or press.
    const targets = []
    if (highlightRect) targets.push(cutoutRectOf(highlightRect))
    if (secondaryHighlightRect) targets.push(cutoutRectOf(secondaryHighlightRect))
    const obstacles = [...targets, ...collectCardObstacles(el)]

    // Declared placement: explicit pixel coordinates first, then the named
    // anchor zones, then the step's simple side hint.
    let declaredRect = null
    const declared = currentStep?.position
    if (currentStep && typeof declared === 'object' && declared !== null) {
      const x = typeof declared.left === 'number' ? declared.left
        : typeof declared.right === 'number' ? vw - declared.right - naturalW
          : (vw - naturalW) / 2
      const y = typeof declared.top === 'number' ? declared.top
        : typeof declared.bottom === 'number' ? vh - declared.bottom - naturalH
          : (vh - naturalH) / 2
      declaredRect = { x, y, w: naturalW, h: naturalH }
    }
    const preferred = []
    const zone = CARD_ANCHOR_ZONES[declared] || CARD_ANCHOR_ZONES[currentStep?.tooltipPosition]
    if (zone) preferred.push(zone)

    const placement = pickCoachPlacement({
      naturalW, naturalH, targets, obstacles, vw, vh, preferred, declaredRect,
    })
    const rect = placement.rect
    // The card is always capped to the rectangle the engine reserved for it:
    // the measured "natural" height only holds at the natural width (a narrow
    // card wraps taller) and a stale measurement must never push the card off
    // screen or back over a box.
    const maxHeight = Math.max(120, Math.round(Math.min(rect.h, vh - margin - rect.y)))

    // Written unconditionally: React may rewrite the declarative style on any
    // render, and re-applying identical values is a no-op for layout.
    el.style.left = `${Math.round(rect.x)}px`
    el.style.top = `${Math.round(rect.y)}px`
    el.style.right = 'auto'
    el.style.bottom = 'auto'
    el.style.width = `${Math.round(rect.w)}px`
    el.style.maxWidth = 'none'
    el.style.maxHeight = `${maxHeight}px`
    el.style.overflowY = 'auto'
    el.style.padding = rect.w < 200 ? '12px' : ''
    // A clamped card must not feed its clamped size back into the measuring.
    cardClampedRef.current = maxHeight < naturalH - 1 || rect.w < naturalW - 1
  }, [currentStep, highlightRect, secondaryHighlightRect])

  // Re-place after EVERY commit (the card unmounts/remounts between steps),
  // then keep watching: resize/orientation and the interval catch everything
  // that moves the target without a React render.
  useLayoutEffect(() => {
    placeCoachCard()
  })

  const placeCoachCardRef = useRef(placeCoachCard)
  useEffect(() => {
    placeCoachCardRef.current = placeCoachCard
  })

  useEffect(() => {
    const reflow = () => placeCoachCardRef.current()
    // A resize/orientation change invalidates the cached natural size too.
    const remeasure = () => {
      cardStepRef.current = null
      placeCoachCardRef.current()
    }
    window.addEventListener('resize', remeasure)
    window.addEventListener('orientationchange', remeasure)
    window.addEventListener('scroll', reflow, true)
    const intervalId = setInterval(reflow, TIMING.coachCardReflowMs)
    return () => {
      window.removeEventListener('resize', remeasure)
      window.removeEventListener('orientationchange', remeasure)
      window.removeEventListener('scroll', reflow, true)
      clearInterval(intervalId)
    }
  }, [])

  return cardRef
}
