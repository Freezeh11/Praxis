/**
 * @file InteractiveTutorial.jsx
 * @description Redesigned Interactive Tutorial Component for Praxis.
 * Features a deep dark backdrop, seamless modal cross-fade, cinematic fade reveal,
 * and adaptive floating coach cards.
 */

import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { WELCOME_SLIDES, TUTORIAL_STAGES } from '../lib/tutorialData'
import logoFull from '../assets/logo-full.png'

/* ══════════════════════════════════════════════════════════════════════════
   COLLISION-AWARE COACH-CARD PLACEMENT
   ══════════════════════════════════════════════════════════════════════════
   A card pinned to a fixed corner will eventually sit on top of the very box
   it points at — worst of all on a landscape phone, where a 330px card floats
   in a 390px-tall workspace. Instead the card now measures the highlighted
   target, measures itself, collects every control the learner may need, and
   walks candidate placements in this order:

     1. the declared side of the target (bottom / top / right / left), then
        the other sides, at natural size;
     2. a free-space scan that snaps the card into every gap the controls
        leave behind (closest to the target first);
     3. the same sides with the card shrunk (max-height) to the free span;
     4. a full-width sheet inside the largest free horizontal band — the
        bottom-sheet fallback, but sized so the target stays visible;
     5. the viewport centre, as the last resort.

   The first candidate that intersects nothing wins. If none exists, the
   least-bad one is used, but the highlighted target is weighted so heavily
   that it is only ever covered when there is physically nowhere else to go.
   The placement is recomputed on every commit, on resize/orientation change
   and on a slow interval (the target moves as the tutorial advances).
   ══════════════════════════════════════════════════════════════════════════ */

/** Viewport margin kept free around the coach card. */
const CARD_EDGE_MARGIN = 12
/** Breathing room kept between the card and every box it must not cover. */
const CARD_OBSTACLE_GAP = 10
/** Below this height the card stops being readable, so avoidance is relaxed. */
const CARD_USABLE_HEIGHT = 118
/** Narrowest card still readable. Cards must never crush text into unreadable slivers. */
const CARD_MIN_WIDTH = 180
/** Natural card width (mirrors the `w-[330px]` class). */
const CARD_NATURAL_WIDTH = 330

/** Every control the learner may need while a tutorial step is on screen. */
const CARD_OBSTACLE_SELECTOR = [
  '[data-tutorial="canvas"] [data-path]',
  '[data-tutorial="not-capsule"]',
  '[data-tutorial^="law-card-"]',
  '[data-tutorial^="step-history-card-"]',
  '[data-tutorial="hint-button"]',
  '[data-tutorial="guide-button"]',
  '[data-tutorial="laws-reference-button"]',
  '[data-tutorial="undo-button"]',
  '[data-tutorial="reset-button"]',
  '[data-tutorial="reopen-score-btn"]',
  '[data-tutorial="next-stage-btn"]',
  '[data-tutorial="review-derivation-btn"]',
  '[data-tutorial="assistance-group"]',
  '[data-tutorial="points-and-assistance"]',
  '[data-tutorial="undo-reset-group"]',
  '[data-tutorial="new-expression-next-btn"]',
  '[data-tutorial="randomize-next-btn"]',
  '[data-tutorial="score-modal"] button',
  'button[title*="grip" i]',
].join(',')

/** Declared anchor zones → the side of the target the card should prefer. */
const CARD_ANCHOR_ZONES = {
  'workspace-bottom-left': { side: 'bottom', align: 'start' },
  'bottom-left': { side: 'bottom', align: 'start' },
  'workspace-top-left': { side: 'top', align: 'start' },
  'top-left': { side: 'top', align: 'start' },
  'workspace-top-right': { side: 'top', align: 'end' },
  'top-right': { side: 'top', align: 'end' },
  'workspace-bottom-right': { side: 'bottom', align: 'end' },
  'bottom-right': { side: 'bottom', align: 'end' },
}

const rectsOverlap = (a, b) => !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y)

const rectOverlapArea = (a, b) => {
  if (!rectsOverlap(a, b)) return 0
  return (Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
         (Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
}

const unionRect = (a, b) => {
  if (!a) return b
  if (!b) return a
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y }
}

/** Highlight bookkeeping keeps both `top/left` and `cutoutTop/cutoutLeft`. */
const cutoutRectOf = (r) => ({
  x: r.cutoutLeft ?? r.left,
  y: r.cutoutTop ?? r.top,
  w: r.cutoutWidth ?? r.width,
  h: r.cutoutHeight ?? r.height,
})

const clampToViewport = (rect, vw, vh, margin = CARD_EDGE_MARGIN) => {
  const w = Math.min(rect.w, Math.max(0, vw - margin * 2))
  const h = Math.min(rect.h, Math.max(0, vh - margin * 2))
  return {
    w,
    h,
    x: Math.min(Math.max(rect.x, margin), Math.max(margin, vw - margin - w)),
    y: Math.min(Math.max(rect.y, margin), Math.max(margin, vh - margin - h)),
  }
}

/** Collects the on-screen, non-card controls the coach card must dodge. */
const collectCardObstacles = (cardEl) => {
  const out = []
  const vw = window.innerWidth
  const vh = window.innerHeight

  for (const el of document.querySelectorAll(CARD_OBSTACLE_SELECTOR)) {
    if (cardEl && cardEl.contains(el)) continue
    const r = el.getBoundingClientRect()
    if (r.width < 2 || r.height < 2) continue
    if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue
    out.push({ x: r.left, y: r.top, w: r.width, h: r.height })
  }
  return out
}

/** Places a `w × h` card on one side of `box`, aligned on the cross axis. */
const cardSideRect = (side, align, box, w, h) => {
  const gap = CARD_OBSTACLE_GAP
  if (side === 'bottom' || side === 'top') {
    const x = align === 'start' ? box.x : align === 'end' ? box.x + box.w - w : box.x + box.w / 2 - w / 2
    const y = side === 'bottom' ? box.y + box.h + gap : box.y - gap - h
    return { x, y, w, h }
  }
  const y = align === 'start' ? box.y : align === 'end' ? box.y + box.h - h : box.y + box.h / 2 - h / 2
  const x = side === 'right' ? box.x + box.w + gap : box.x - gap - w
  return { x, y, w, h }
}

/**
 * Distance available from `from` along `axis` (+1 = down/right, -1 = up/left)
 * before the first obstacle that overlaps the card's cross-axis span.
 */
const cardFreeExtent = (obstacles, axis, dir, crossStart, crossSize, from) => {
  const gap = CARD_OBSTACLE_GAP
  let limit = dir > 0 ? Infinity : -Infinity
  for (const o of obstacles) {
    const crossPos = axis === 'y' ? o.x : o.y
    const crossSize2 = axis === 'y' ? o.w : o.h
    if (crossPos + crossSize2 <= crossStart + 1 || crossPos >= crossStart + crossSize - 1) continue
    const start = axis === 'y' ? o.y : o.x
    const end = start + (axis === 'y' ? o.h : o.w)
    if (dir > 0) {
      if (end <= from) continue
      // The anchor itself may sit inside a partially overlapping box: then
      // there is no free space at all in this direction.
      if (start >= from) limit = Math.min(limit, start - gap)
      else limit = Math.min(limit, from)
    } else {
      if (start >= from) continue
      if (end <= from) limit = Math.max(limit, end + gap)
      else limit = Math.max(limit, from)
    }
  }
  return dir > 0 ? Math.max(0, limit - from) : Math.max(0, from - limit)
}

/**
 * Bands of the viewport along `axis` that no obstacle occupies, with the
 * obstacle gap already subtracted at both ends.
 */
const cardFreeBands = (obstacles, extent, axis = 'y') => {
  const margin = CARD_EDGE_MARGIN
  const gap = CARD_OBSTACLE_GAP
  const spans = obstacles
    .map(o => {
      const start = axis === 'y' ? o.y : o.x
      const size = axis === 'y' ? o.h : o.w
      return [Math.max(margin, start - gap), Math.min(extent - margin, start + size + gap)]
    })
    .filter(([a, b]) => b > a)
    .sort((a, b) => a[0] - b[0])
  const bands = []
  let cursor = margin
  for (const [a, b] of spans) {
    if (a > cursor) bands.push({ from: cursor, to: a })
    cursor = Math.max(cursor, b)
  }
  if (cursor < extent - margin) bands.push({ from: cursor, to: extent - margin })
  return bands.filter(b => b.to - b.from > 0)
}

/**
 * Picks the coach-card rectangle (and optional max-height) that covers as few
 * targets/controls as possible. Pure: everything it needs is passed in.
 */
function pickCoachPlacement({ naturalW, naturalH, targets, obstacles: allObstacles, vw, vh, preferred, declaredRect }) {
  const margin = CARD_EDGE_MARGIN
  const gap = CARD_OBSTACLE_GAP
  // Every visible control (buttons, law cards, canvas literals, grips, step
  // history, header panels) is forbidden, exactly like the highlighted target.
  const obstacles = allObstacles
  const box = targets.reduce((acc, r) => unionRect(acc, r), null)
  const anchor = box || { x: (vw - naturalW) / 2, y: (vh - naturalH) / 2, w: naturalW, h: naturalH }

  const blockedArea = (rect) => obstacles.reduce((sum, r) => sum + rectOverlapArea(rect, r), 0)
  const scoreOf = blockedArea

  const sideOrder = []
  for (const p of preferred || []) {
    if (!sideOrder.some(s => s.side === p.side && s.align === p.align)) sideOrder.push(p)
  }
  for (const side of ['bottom', 'top', 'right', 'left']) {
    for (const align of ['center', 'start', 'end']) {
      if (!sideOrder.some(s => s.side === side && s.align === align)) sideOrder.push({ side, align })
    }
  }

  // 1. Natural size, anchored to the target (the step's own declared
  //    coordinates, when it has any, are tried before anything else).
  const sidesFull = []
  if (declaredRect) sidesFull.push({ rect: clampToViewport(declaredRect, vw, vh) })
  if (box) {
    for (const { side, align } of sideOrder) {
      sidesFull.push({ rect: clampToViewport(cardSideRect(side, align, box, naturalW, naturalH), vw, vh) })
    }
  }

  // 2. Free-space scan: snap to every gap edge the obstacles leave behind,
  //    closest to the target first, so the card lands in genuinely free space.
  //    Width and height are derived from the free span AT that anchor, so the
  //    card can narrow into a gutter (the only free space beside a phone's
  //    score modal) instead of giving up and covering the target.
  const distToAnchor = (rect) => Math.hypot(
    rect.x + rect.w / 2 - (anchor.x + anchor.w / 2),
    rect.y + rect.h / 2 - (anchor.y + anchor.h / 2),
  )
  const xs = new Set([margin, vw - margin - naturalW, anchor.x + anchor.w / 2 - naturalW / 2])
  const ys = new Set([margin, vh - margin - naturalH, anchor.y + anchor.h / 2 - naturalH / 2])
  for (const o of obstacles) {
    xs.add(Math.round(o.x + o.w + gap))
    xs.add(Math.round(o.x - gap - naturalW))
    ys.add(Math.round(o.y + o.h + gap))
    ys.add(Math.round(o.y - gap - naturalH))
  }
  const scan = []
  const maxX = Math.max(margin, vw - margin - CARD_MIN_WIDTH)
  const maxY = Math.max(margin, vh - margin - 64)
  for (const x of xs) {
    for (const y of ys) {
      // Anchor inside the margin box, then size the card to the space that is
      // ACTUALLY free from there — never clamp it back over an obstacle.
      const cx = Math.min(Math.max(x, margin), maxX)
      const cy = Math.min(Math.max(y, margin), maxY)
      const w = Math.min(
        naturalW,
        cardFreeExtent(obstacles, 'x', 1, cy, Math.min(naturalH, vh - margin - cy), cx),
        vw - margin - cx,
      )
      if (w < CARD_MIN_WIDTH) continue
      const h = Math.min(naturalH, cardFreeExtent(obstacles, 'y', 1, cx, w, cy), vh - margin - cy)
      if (h < 64) continue
      scan.push({ rect: clampToViewport({ x: cx, y: cy, w, h }, vw, vh), maxHeight: Math.round(h) })
    }
  }
  scan.sort((a, b) => distToAnchor(a.rect) - distToAnchor(b.rect))

  // 3. Natural width, height shrunk to the free span on that side.
  const sidesFitted = []
  if (box) {
    for (const { side, align } of sideOrder) {
      const seed = clampToViewport(cardSideRect(side, align, box, naturalW, naturalH), vw, vh)
      let w = naturalW
      let h = naturalH
      if (side === 'bottom') h = cardFreeExtent(obstacles, 'y', 1, seed.x, seed.w, box.y + box.h + gap)
      else if (side === 'top') h = cardFreeExtent(obstacles, 'y', -1, seed.x, seed.w, box.y - gap)
      else if (side === 'right') w = cardFreeExtent(obstacles, 'x', 1, seed.y, seed.h, box.x + box.w + gap)
      else w = cardFreeExtent(obstacles, 'x', -1, seed.y, seed.h, box.x - gap)
      w = Math.min(w, vw - margin * 2)
      h = Math.min(h, vh - margin * 2)
      if (w < CARD_MIN_WIDTH || h < 72) continue
      if (w >= naturalW - 1 && h >= naturalH - 1) continue
      sidesFitted.push({
        rect: clampToViewport(cardSideRect(side, align, box, w, h), vw, vh),
        maxHeight: Math.round(h),
      })
    }
  }

  // 4. Full-width sheet inside the largest free horizontal band: the
  //    bottom-sheet fallback, clipped so it never reaches the target.
  const sheetBands = [...cardFreeBands(obstacles, vh)].sort((a, b) => {
    const aBottom = a.to >= vh - margin - 1 ? 1 : 0
    const bBottom = b.to >= vh - margin - 1 ? 1 : 0
    if (aBottom !== bBottom) return bBottom - aBottom
    return (b.to - b.from) - (a.to - a.from)
  })
  const sheets = sheetBands.slice(0, 2).map(band => {
    const bandHeight = band.to - band.from
    return {
      rect: { x: margin, y: band.from, w: vw - margin * 2, h: Math.min(naturalH, bandHeight) },
      maxHeight: Math.round(bandHeight),
    }
  })

  // 5. Narrow free columns (a full-height gutter beside a big target such as
  //    the score modal): the card goes there rather than on top of the target.
  const columns = []
  for (const band of cardFreeBands(obstacles, vw, 'x')) {
    const w = Math.min(naturalW, band.to - band.from)
    if (w < CARD_MIN_WIDTH) continue
    for (const y of [margin, vh - margin - naturalH, anchor.y, anchor.y + anchor.h + gap]) {
      const avail = cardFreeExtent(obstacles, 'y', 1, band.from, w, y)
      const h = Math.min(naturalH, avail)
      if (h < 64) continue
      columns.push({
        rect: clampToViewport({ x: band.from, y, w, h }, vw, vh),
        maxHeight: Math.round(h),
      })
    }
  }

  const groups = [sidesFull, scan, sheets, columns, sidesFitted]
  const usable = (rect) => rect.h >= Math.min(naturalH, CARD_USABLE_HEIGHT) - 1
  const readable = (rect) => rect.h >= Math.min(naturalH, 64)

  // Pass A: the first placement that covers nothing and stays readable.
  for (const group of groups) {
    for (const c of group) {
      if (!usable(c.rect)) continue
      if (scoreOf(c.rect) === 0) return c
    }
  }
  // Pass B: the same, for a card shrunk to a narrow strip.
  for (const group of groups) {
    for (const c of group) {
      if (!readable(c.rect)) continue
      if (scoreOf(c.rect) === 0) return c
    }
  }
  // Pass E: least-bad rectangle — only reachable when the viewport cannot fit
  // the card anywhere without covering a box.
  let best = null
  for (const group of groups) {
    for (const c of group) {
      const score = scoreOf(c.rect)
      if (!best || score < best.score) best = { ...c, score }
    }
  }
  return best || { rect: clampToViewport({ x: anchor.x, y: anchor.y, w: naturalW, h: naturalH }, vw, vh) }
}

/**
 * @param {Object} props
 * @param {number} props.stageIdx - Current stage index (0, 1, 2)
 * @param {Array} props.sel - Selected paths in expression
 * @param {Array} props.steps - Derivation steps history
 * @param {Object} props.expr - Current expression AST
 * @param {Array} props.applicableLaws - Currently applicable Boolean laws
 * @param {boolean} props.isComplete - Whether stage is solved
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
  const stepsForStage = useMemo(() => TUTORIAL_STAGES[stageIdx] || [], [stageIdx])
  const [currentStepIdx, setCurrentStepIdx] = useState(0)
  
  // Show the welcome modal exclusively on Stage 0 (first load)
  const [showWelcomeModal, setShowWelcomeModal] = useState(() => stageIdx === 0)
  const [currentSlideIdx, setCurrentSlideIdx] = useState(0)
  const [highlightRect, setHighlightRect] = useState(null)
  const [secondaryHighlightRect, setSecondaryHighlightRect] = useState(null)

  // ── Coach-card geometry bookkeeping (see pickCoachPlacement) ────────────
  const cardRef = useRef(null)
  /** Natural (unclamped) card size, kept so a shrunk sheet never feeds back. */
  const cardNaturalRef = useRef({ w: CARD_NATURAL_WIDTH, h: 220 })
  /** True while the card is rendered with an applied max-height/width clamp. */
  const cardClampedRef = useRef(false)
  /** Step the measured size belongs to; a new step re-measures from scratch. */
  const cardStepRef = useRef(null)

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

  const highlightRectRef = useRef(null)
  const secondaryHighlightRectRef = useRef(null)

  const isSameRect = (a, b) => {
    if (!a && !b) return true
    if (!a || !b) return false
    return Math.abs((a.cutoutTop ?? a.top) - (b.cutoutTop ?? b.top)) < 0.5 &&
           Math.abs((a.cutoutLeft ?? a.left) - (b.cutoutLeft ?? b.left)) < 0.5 &&
           Math.abs((a.cutoutWidth ?? a.width) - (b.cutoutWidth ?? b.width)) < 0.5 &&
           Math.abs((a.cutoutHeight ?? a.height) - (b.cutoutHeight ?? b.height)) < 0.5 &&
           a.isScoreModal === b.isScoreModal
  }

  // Track bounding rectangle of targeted tutorial elements
  const updateTargetRect = useCallback(() => {
    const hasScoreModal = Boolean(document.querySelector('[data-tutorial="score-modal"]'))

    // The equation cutout remains active from the moment the law is pressed (isPreLawHighlight),
    // throughout the transformation animation (isAnimating), and until the stage complete modal pops up!
    const shouldSpotlightEquation = (isPreLawHighlight || isAnimating) && !hasScoreModal

    if (shouldSpotlightEquation) {
      const eqEl = document.querySelector('[data-tutorial="active-equation"]')
      if (eqEl) {
        const rect = eqEl.getBoundingClientRect()
        const ringPadSide = 12
        const ringPadTop = 8
        const ringRx = 14
        const cutoutPadSide = 24
        const cutoutPadTop = 16
        const cutoutRx = 20

        const nextHighlight = {
          ringTop: Math.max(0, rect.top - ringPadTop),
          ringLeft: Math.max(0, rect.left - ringPadSide),
          ringWidth: rect.width + ringPadSide * 2,
          ringHeight: rect.height + ringPadTop * 2,
          ringRx,

          cutoutTop: Math.max(0, rect.top - cutoutPadTop),
          cutoutLeft: Math.max(0, rect.left - cutoutPadSide),
          cutoutWidth: rect.width + cutoutPadSide * 2,
          cutoutHeight: rect.height + cutoutPadTop * 2,
          cutoutRx,

          top: Math.max(0, rect.top - cutoutPadTop),
          left: Math.max(0, rect.left - cutoutPadSide),
          width: rect.width + cutoutPadSide * 2,
          height: rect.height + cutoutPadTop * 2,
          rx: cutoutRx,
          isScoreModal: false,
        }

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
      const el = document.querySelector(effectiveTarget)
      if (el) {
        const rect = el.getBoundingClientRect()
        const isVar = effectiveTarget.includes('data-path')
        const isTerm = effectiveTarget.includes('term-') || effectiveTarget.includes('not-capsule')
        const isScoreModal = effectiveTarget.includes('score-modal') || effectiveTarget.includes('review-derivation-btn')
        
        // Snug teal highlight box padding
        const ringPadTop = isVar ? 2 : isTerm ? 4 : isScoreModal ? 4 : 6
        const ringPadBottom = isVar ? 2 : isScoreModal ? 4 : 6
        const ringPadSide = isVar ? 3 : isTerm ? 6 : isScoreModal ? 4 : 8
        const ringRx = isVar ? 6 : isScoreModal ? 24 : 10

        // Spacious, soft curved dark backdrop cutout padding
        const cutoutPadTop = isVar ? 4 : isTerm ? 18 : isScoreModal ? 10 : 12
        const cutoutPadBottom = isVar ? 4 : isTerm ? 18 : isScoreModal ? 10 : 12
        const cutoutPadSide = isVar ? 5 : isTerm ? 24 : isScoreModal ? 10 : 16
        const cutoutRx = isVar ? 8 : isScoreModal ? 28 : 22

        const nextHighlight = {
          // Snug teal ring coordinates
          ringTop: Math.max(0, rect.top - ringPadTop),
          ringLeft: Math.max(0, rect.left - ringPadSide),
          ringWidth: rect.width + ringPadSide * 2,
          ringHeight: rect.height + ringPadTop + ringPadBottom,
          ringRx,

          // Spacious soft-curved backdrop cutout coordinates
          cutoutTop: Math.max(0, rect.top - cutoutPadTop),
          cutoutLeft: Math.max(0, rect.left - cutoutPadSide),
          cutoutWidth: rect.width + cutoutPadSide * 2,
          cutoutHeight: rect.height + cutoutPadTop + cutoutPadBottom,
          cutoutRx,

          // Standard bounds
          top: Math.max(0, rect.top - cutoutPadTop),
          left: Math.max(0, rect.left - cutoutPadSide),
          width: rect.width + cutoutPadSide * 2,
          height: rect.height + cutoutPadTop + cutoutPadBottom,
          rx: cutoutRx,
          isScoreModal,
        }

        if (!isSameRect(highlightRectRef.current, nextHighlight)) {
          highlightRectRef.current = nextHighlight
          setHighlightRect(nextHighlight)
        }
      } else {
        // If the target element is score-modal and hasn't mounted yet, keep highlighting the active-equation rather than flashing/vanishing to null!
        if (currentStep.target?.includes('score-modal')) {
          const eqEl = document.querySelector('[data-tutorial="active-equation"]')
          if (eqEl) {
            const rect = eqEl.getBoundingClientRect()
            const nextHighlight = {
              ringTop: Math.max(0, rect.top - 8),
              ringLeft: Math.max(0, rect.left - 12),
              ringWidth: rect.width + 24,
              ringHeight: rect.height + 16,
              ringRx: 14,
              cutoutTop: Math.max(0, rect.top - 16),
              cutoutLeft: Math.max(0, rect.left - 24),
              cutoutWidth: rect.width + 48,
              cutoutHeight: rect.height + 32,
              cutoutRx: 20,
              top: Math.max(0, rect.top - 16),
              left: Math.max(0, rect.left - 24),
              width: rect.width + 48,
              height: rect.height + 32,
              rx: 20,
              isScoreModal: false,
            }
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
          const secRect = secEl.getBoundingClientRect()
          const isSecVar = currentStep.secondaryTarget.includes('data-path')
          const isSecTerm = currentStep.secondaryTarget.includes('term-') || currentStep.secondaryTarget.includes('not-capsule')
          
          const ringPadTop = isSecVar ? 2 : isSecTerm ? 4 : 6
          const ringPadBottom = isSecVar ? 2 : 6
          const ringPadSide = isSecVar ? 3 : isSecTerm ? 6 : 8
          const ringRx = isSecVar ? 6 : 10

          const cutoutPadTop = isSecVar ? 4 : isSecTerm ? 18 : 12
          const cutoutPadBottom = isSecVar ? 4 : isSecTerm ? 18 : 12
          const cutoutPadSide = isSecVar ? 5 : isSecTerm ? 24 : 16
          const cutoutRx = isSecVar ? 8 : 22

          const nextSecHighlight = {
            ringTop: Math.max(0, secRect.top - ringPadTop),
            ringLeft: Math.max(0, secRect.left - ringPadSide),
            ringWidth: secRect.width + ringPadSide * 2,
            ringHeight: secRect.height + ringPadTop + ringPadBottom,
            ringRx,

            cutoutTop: Math.max(0, secRect.top - cutoutPadTop),
            cutoutLeft: Math.max(0, secRect.left - cutoutPadSide),
            cutoutWidth: secRect.width + cutoutPadSide * 2,
            cutoutHeight: secRect.height + cutoutPadTop + cutoutPadBottom,
            cutoutRx,

            top: Math.max(0, secRect.top - cutoutPadTop),
            left: Math.max(0, secRect.left - cutoutPadSide),
            width: secRect.width + cutoutPadSide * 2,
            height: secRect.height + cutoutPadTop + cutoutPadBottom,
            rx: cutoutRx,
          }

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
    const intervalId = setInterval(updateTargetRect, 200)

    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('scroll', handleResize, true)
      clearInterval(intervalId)
    }
  }, [updateTargetRect, sel, steps, expr, currentStepIdx, isPreLawHighlight, isAnimating])

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

  // Pre-measurement fallback styling. `placeCoachCard` below overwrites this
  // with the collision-aware placement before the first paint; this keeps the
  // card sane for the single frame before any measurement exists.
  const getTooltipStyle = () => {
    const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1024
    const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 768
    const cardWidth = 330
    const margin = 14

    // Landscape phones are ~320-400px tall. A 330px floating card anchored next
    // to a spotlight cannot fit there: it either overflowed the bottom edge or
    // sat on top of the very control it pointed at. On those screens the coach
    // becomes a bottom sheet that spans the width and scrolls internally, with
    // its step header and action row sticky, so nothing can trap the learner.
    if (screenHeight <= 480) {
      return {
        left: '0.75rem',
        right: '0.75rem',
        bottom: '0.75rem',
        top: 'auto',
        width: 'auto',
        maxWidth: 'none',
      }
    }

    if (!currentStep) {
      return {
        top: `${Math.max(20, (screenHeight - 240) / 2)}px`,
        left: `${Math.max(20, (screenWidth - cardWidth) / 2)}px`,
        right: 'auto',
        bottom: 'auto',
      }
    }

    // 1. Direct explicit coordinate placement: e.g. { left: 240, bottom: 120 } or { top: 100, right: 40 }
    if (typeof currentStep.position === 'object' && currentStep.position !== null) {
      const { top, bottom, left, right } = currentStep.position
      return {
        top: top !== undefined ? (typeof top === 'number' ? `${top}px` : top) : 'auto',
        bottom: bottom !== undefined ? (typeof bottom === 'number' ? `${bottom}px` : bottom) : 'auto',
        left: left !== undefined ? (typeof left === 'number' ? `${left}px` : left) : 'auto',
        right: right !== undefined ? (typeof right === 'number' ? `${right}px` : right) : 'auto',
      }
    }

    const pos = currentStep.tooltipPosition || currentStep.position || 'bottom'

    // 2. Named Workspace Anchor Zones
    switch (pos) {
      case 'workspace-bottom-left':
      case 'bottom-left':
        return {
          bottom: '154px',
          left: 'max(24px, calc(260px + 24px))',
          top: 'auto',
          right: 'auto',
        }
      case 'workspace-top-left':
      case 'top-left':
        return {
          top: '84px',
          left: 'max(24px, calc(160px + 32px))',
          bottom: 'auto',
          right: 'auto',
        }
      case 'workspace-top-right':
      case 'top-right':
        return {
          top: '84px',
          right: 'max(24px, calc(280px + 24px))',
          bottom: 'auto',
          left: 'auto',
        }
      case 'workspace-bottom-right':
      case 'bottom-right':
        return {
          bottom: '120px',
          right: 'max(24px, calc(280px + 24px))',
          top: 'auto',
          left: 'auto',
        }
      case 'workspace-center':
      case 'center':
        return {
          top: `${Math.max(20, (screenHeight - 240) / 2)}px`,
          left: `${Math.max(20, (screenWidth - cardWidth) / 2)}px`,
          bottom: 'auto',
          right: 'auto',
        }
      default:
        break
    }

    // 3. Fallback to Target-Relative Bounding Box Math if target exists
    if (!highlightRect) {
      return {
        top: `${Math.max(20, (screenHeight - 240) / 2)}px`,
        left: `${Math.max(20, (screenWidth - cardWidth) / 2)}px`,
        bottom: 'auto',
        right: 'auto',
      }
    }

    // Score Modal special anchoring (side-by-side or bottom)
    if (highlightRect.isScoreModal) {
      const rightAvailable = screenWidth - (highlightRect.left + highlightRect.width)
      if (rightAvailable >= 350) {
        return {
          top: `${Math.max(40, highlightRect.top + 20)}px`,
          left: `${highlightRect.left + highlightRect.width + 20}px`,
          bottom: 'auto',
          right: 'auto',
        }
      }
      const leftAvailable = highlightRect.left
      if (leftAvailable >= 350) {
        return {
          top: `${Math.max(40, highlightRect.top + 20)}px`,
          left: `${Math.max(20, highlightRect.left - cardWidth - 20)}px`,
          bottom: 'auto',
          right: 'auto',
        }
      }
      return {
        bottom: '24px',
        left: `${Math.max(20, (screenWidth - cardWidth) / 2)}px`,
        top: 'auto',
        right: 'auto',
      }
    }

    if (pos === 'top') {
      const targetCenterX = highlightRect.left + highlightRect.width / 2
      const left = Math.max(20, Math.min(screenWidth - cardWidth - 20, targetCenterX - cardWidth / 2))
      const bottom = Math.max(20, Math.min(screenHeight - 220, screenHeight - highlightRect.top + margin))
      return {
        bottom: `${bottom}px`,
        left: `${left}px`,
        top: 'auto',
        right: 'auto',
      }
    }

    if (pos === 'bottom') {
      const targetCenterX = highlightRect.left + highlightRect.width / 2
      const left = Math.max(20, Math.min(screenWidth - cardWidth - 20, targetCenterX - cardWidth / 2))
      const top = Math.max(20, Math.min(screenHeight - 240, highlightRect.top + highlightRect.height + margin))
      return {
        top: `${top}px`,
        left: `${left}px`,
        bottom: 'auto',
        right: 'auto',
      }
    }

    if (pos === 'left') {
      const right = Math.max(20, screenWidth - highlightRect.left + margin)
      const targetCenterY = highlightRect.top + highlightRect.height / 2
      const top = Math.max(20, Math.min(screenHeight - 240, targetCenterY - 100))
      return {
        right: `${right}px`,
        top: `${top}px`,
        left: 'auto',
        bottom: 'auto',
      }
    }

    if (pos === 'right') {
      const left = Math.max(20, highlightRect.left + highlightRect.width + margin)
      const targetCenterY = highlightRect.top + highlightRect.height / 2
      const top = Math.max(20, Math.min(screenHeight - 240, targetCenterY - 100))
      return {
        left: `${left}px`,
        top: `${top}px`,
        right: 'auto',
        bottom: 'auto',
      }
    }

    return {
      top: `${Math.max(20, (screenHeight - 240) / 2)}px`,
      left: `${Math.max(20, (screenWidth - cardWidth) / 2)}px`,
      bottom: 'auto',
      right: 'auto',
    }
  }

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
    const intervalId = setInterval(reflow, 320)
    return () => {
      window.removeEventListener('resize', remeasure)
      window.removeEventListener('orientationchange', remeasure)
      window.removeEventListener('scroll', reflow, true)
      clearInterval(intervalId)
    }
  }, [])

  const activeSlide = WELCOME_SLIDES[currentSlideIdx] || WELCOME_SLIDES[0]

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* ── 1. CINEMATIC WELCOME MODAL WITH FAST GPU-ACCELERATED TRANSITIONS ── */}
      <AnimatePresence>
        {showWelcomeModal && (
          <motion.div
            key="welcome-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 pointer-events-auto will-change-[opacity]"
          >
            <motion.div
              layout
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              initial={{ opacity: 0, scale: 0.97, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: -6 }}
              className="praxis-modal-panel bg-white rounded-3xl pt-10 pb-9 [@media(max-height:480px)]:pt-14 [@media(max-height:480px)]:pb-3 px-5 sm:px-12 max-w-[500px] w-full shadow-2xl border border-border/80 flex flex-col relative overflow-hidden will-change-transform"
            >
              {/* Top Header: Floating Minimalist Skip Button */}
              <button
                type="button"
                onClick={() => {
                  setShowWelcomeModal(false)
                  onResetStage?.()
                }}
                className="absolute top-6 right-6 [@media(max-height:480px)]:top-2 [@media(max-height:480px)]:right-2 min-h-11 px-2.5 py-1 inline-flex items-center rounded-lg text-xs font-semibold text-text-3 hover:text-text-1 hover:bg-slate-100 transition-colors"
              >
                Skip ✕
              </button>

              {/* Dynamic Slide Content */}
              <div className="min-h-[250px] [@media(max-height:480px)]:min-h-0 flex flex-col justify-center items-center mt-3 [@media(max-height:480px)]:mt-0">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentSlideIdx}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className="flex flex-col items-center text-center w-full"
                  >
                    {currentSlideIdx === 0 ? (
                      <>
                        {/* Slide 1: Welcome to Praxis */}
                        <div className="flex flex-col items-center mb-7 [@media(max-height:480px)]:mb-3">
                          <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-text-3 mb-3">
                            Welcome to
                          </span>
                          <img src={logoFull} alt="Praxis" className="h-8 object-contain select-none" />
                        </div>

                        <p className="text-[13.5px] text-text-2 leading-[1.75] max-w-[400px] mb-6 [@media(max-height:480px)]:mb-3">
                          {activeSlide.body}
                        </p>

                        <p className="text-[14px] font-semibold text-text-1">
                          {activeSlide.footer}
                        </p>
                      </>
                    ) : (
                      <>
                        {/* Slide 2: Interactive Fundamentals */}
                        <div className="flex flex-col items-center mb-7 [@media(max-height:480px)]:mb-3">
                          <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-text-3 mb-3">
                            Core Mechanics
                          </span>
                          <h2 className="text-[22px] font-extrabold text-text-1 tracking-tight">
                            {activeSlide.title}
                          </h2>
                        </div>

                        <p className="text-[13.5px] text-text-2 leading-[1.75] max-w-[400px] mb-6 [@media(max-height:480px)]:mb-3">
                          {activeSlide.body}
                        </p>

                        <p className="text-[14px] font-semibold text-text-1">
                          {activeSlide.footer}
                        </p>
                      </>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Bottom Action Footer */}
              <div className="praxis-modal-actions flex items-center justify-between mt-10 [@media(max-height:480px)]:mt-3 w-full h-11 shrink-0">
                {/* Left slot: Back button */}
                <div className="w-[110px] flex justify-start">
                  {currentSlideIdx > 0 ? (
                    <button
                      type="button"
                      onClick={() => setCurrentSlideIdx(prev => Math.max(0, prev - 1))}
                      className="h-11 px-4 rounded-xl text-xs font-bold text-text-2 bg-slate-100 hover:bg-slate-200 transition-colors flex items-center justify-center"
                    >
                      ← Back
                    </button>
                  ) : (
                    <div />
                  )}
                </div>

                {/* Center slot: Slide progress indicator */}
                <div className="flex items-center gap-2 justify-center">
                  {WELCOME_SLIDES.map((_, i) => (
                    <div
                      key={i}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        i === currentSlideIdx ? 'w-6 bg-teal' : 'w-2 bg-slate-200'
                      }`}
                    />
                  ))}
                </div>

                {/* Right slot: Action button */}
                <div className="w-[110px] flex justify-end">
                  {currentSlideIdx < WELCOME_SLIDES.length - 1 ? (
                    <button
                      type="button"
                      onClick={() => setCurrentSlideIdx(prev => prev + 1)}
                      className="h-11 px-4 rounded-xl text-xs font-bold bg-accent text-white hover:bg-slate-800 transition-colors shrink-0 whitespace-nowrap shadow-xs flex items-center justify-center"
                    >
                      {activeSlide.buttonText}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setShowWelcomeModal(false)
                        onResetStage?.()
                      }}
                      className="h-11 px-4 rounded-xl text-xs font-extrabold bg-teal text-white hover:bg-teal-600 transition-colors flex items-center justify-center shrink-0 whitespace-nowrap shadow-sm"
                    >
                      {activeSlide.buttonText}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 2. IN-SITU WORKSPACE SPOTLIGHT & COACH OVERLAY ── */}
      <AnimatePresence>
        {(() => {
          const isDeadEndAbsorption = Boolean(stageIdx === 3 && currentStep?.id === 'challenge-solve' && steps.length > 0 && steps[steps.length - 1]?.law?.includes('Absorption') && !isComplete)
          const shouldHideOverlay = currentStep?.noOverlay && !isDeadEndAbsorption
          
          if (showWelcomeModal || !currentStep || !highlightRect || shouldHideOverlay) return null

          return (
            <motion.div
              key="spotlight-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="fixed inset-0 pointer-events-none"
              style={{ zIndex: 51 }}
            >
            {/* SVG Mask for soft curved backdrop cutout */}
            <svg className="fixed inset-0 w-full h-full pointer-events-none" style={{ zIndex: 51 }}>
              <defs>
                <mask id="tutorial-spotlight-mask">
                  <rect x="0" y="0" width="100%" height="100%" fill="white" />
                  <motion.rect
                    key={`cutout-pri-${currentStep?.id || 'target'}`}
                    initial={{ opacity: 0 }}
                    animate={{
                      opacity: 1,
                      x: highlightRect.cutoutLeft ?? highlightRect.left,
                      y: highlightRect.cutoutTop ?? highlightRect.top,
                      width: highlightRect.cutoutWidth ?? highlightRect.width,
                      height: highlightRect.cutoutHeight ?? highlightRect.height,
                      rx: highlightRect.cutoutRx ?? 22,
                      ry: highlightRect.cutoutRx ?? 22,
                    }}
                    transition={{
                      duration: 0.3,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    fill="black"
                  />
                  {secondaryHighlightRect && (
                    <motion.rect
                      key={`cutout-sec-${currentStep?.id || 'sec'}`}
                      initial={{ opacity: 0 }}
                      animate={{
                        opacity: 1,
                        x: secondaryHighlightRect.cutoutLeft ?? secondaryHighlightRect.left,
                        y: secondaryHighlightRect.cutoutTop ?? secondaryHighlightRect.top,
                        width: secondaryHighlightRect.cutoutWidth ?? secondaryHighlightRect.width,
                        height: secondaryHighlightRect.cutoutHeight ?? secondaryHighlightRect.height,
                        rx: secondaryHighlightRect.cutoutRx ?? 22,
                        ry: secondaryHighlightRect.cutoutRx ?? 22,
                      }}
                      transition={{
                        duration: 0.3,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      fill="black"
                    />
                  )}
                </mask>
              </defs>
              <rect
                x="0"
                y="0"
                width="100%"
                height="100%"
                fill="rgba(15, 23, 42, 0.40)"
                mask="url(#tutorial-spotlight-mask)"
              />
            </svg>

            {/* Rigid physical click blockers outside the cutout hole(s) */}
            {(() => {
              const bTop = secondaryHighlightRect 
                ? Math.min(highlightRect.cutoutTop ?? highlightRect.top, secondaryHighlightRect.cutoutTop ?? secondaryHighlightRect.top)
                : (highlightRect.cutoutTop ?? highlightRect.top)
              const bBottom = secondaryHighlightRect 
                ? Math.max((highlightRect.cutoutTop ?? highlightRect.top) + (highlightRect.cutoutHeight ?? highlightRect.height), (secondaryHighlightRect.cutoutTop ?? secondaryHighlightRect.top) + (secondaryHighlightRect.cutoutHeight ?? secondaryHighlightRect.height))
                : ((highlightRect.cutoutTop ?? highlightRect.top) + (highlightRect.cutoutHeight ?? highlightRect.height))
              const bLeft = secondaryHighlightRect 
                ? Math.min(highlightRect.cutoutLeft ?? highlightRect.left, secondaryHighlightRect.cutoutLeft ?? secondaryHighlightRect.left)
                : (highlightRect.cutoutLeft ?? highlightRect.left)
              const bRight = secondaryHighlightRect 
                ? Math.max((highlightRect.cutoutLeft ?? highlightRect.left) + (highlightRect.cutoutWidth ?? highlightRect.width), (secondaryHighlightRect.cutoutLeft ?? secondaryHighlightRect.left) + (secondaryHighlightRect.cutoutWidth ?? secondaryHighlightRect.width))
                : ((highlightRect.cutoutLeft ?? highlightRect.left) + (highlightRect.cutoutWidth ?? highlightRect.width))

              const r1 = secondaryHighlightRect && ((highlightRect.cutoutLeft ?? highlightRect.left) < (secondaryHighlightRect.cutoutLeft ?? secondaryHighlightRect.left) ? highlightRect : secondaryHighlightRect)
              const r2 = secondaryHighlightRect && (r1 === highlightRect ? secondaryHighlightRect : highlightRect)
              const r1Right = r1 ? (r1.cutoutLeft ?? r1.left) + (r1.cutoutWidth ?? r1.width) : 0
              const r2Left = r2 ? (r2.cutoutLeft ?? r2.left) : 0
              const hasMiddleGap = secondaryHighlightRect && (r2Left > r1Right)

              return (
                <>
                  <div 
                    className="fixed top-0 left-0 right-0 pointer-events-auto cursor-default"
                    style={{ height: Math.max(0, bTop) }}
                    onClick={e => e.stopPropagation()}
                  />
                  <div 
                    className="fixed left-0 right-0 bottom-0 pointer-events-auto cursor-default"
                    style={{ top: Math.max(0, bBottom) }}
                    onClick={e => e.stopPropagation()}
                  />
                  <div 
                    className="fixed left-0 pointer-events-auto cursor-default"
                    style={{
                      top: Math.max(0, bTop),
                      width: Math.max(0, bLeft),
                      height: Math.max(0, bBottom - bTop),
                    }}
                    onClick={e => e.stopPropagation()}
                  />
                  <div 
                    className="fixed right-0 pointer-events-auto cursor-default"
                    style={{
                      top: Math.max(0, bTop),
                      left: Math.max(0, bRight),
                      height: Math.max(0, bBottom - bTop),
                    }}
                    onClick={e => e.stopPropagation()}
                  />
                  {hasMiddleGap && (
                    <div
                      className="fixed pointer-events-auto cursor-default"
                      style={{
                        top: Math.max(0, bTop),
                        left: r1Right,
                        width: r2Left - r1Right,
                        height: Math.max(0, bBottom - bTop),
                      }}
                      onClick={e => e.stopPropagation()}
                    />
                  )}
                </>
              )
            })()}

            {/* Highlight ring on target element */}
            {highlightRect && (
              <motion.div
                key={`ring-pri-${currentStep?.id || 'target'}`}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  top: highlightRect.ringTop ?? highlightRect.top,
                  left: highlightRect.ringLeft ?? highlightRect.left,
                  width: highlightRect.ringWidth ?? highlightRect.width,
                  height: highlightRect.ringHeight ?? highlightRect.height,
                  borderRadius: `${highlightRect.ringRx ?? 10}px`,
                }}
                transition={{
                  duration: 0.3,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className={`fixed border-2 border-teal pointer-events-none shadow-[0_0_0_4px_rgba(46,196,182,0.25)] ${
                  highlightRect.isScoreModal ? 'border-teal/50 rounded-2xl' : isPreLawHighlight ? 'rounded-xl' : 'rounded-xl animate-pulse'
                }`}
                style={{ zIndex: 52 }}
              />
            )}

            {/* Secondary highlight ring on drop target element ('z') */}
            {secondaryHighlightRect && !isPreLawHighlight && (
              <motion.div
                key={`ring-sec-${currentStep?.id || 'sec'}`}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  top: secondaryHighlightRect.ringTop ?? secondaryHighlightRect.top,
                  left: secondaryHighlightRect.ringLeft ?? secondaryHighlightRect.left,
                  width: secondaryHighlightRect.ringWidth ?? secondaryHighlightRect.width,
                  height: secondaryHighlightRect.ringHeight ?? secondaryHighlightRect.height,
                  borderRadius: `${secondaryHighlightRect.ringRx ?? 10}px`,
                }}
                transition={{
                  duration: 0.3,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="fixed border-2 border-dashed border-teal/70 pointer-events-none shadow-[0_0_0_4px_rgba(46,196,182,0.15)] rounded-xl flex items-center justify-center"
                style={{ zIndex: 52 }}
              >
                {currentStep.actionType === 'swap' && (
                  <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9.5px] font-bold px-1.5 py-0.2 rounded-md uppercase tracking-wider shadow-xs whitespace-nowrap">
                    Target
                  </span>
                )}
              </motion.div>
            )}
          </motion.div>
          )
        })()}
      </AnimatePresence>

          {/* Floating Coach Tooltip Card */}
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
                  ...getTooltipStyle(),
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
                    onClick={handleActionButton}
                    className="px-4 py-1.5 [@media(max-height:480px)]:min-h-11 [@media(max-height:480px)]:flex [@media(max-height:480px)]:items-center rounded-xl text-xs font-bold bg-accent text-white hover:bg-slate-800 shadow-sm transition-all ml-auto cursor-pointer"
                  >
                    {currentStep.buttonText || 'Next →'}
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
    </div>
  )
}
