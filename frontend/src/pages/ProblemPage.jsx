import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useApi } from '../hooks/useApi'
import { useProgress } from '../hooks/useProgress'
import { useGameState } from '../hooks/useGameState'
import useDeviceTier, { PHONE_MAX_WIDTH, SMALL_TABLET_MAX_WIDTH } from '../hooks/useDeviceTier.js'
import ExpressionDisplay from '../components/ExpressionDisplay'
import AnimationOverlay from '../components/AnimationOverlay'
import ExprText from '../components/ExprText'
import InteractiveTutorial from '../components/InteractiveTutorial'
import { generatePuzzlePair } from '../engine/index.js'

/** sessionStorage slot that keeps a typed sandbox expression across a refresh. */
const CUSTOM_PUZZLE_STORAGE_KEY = 'praxis_sandbox_custom_puzzle'

/**
 * Preset the random sandbox generator runs with. The easy/medium/hard picker
 * was removed from the workspace, so this is a fixed default rather than user
 * state — the generator itself is untouched.
 */
const SANDBOX_DIFFICULTY = 'medium'

/** Below this viewport height the popups switch to their compressed layout. */
const SHORT_VIEWPORT_MAX_HEIGHT = 520

/* ═══════════════════════════════════════════════════════════════════════════
   NON-BLOCKING POPUP PLACEMENT
   ───────────────────────────────────────────────────────────────────────────
   The step-inspection tip, the law-explanation card and the hint bubble float
   OVER the workspace. Anchoring them statically (right-full / inline flow) put
   them on top of the expression, the applicable-law buttons or the header
   controls on every compact tier, so they now share one collision-aware layer:

     measure the anchor + the popup → try the candidate sides in priority
     order → keep the first that overlaps nothing the learner still needs
     (and fits the viewport) → otherwise clamp into the largest free gap →
     recompute on resize / orbit / scroll.

   The layer is `position: fixed`, so the canvas zoom transform and the
   scrollable canvas cannot drag the card off its anchor.
   ═══════════════════════════════════════════════════════════════════════════ */

/** The scrollable derivation box; a popup must never sit on the expression. */
const CANVAS_SELECTOR = '[data-tutorial="canvas"]'

/** Gameplay controls a non-blocking popup must never cover. */
const POPUP_PROTECTED_SELECTORS = [
  '[data-tutorial="hint-button"]',
  '[data-tutorial="guide-button"]',
  '[data-tutorial="laws-reference-button"]',
  '[data-tutorial="undo-button"]',
  '[data-tutorial="reset-button"]',
  '[data-tutorial="laws-dock"] [data-tutorial^="law-card-"]',
  '[data-tutorial="canvas"] [data-path]',
]
/** Extra breathing room kept around the popup and the viewport edges. */
const POPUP_MARGIN = 8
const POPUP_GAP = 8
/** Below this the explanation card stops being readable. */
const POPUP_NARROW_MIN_WIDTH = 112

const clampNum = (value, min, max) => (min > max ? min : Math.min(Math.max(value, min), max))

function rectsIntersect(a, b) {
  return !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top)
}

/**
 * Collapses overlapping rects into their bounding boxes. The expression nodes
 * are nested (a sum contains its terms contains their literals), so without
 * this one expression counts as a dozen separate obstacles in the cost
 * function and outvotes the header controls.
 */
function mergeOverlappingRects(rects) {
  const merged = []
  for (const rect of rects) {
    let next = rect
    let index = 0
    while (index < merged.length) {
      if (rectsIntersect(next, merged[index])) {
        const other = merged[index]
        next = {
          left: Math.min(next.left, other.left),
          top: Math.min(next.top, other.top),
          right: Math.max(next.right, other.right),
          bottom: Math.max(next.bottom, other.bottom),
        }
        merged.splice(index, 1)
        index = 0
      } else {
        index += 1
      }
    }
    merged.push(next)
  }
  return merged
}

/** Live viewport box (visualViewport keeps phone-landscape honest). */
function viewportBox() {
  const vv = typeof window !== 'undefined' ? window.visualViewport : null
  return {
    left: 0,
    top: 0,
    right: vv?.width ?? window.innerWidth,
    bottom: vv?.height ?? window.innerHeight,
  }
}

function measureProtectRects(anchorEl) {
  const out = []
  for (const sel of POPUP_PROTECTED_SELECTORS) {
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect()
      if (r.width <= 0 || r.height <= 0) continue
      out.push({ left: r.left, top: r.top, right: r.right, bottom: r.bottom })
    }
  }
  if (anchorEl) {
    const r = anchorEl.getBoundingClientRect()
    if (r.width > 0 || r.height > 0) {
      out.push({ left: r.left, top: r.top, right: r.right, bottom: r.bottom })
    }
  }
  return out
}

/** Everything on the layer shares this styling contract. */
const popupLayerStyle = (placement) => ({
  position: 'fixed',
  left: `${Math.round(placement.left)}px`,
  top: `${Math.round(placement.top)}px`,
  maxWidth: placement.maxWidth ? `${Math.round(placement.maxWidth)}px` : undefined,
  maxHeight: placement.maxHeight ? `${Math.round(placement.maxHeight)}px` : undefined,
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  zIndex: 45,
  pointerEvents: 'auto',
})

/**
 * Positions one non-blocking popup against its anchor.
 *
 * @param anchorRef          element the popup points at (the clicked control / step)
 * @param anchorSelector     CSS selector fallback, re-resolved on every measure
 * @param candidates         [{ side, gap }] in priority order
 * @param hardAvoidSelector  a region the popup must leave alone outright (only
 *                           for popups that may leave the canvas — see callers)
 * @param fullWidthOnNarrow  below this viewport width the popup spans the screen
 */
const DEFAULT_POPUP_CANDIDATES = [{ side: 'below' }, { side: 'above' }, { side: 'top-center' }, { side: 'bottom-center' }]
/**
 * Cards that explain a derivation line, ordered by how close they keep the card
 * to the line it explains: under it, over it, then the two header corners — a
 * 844x390 phone has no clean band under the expression but plenty of empty
 * header between the title and the right-hand controls.
 */
const INSPECT_POPUP_CANDIDATES = [
  { side: 'below', gap: 6 },
  { side: 'above', gap: 6 },
  // A narrow column in the gutter right of the derivation: on a 568x320 phone
  // the expression stops ~100px short of the edge, and this is the one spot
  // that covers neither it nor a control.
  { side: 'right-of-content', gap: 6 },
  // The free strip above the law dock, then the two bottom corners: on a
  // 320px-tall phone the expression fills the middle of the screen, so the only
  // places left are below it (right corner, clear of the dock's buttons) and
  // the empty header band above it.
  { side: 'above-dock', gap: 6 },
  { side: 'bottom-right' },
  { side: 'bottom-left' },
  { side: 'top-right' },
  { side: 'top-left' },
]
/** The hint bubble hangs off the Hint button without covering any control. */
const HINT_POPUP_CANDIDATES = [
  { side: 'below' },
  { side: 'above' },
  // The band directly above the button: on a landscape phone the row above the
  // control rail is empty, while below it sit the expression and the law dock.
  { side: 'above-anchor', gap: 6 },
  { side: 'top-right' },
  { side: 'top-left' },
  { side: 'bottom-left' },
  { side: 'bottom-right' },
  { side: 'bottom-center' },
]

function useCollisionPlacement({
  anchorRef,
  anchorSelector = null,
  candidates = DEFAULT_POPUP_CANDIDATES,
  /** Region the popup must leave alone outright (canvas on the compact tiers). */
  hardAvoidSelector = null,
  /** Region the popup only prefers to leave alone (tiny viewports: nothing fits). */
  softAvoidSelector = null,
  fullWidthOnNarrow = 480,
  enabled = true,
}) {
  const nodeRef = useRef(null)
  const [placement, setPlacement] = useState(null)

  useEffect(() => {
    // Nothing to place while the popup is closed; the layer is hidden anyway.
    if (!enabled) return undefined
    let frame = null

    const measure = () => {
      const node = nodeRef.current
      if (!node) return
      const vp = viewportBox()
      const previous = { maxHeight: node.style.maxHeight, maxWidth: node.style.maxWidth }
      node.style.maxHeight = 'none'
      node.style.maxWidth = 'none'
      const natW = node.offsetWidth || 280
      const natH = node.offsetHeight || 140
      node.style.maxHeight = previous.maxHeight
      node.style.maxWidth = previous.maxWidth

      // The anchor is re-resolved on every measure: the compact tiers re-home
      // the Hint button between the header, the side panel and the drawer, so
      // a cached node would go stale after the first layout change.
      const anchorEl = anchorRef?.current || (anchorSelector ? document.querySelector(anchorSelector) : null)
      let anchor = anchorEl ? anchorEl.getBoundingClientRect() : null
      if (!anchor || (anchor.width === 0 && anchor.height === 0)) anchor = null
      if (!anchor) anchor = { left: vp.left + vp.right / 2, top: vp.top, right: vp.left + vp.right / 2, bottom: vp.top }

      let obstacles = measureProtectRects(anchorEl)
      // The strip just above the law dock is dead space on the short tiers: the
      // placement engine may park a popup there instead of on the expression.
      let freeAboveTop = null
      const dockEl = document.querySelector('[data-tutorial="laws-dock"]')
      if (dockEl) {
        const dr = dockEl.getBoundingClientRect()
        if (dr.height > 0) freeAboveTop = dr.top - vp.top
      }
      // …and the empty gutter to the right of the expression is the other one:
      // on a 568x320 phone the derivation stops well short of the right edge.
      let contentRight = null
      for (const el of document.querySelectorAll('[data-tutorial="canvas"] [data-path]')) {
        const r = el.getBoundingClientRect()
        if (r.width <= 0 || r.height <= 0) continue
        contentRight = Math.max(contentRight ?? 0, r.right)
      }
      for (const sel of [hardAvoidSelector, softAvoidSelector]) {
        if (!sel) continue
        const el = document.querySelector(sel)
        if (!el) continue
        const r = el.getBoundingClientRect()
        if (r.width > 0 && r.height > 0) obstacles.push({ left: r.left, top: r.top, right: r.right, bottom: r.bottom })
      }
      obstacles = mergeOverlappingRects(obstacles)

      const avail = {
        left: anchor.left - vp.left,
        right: vp.right - anchor.right,
        above: anchor.top - vp.top,
        below: vp.bottom - anchor.bottom,
      }
      const wide = vp.right - vp.left <= fullWidthOnNarrow
      const boxW = wide ? vp.right - vp.left - POPUP_MARGIN * 2 : natW

      const buildCandidates = () => {
        const out = []
        for (const cand of candidates) {
          const gap = cand.gap ?? POPUP_GAP
          if (cand.side === 'below') {
            out.push({ top: anchor.bottom + gap, dir: 'below' })
          } else if (cand.side === 'above') {
            out.push({ top: anchor.top - gap - natH, dir: 'above' })
          } else if (cand.side === 'right') {
            if (avail.right - gap >= natW + POPUP_MARGIN) out.push({ left: anchor.right + gap, top: anchor.top, dir: 'right' })
          } else if (cand.side === 'left') {
            if (avail.left - gap >= natW + POPUP_MARGIN) out.push({ left: anchor.left - gap - natW, top: anchor.top, dir: 'left' })
          } else if (cand.side === 'top-center') {
            out.push({ top: vp.top + POPUP_MARGIN, left: vp.left + (vp.right - vp.left - boxW) / 2, align: 'viewport' })
          } else if (cand.side === 'bottom-center') {
            out.push({ top: vp.bottom - POPUP_MARGIN - natH, left: vp.left + (vp.right - vp.left - boxW) / 2, align: 'viewport' })
          } else if (cand.side === 'above-anchor') {
            out.push({ top: anchor.top - gap - natH, left: anchor.left, align: 'viewport' })
          } else if (cand.side === 'above-dock') {
            if (freeAboveTop != null) out.push({ top: freeAboveTop - gap - natH, left: vp.left + POPUP_MARGIN, align: 'viewport' })
          } else if (cand.side === 'right-of-content') {
            if (contentRight != null && contentRight + gap < vp.right - POPUP_MARGIN) {
              const narrowW = vp.right - POPUP_MARGIN - (contentRight + gap)
              // Only worth it when the card can stay usable at that width.
              if (narrowW >= POPUP_NARROW_MIN_WIDTH) {
                out.push({
                  top: vp.top + POPUP_MARGIN,
                  left: contentRight + gap,
                  width: narrowW,
                  align: 'viewport',
                })
              }
            }
          } else if (cand.side === 'top-right') {
            out.push({ top: vp.top + POPUP_MARGIN, left: vp.right - POPUP_MARGIN - boxW, align: 'viewport' })
          } else if (cand.side === 'top-left') {
            out.push({ top: vp.top + POPUP_MARGIN, left: vp.left + POPUP_MARGIN, align: 'viewport' })
          } else if (cand.side === 'bottom-left') {
            out.push({ top: vp.bottom - POPUP_MARGIN - natH, left: vp.left + POPUP_MARGIN, align: 'viewport' })
          } else if (cand.side === 'bottom-right') {
            out.push({ top: vp.bottom - POPUP_MARGIN - natH, left: vp.right - POPUP_MARGIN - boxW, align: 'viewport' })
          }
        }
        return out
      }

      const resolve = (candidate, h) => {
        const boxHeight = candidate.height ?? h
        const top = clampNum(candidate.top, vp.top + POPUP_MARGIN, Math.max(vp.top + POPUP_MARGIN, vp.bottom - POPUP_MARGIN - boxHeight))
        const width = Math.min(candidate.width ?? natW, boxW)
        // A candidate with an explicit left is an edge/column placement: keep it
        // (clamped for safety), so the engine can slide free of the controls.
        const left = wide
          ? vp.left + POPUP_MARGIN
          : clampNum(
            candidate.left ?? anchor.left,
            vp.left + POPUP_MARGIN,
            Math.max(vp.left + POPUP_MARGIN, vp.right - POPUP_MARGIN - width),
          )
        const maxHeight = clampNum(vp.bottom - POPUP_MARGIN - top, 96, natH)
        // Intrinsic width wins when it fits; only a popup wider than the free
        // band is capped (and then its own content decides how to wrap).
        return {
          left,
          top,
          width,
          maxWidth: natW > width ? width : undefined,
          maxHeight: h > maxHeight ? maxHeight : undefined,
          height: Math.min(h, maxHeight),
        }
      }

      /**
       * Cost of one candidate: the number of protected things it covers, with
       * a fractional tiebreak for partial grazing. When no candidate is fully
       * free (a 320px-tall phone has no empty band at all) the least-bad one
       * wins instead of the first one, which is what used to park the card on
       * top of the header rail.
       */
      const cost = (placementTry) => {
        const box = {
          left: placementTry.left,
          top: placementTry.top,
          right: placementTry.left + placementTry.width,
          bottom: placementTry.top + placementTry.height,
        }
        const boxArea = Math.max(1, (box.right - box.left) * (box.bottom - box.top))
        let penalty = 0
        for (const o of obstacles) {
          if (!rectsIntersect(box, o)) continue
          const overlapW = Math.min(box.right, o.right) - Math.max(box.left, o.left)
          const overlapH = Math.min(box.bottom, o.bottom) - Math.max(box.top, o.top)
          // How much of the POPUP is buried, not how much of the obstacle: a
          // popup that lands in the empty part of the canvas is nearly free,
          // one that lands on a control is not.
          penalty += 1 + Math.min(0.9, (overlapW * overlapH) / boxArea)
        }
        return penalty
      }

      // A 320px-tall phone leaves ~50px of clean header band between the title
      // and the control rail. Clipping the card to that band (it scrolls) is
      // still better than burying the expression or a control, so the height is
      // capped there instead of being treated as a hard constraint.
      const tries = buildCandidates().map(c => resolve(c, natH))
      let chosen = tries[0] || resolve({ top: vp.top + POPUP_MARGIN }, natH)
      let bestPenalty = tries.length > 0 ? cost(chosen) : 0
      for (const t of tries.slice(1)) {
        const penalty = cost(t)
        if (penalty === 0) { chosen = t; break }
        if (penalty < bestPenalty) { bestPenalty = penalty; chosen = t }
      }
      // Nothing clean anywhere: shrink into the free band the few available
      // pixels allow (the card scrolls) rather than covering a control.
      if (bestPenalty > 0 && freeAboveTop != null) {
        const headerBottom = obstacles.reduce((acc, o) => (o.bottom < freeAboveTop ? Math.max(acc, o.bottom) : acc), vp.top)
        const bandHeight = Math.max(48, freeAboveTop - POPUP_GAP - (headerBottom + POPUP_MARGIN))
        if (bandHeight < natH) {
          const capped = { side: 'top-left' }
          const cappedTry = resolve({ ...capped, height: bandHeight }, bandHeight)
          if (cost(cappedTry) < bestPenalty) chosen = cappedTry
        }
      }
      setPlacement(prev => {
        if (prev
          && Math.abs(prev.left - chosen.left) < 0.6
          && Math.abs(prev.top - chosen.top) < 0.6
          && Math.abs((prev.maxHeight ?? 0) - (chosen.maxHeight ?? 0)) < 0.6
          && prev.width === chosen.width) return prev
        return chosen
      })
    }

    const schedule = () => {
      if (frame) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }

    measure()
    schedule()
    window.addEventListener('resize', schedule)
    window.addEventListener('orientationchange', schedule)
    window.addEventListener('scroll', schedule, true)
    window.visualViewport?.addEventListener('resize', schedule)
    let observer = null
    if (typeof ResizeObserver !== 'undefined' && nodeRef.current) {
      observer = new ResizeObserver(schedule)
      observer.observe(nodeRef.current)
    }
    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('orientationchange', schedule)
      window.removeEventListener('scroll', schedule, true)
      window.visualViewport?.removeEventListener('resize', schedule)
      observer?.disconnect()
    }
    // `enabled` is the only reactive dependency: the anchors are read live at
    // measure time, which is exactly why this recomputes on resize/scroll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, candidates, fullWidthOnNarrow, hardAvoidSelector])

  // NOTE: the node handle is returned as `nodeRef` (not `ref`) so reading it in
  // render is not mistaken for a render-time ref read by react-hooks/refs.
  return {
    nodeRef,
    layerStyle: placement ? popupLayerStyle(placement) : { position: 'fixed', left: 0, top: 0, opacity: 0, pointerEvents: 'none', zIndex: 45 },
    ready: Boolean(placement),
  }
}

/**
 * The free vertical band below the control that opened the panel. The laws
 * reference used to be a full-height overlay, so opening it hid the header rail
 * — including the button that opened it. It now opens under that rail: fixed
 * top, explicit height, sliding in from the right.
 *
 * @param anchorSelectors one selector, or several whose lowest edge wins. The
 *   compact tiers fold the whole control rail into the header, so anchoring on
 *   the Laws button alone would lay the sheet across the other five controls.
 */
function useBandedOverlay(triggerSelectors, enabled) {
  const nodeRef = useRef(null)
  const [band, setBand] = useState(null)

  useEffect(() => {
    if (!enabled) return undefined
    let frame = null

    const measure = () => {
      const vp = viewportBox()
      const list = Array.isArray(triggerSelectors) ? triggerSelectors : [triggerSelectors]
      let trigger = null
      for (const sel of list) {
        const el = sel ? document.querySelector(sel) : null
        if (!el) continue
        const r = el.getBoundingClientRect()
        if (r.width <= 0 && r.height <= 0) continue
        trigger = trigger ? { top: trigger.top, bottom: Math.max(trigger.bottom, r.bottom) } : { top: r.top, bottom: r.bottom }
      }
      // The panel hangs directly under the control that opened it, and never
      // taller than what is left of the viewport: that is the one placement
      // that cannot bury its own trigger at ANY tier, because every tier puts
      // its controls either in the header or in a side column.
      const top = trigger ? clampNum(trigger.bottom + POPUP_GAP, vp.top + POPUP_MARGIN, vp.bottom - 160) : vp.top + POPUP_MARGIN
      const maxHeight = Math.max(120, vp.bottom - POPUP_MARGIN - top)
      publishBand({ top, maxHeight })
    }

    const publishBand = (next) => {
      setBand(prev => (prev
        && Math.abs(prev.top - next.top) < 0.6
        && Math.abs(prev.maxHeight - next.maxHeight) < 0.6
        ? prev
        : next))
    }
    const schedule = () => {
      if (frame) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }
    // Measured inside the first frame rather than synchronously: the panel is
    // revealed by `ready`, so there is no flash and no cascading render.
    schedule()
    window.addEventListener('resize', schedule)
    window.addEventListener('orientationchange', schedule)
    window.visualViewport?.addEventListener('resize', schedule)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('orientationchange', schedule)
      window.visualViewport?.removeEventListener('resize', schedule)
    }
    // `triggerSelectors` is a fresh array on every render; `enabled` is the
    // only real dependency (the selectors are static at each call site).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  return { nodeRef, band, ready: Boolean(band) }
}

/** The shared engine needs both the start expression and a target to be playable. */
function isPlayablePuzzle(candidate) {
  return Boolean(
    candidate
    && typeof candidate.expr === 'string' && candidate.expr.trim() !== ''
    && typeof candidate.goal === 'string' && candidate.goal.trim() !== '',
  )
}

/** Reads the persisted custom puzzle, tolerating a missing/corrupt slot. */
function readStoredCustomPuzzle() {
  try {
    const raw = sessionStorage.getItem(CUSTOM_PUZZLE_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const puzzle = parsed && parsed.puzzle ? parsed.puzzle : parsed
    return isPlayablePuzzle(puzzle) ? puzzle : null
  } catch (err) {
    console.warn('Ignoring unreadable sandbox puzzle in sessionStorage:', err)
    return null
  }
}

export default function ProblemPage() {
  const { levelId, stageIdx } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { fetchLevel, laws, submitScore } = useApi()
  const { progress, addPoints, deductPoints, completeStage, saveScore, getStagesCompleted, saveSolution, getSavedSolution } = useProgress()

  // Sandbox mode: reached via /sandbox, which supplies no route params. It
  // reuses this exact workspace but drives it from a locally generated puzzle
  // and never writes progress.
  const isSandbox = !levelId && !stageIdx

  // ── Device tier (Feature 2) ───────────────────────────────────────────
  // Every tier behaviour below is additive: the desktop branch keeps the exact
  // markup/classes it has always had.
  const { isTouch, isPortrait, isLandscape, isPhone, isSmallTablet, isTablet, width, height } = useDeviceTier()
  // The tier hook classifies by width, so a phone rotated to landscape (844x390)
  // reports `tablet-sm` because its long edge is > 767px. What actually decides
  // whether side columns fit is the SHORT edge, so a short touch landscape
  // viewport is treated as the phone-landscape layout regardless of that label.
  const isPhoneLandscape = isTouch && isLandscape && (isPhone || height <= 520)
  const isTabletPortrait = (isTablet || isSmallTablet) && isPortrait
  const isTabletLandscape = isTablet && isLandscape
  // A narrow viewport is a compact viewport no matter what the pointer type is:
  // a 420px desktop window must not be handed the squeezed three-column layout.
  // Non-touch windows get a wider cutoff (SMALL_TABLET_MAX_WIDTH) because below
  // 1024px the two side columns leave the canvas unusably thin; >=1024px stays
  // the full desktop three-column design. Touch keeps the phone cutoff so a
  // 768-1023px touch device keeps its own tablet rules.
  const isNarrowViewport = width > 0
    && width <= (isTouch ? PHONE_MAX_WIDTH : SMALL_TABLET_MAX_WIDTH)
  // Phone landscape / tablet portrait / any narrow window can't fit a side
  // column next to the canvas: step history becomes an overlay drawer and the
  // right panel folds into the header (assistance) or the bottom dock (laws).
  const useOverlayHistory = isPhoneLandscape || isTabletPortrait || isNarrowViewport
  const showRightPanel = !useOverlayHistory
  const lawsAsStrip = isPhoneLandscape || isNarrowViewport
  const lawsAsGrid = isTabletPortrait && !isNarrowViewport
  const lawsInRightColumn = isTabletLandscape
  const compactHeader = useOverlayHistory || isTabletLandscape
  /** Compact tiers re-home the workspace controls into a second header row. */
  const headerControlRail = useOverlayHistory
  const assistanceInHeader = useOverlayHistory
  /** Only touch tiers get enlarged hit boxes — desktop rendering is untouched. */
  const touchTargets = isTouch
  // Landscape phones (390px tall) and short windows: compress every popup so
  // its actions stay reachable without scrolling.
  const shortViewport = height > 0 && height < SHORT_VIEWPORT_MAX_HEIGHT
  // The laws reference is a full-width bottom sheet until the viewport is both
  // wide AND tall enough to deserve the side drawer.
  const lawsSheet = width > 0 && (width <= PHONE_MAX_WIDTH || shortViewport)

  /**
   * Custom sandbox puzzle: /sandbox validates the typed expression and hands it
   * over as route state, while sessionStorage keeps the same expression across a
   * refresh. A bare /sandbox/play with neither signal keeps the pre-existing
   * generated-problem behaviour (RANDOM mode).
   */
  const [customPuzzle] = useState(() => {
    if (!isSandbox) return null
    const state = location.state
    if (isPlayablePuzzle(state && state.customPuzzle)) return state.customPuzzle
    if (state && state.random === true) return null
    return readStoredCustomPuzzle()
  })
  const isCustomSandbox = isSandbox && Boolean(customPuzzle)

  /** Builds the synthetic "level" + generated puzzle pair used by sandbox mode. */
  const buildSandboxState = useCallback((excludeExpr = null) => {
    let puzzle
    try {
      puzzle = generatePuzzlePair(excludeExpr, SANDBOX_DIFFICULTY)
    } catch (err) {
      console.warn('Sandbox generator failed, keeping the current problem:', err)
      throw err
    }
    return {
      level: { id: 'sandbox', name: 'Sandbox', desc: 'Free practice', varCount: 3, puzzles: [] },
      stageNum: 0,
      puzzle,
    }
  }, [])

  // First sandbox problem. The sandbox has no level metadata to fetch, so the
  // synthetic stub below is all the workspace ever needs for `level`.
  const [levelPuzzle, setLevelPuzzle] = useState(() => {
    if (!isSandbox) return null
    // A typed expression is already a solved-by-construction puzzle: no need to
    // generate (and discard) a random one before showing it.
    if (customPuzzle) return customPuzzle
    try {
      return buildSandboxState().puzzle
    } catch (err) {
      console.error('Failed to generate the first sandbox problem:', err)
      return null
    }
  })
  const [level, setLevel] = useState(() => (
    isSandbox ? { id: 'sandbox', name: 'Sandbox', desc: 'Free practice', varCount: 3, puzzles: [] } : null
  ))
  // Bumping the nonce remounts the workspace so no selection/history survives
  // a randomize — the same pattern the removed PracticeWorkspace used.
  const [sandboxNonce, setSandboxNonce] = useState(0)
  const [showHint, setShowHint] = useState(false)
  const [currentHint, setCurrentHint] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)
  const [earnedPoints, setEarnedPoints] = useState(0)
  const [toastMessage, setToastMessage] = useState(null)
  const [zoom, setZoom] = useState(1.0)
  const [inspectedStepIdx, setInspectedStepIdx] = useState(null)
  const [showLawsDrawer, setShowLawsDrawer] = useState(false)
  const [showStepHistory, setShowStepHistory] = useState(false)
  const lawsStripRef = useRef(null)
  // Derived, never stored: the drawer cannot outlive the tier that owns it, so
  // leaving phone landscape/tablet portrait closes it without an effect.
  const stepHistoryOpen = showStepHistory && useOverlayHistory
  const [scoreResult, setScoreResult] = useState(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [dontAskResetAgain, setDontAskResetAgain] = useState(false)
  const [dismissReviewReminder, setDismissReviewReminder] = useState(false)
  const [showStepInspectionTip, setShowStepInspectionTip] = useState(false)
  const [isTutorialActive, setIsTutorialActive] = useState(() => new URLSearchParams(window.location.search).get('tutorial') === 'true')
  const loadedAsSavedRef = useRef(false)

  // ── Collision-aware popup anchors ──────────────────────────────────────
  // All three non-blocking popups hang off the SAME anchor: the derivation line
  // they explain (the active expression row, marked `data-tutorial`). The old
  // markup anchored them to a 24px-wide rail cell and let them spill over the
  // expression and the law dock. Resolved by selector at measure time so the
  // tier can re-home the anchor without re-registering anything.
  const INSPECT_ANCHOR = '[data-tutorial="active-equation"]'
  const HINT_ANCHOR = '[data-tutorial="hint-button"]'
  // The compact tiers scroll/crop the derivation inside this box, so a popup
  // that can leave it at all should. A 568x320 phone has no free band left
  // once the header rail is counted, so there the canvas becomes a soft
  // obstacle (costed) instead of a hard one and the card is allowed to sit on
  // the expression rather than on a control the learner still needs.
  const compactCanvas = shortViewport || isNarrowViewport || isPhoneLandscape || isTabletPortrait
  /** Below this the header rail can be 3 controls wide: nothing fits beside it. */
  const TINY_VIEWPORT_MAX_HEIGHT = 360
  const canvasIsHardObstacle = compactCanvas && !(height > 0 && height <= TINY_VIEWPORT_MAX_HEIGHT)

  const {
    nodeRef: inspectPopupNode,
    layerStyle: inspectPopupStyle,
    ready: inspectPopupReady,
  } = useCollisionPlacement({
    anchorSelector: INSPECT_ANCHOR,
    candidates: INSPECT_POPUP_CANDIDATES,
    // Compact tiers cannot spare a single pixel of the canvas: the expression
    // fills the whole viewport width there, so the card has to leave it alone
    // outright and fall back to the header band.
    hardAvoidSelector: canvasIsHardObstacle ? CANVAS_SELECTOR : null,
    softAvoidSelector: compactCanvas ? CANVAS_SELECTOR : null,
    fullWidthOnNarrow: 480,
    enabled: inspectedStepIdx !== null || showStepInspectionTip,
  })

  const {
    nodeRef: lawsPanelNode,
    band: lawsPanelBand,
    ready: lawsPanelReady,
  } = useBandedOverlay(
    // The panel hangs under whichever control opened it — the header rail button
    // on the compact tiers, the right panel's Laws Quick Reference on the wide
    // ones — so it never buries its own trigger.
    ['[data-testid="laws-sheet-anchor"]', '[data-tutorial="laws-reference-button"]'],
    showLawsDrawer,
  )

  const {
    nodeRef: hintPopupNode,
    layerStyle: hintPopupStyle,
    ready: hintPopupReady,
  } = useCollisionPlacement({
    anchorSelector: HINT_ANCHOR,
    candidates: HINT_POPUP_CANDIDATES,
    hardAvoidSelector: canvasIsHardObstacle ? CANVAS_SELECTOR : null,
    softAvoidSelector: compactCanvas ? CANVAS_SELECTOR : null,
    fullWidthOnNarrow: 480,
    enabled: showHint,
  })

  const stageNum = isSandbox ? 0 : parseInt(stageIdx)
  const completedSet = new Set(isSandbox ? [] : getStagesCompleted(Number(levelId)))

  /** The puzzle currently being played — generated in sandbox, fetched otherwise. */
  const puzzle = levelPuzzle

  // Reset review reminder and inspection tip on stage changes
  useEffect(() => {
    setDismissReviewReminder(false)
    setShowStepInspectionTip(false)
  }, [levelId, stageIdx])

  // Dismiss inspection tip whenever a step is actively inspected
  useEffect(() => {
    if (inspectedStepIdx !== null) {
      setShowStepInspectionTip(false)
    }
  }, [inspectedStepIdx])

  // Sync tutorial active state from URL query or tutorial level; the sandbox
  // never runs the guided tutorial overlay.
  useEffect(() => {
    if (isSandbox) {
      setIsTutorialActive(false)
      return
    }
    const isTutQuery = new URLSearchParams(window.location.search).get('tutorial') === 'true'
    const isTutLevel = Number(levelId) === 0
    setIsTutorialActive(isTutQuery || isTutLevel)
  }, [levelId, stageIdx, isSandbox])

  // A typed sandbox expression survives a refresh; RANDOM mode clears the slot
  // so a later bare /sandbox/play never resurrects a stale expression.
  useEffect(() => {
    if (!isSandbox) return
    try {
      if (customPuzzle) sessionStorage.setItem(CUSTOM_PUZZLE_STORAGE_KEY, JSON.stringify({ puzzle: customPuzzle }))
      else sessionStorage.removeItem(CUSTOM_PUZZLE_STORAGE_KEY)
    } catch (err) {
      console.warn('Could not persist the sandbox puzzle:', err)
    }
  }, [isSandbox, customPuzzle])

  function getLawExplanation(lawName) {
    if (!lawName) return null
    const lower = String(lawName).toLowerCase()
    if (lower.includes('initial')) {
      return 'Starting problem expression.'
    }
    if (lower.includes('distributive')) {
      return 'Factored out a common variable (AB + AC = A(B+C)) or applied POS dual distribution ((A+B)(A+C) = A + BC).'
    }
    if (lower.includes('absorption')) {
      return 'Redundant term absorbed: A + AB = A in sums, and A(A + B) = A in products.'
    }
    if (lower.includes('complement')) {
      return 'Opposites evaluated: A + A\' = 1 in sums, and A · A\' = 0 in products.'
    }
    if (lower.includes('idempotent')) {
      return 'Duplicate terms combined: A + A = A in sums, and A · A = A in products.'
    }
    if (lower.includes('identity')) {
      return 'Neutral element dropped: A + 0 = A in sums, and A · 1 = A in products.'
    }
    if (lower.includes('annulment')) {
      return 'Dominant value takes over: A + 1 = 1 in sums, and A · 0 = 0 in products.'
    }
    if (lower.includes('double neg')) {
      return 'Double NOT cancels out: (A\')\' = A.'
    }
    if (lower.includes('demorgan')) {
      return 'Negated group expanded: (AB)\' = A\' + B\' or (A+B)\' = A\'B\'.'
    }
    return `Applied ${lawName}.`
  }
  const ZOOM_STEP = 0.15
  const ZOOM_MIN = 0.5
  const ZOOM_MAX = 2.0

  // Custom sandbox puzzles can need the complement-guarded Distributive
  // (Expand) law to be solvable (A(B + A') has to reach AB). Graded levels never
  // carry the flag, so their law engine stays exactly as it was.
  const allowExpand = Boolean(puzzle && puzzle.allowExpand)

  const {
    expr, sel, steps, exprHistory,
    applicableLaws,
    isComplete, earnedXp,
    status, statusMsg,
    activeGuidePaths,
    isPreLawHighlight,
    isAnimating, animationData,
    loadPuzzle,
    handleClickLit, handleClickNot, handleClickTerm,
    applyLaw, undoAction, resetPuzzle, useHint, swapTerms, activateGuide,
    hintsUsed,
    guidesUsed,
    optimalSteps, optimalPath,
  } = useGameState({ allowExpand })

  /** Identity of the applicable-law set, used to re-anchor the law strip. */
  const applicableLawKey = applicableLaws.map(l => l.id).join('|')

  // Applicable laws are inserted at the HEAD of the phone-landscape strip. If the
  // strip is already scrolled (e.g. the learner was browsing the reference
  // chips), the newly actionable law would land off-screen, so re-anchor it.
  useEffect(() => {
    const strip = lawsStripRef.current
    if (strip) strip.scrollLeft = 0
  }, [applicableLawKey])


  // 1. Fetch level and set current puzzle (skipped entirely in sandbox mode)
  useEffect(() => {
    if (isSandbox) return

    let isCancelled = false
    setShowSuccess(false)
    setShowHint(false)
    setScoreResult(null)

    fetchLevel(Number(levelId)).then(data => {
      if (isCancelled || !data) return
      setLevel(data)
      const puz = data.puzzles?.[stageNum]
      if (puz) {
        setLevelPuzzle(puz)
      } else {
        navigate(`/level/${levelId}/stages`, { replace: true })
      }
    }).catch(err => {
      if (!isCancelled) {
        console.error('Failed to load level:', err)
        navigate('/levels', { replace: true })
      }
    })

    return () => {
      isCancelled = true
    }
  }, [levelId, stageNum, navigate, isSandbox])

  // 2. Synchronize puzzle derivation with saved solution (reactive to auth hydration).
  //    Sandbox problems are never saved, so they always start from scratch.
  useEffect(() => {
    if (!puzzle) return

    if (isSandbox) {
      loadedAsSavedRef.current = false
      loadPuzzle(puzzle, null)
      return
    }

    const isTutorial = Number(levelId) === 0 && new URLSearchParams(window.location.search).get('tutorial') === 'true'
    const savedSteps = isTutorial ? null : getSavedSolution(Number(levelId), stageNum)
    loadedAsSavedRef.current = Boolean(savedSteps && savedSteps.length > 0)
    loadPuzzle(puzzle, savedSteps)
  }, [puzzle, levelId, stageNum, isSandbox])

  // Handle stage completion
  useEffect(() => {
    if (!isComplete) return

    // If this stage was simply preloaded from an existing saved solution on visit, do NOT auto-popup
    if (loadedAsSavedRef.current) {
      return
    }

    const isFirstTime = !completedSet.has(stageNum)

    // Derive lawsUsed from step history at this moment
    const nameToId = {
      'Absorption Law': 'absorption',
      'Absorption Law (Product)': 'absorption',
      'Idempotent Law': 'idempotent',
      'Idempotent Law (Product)': 'idempotent',
      'Complement Law': 'complement',
      'Complement Law (Product)': 'complement',
      'Identity Law': 'identity',
      'Identity Law (Product)': 'identity',
      'Annulment Law': 'annulment',
      'Annulment Law (Product)': 'annulment',
      'Double Negation': 'double-neg',
      "De Morgan's (AND\u2192OR)": 'demorgan-and',
      "De Morgan's (OR\u2192AND)": 'demorgan-or',
      'Distributive (Factor)': 'distributive',
      'Distributive (POS)': 'distributive',
    }
    const lawsUsed = steps.map(s => nameToId[s?.law] || s?.law?.toLowerCase() || 'unknown')
    const effectiveOptimal = (optimalSteps && optimalSteps > 0) ? optimalSteps : (puzzle?.optimalSteps || steps.length)

    // Compute immediate local score result so UI renders instant 0ms breakdown
    const target_laws = new Set(puzzle?.targetLaws || [])
    const laws_used = new Set(lawsUsed)
    const efficiency = steps.length <= effectiveOptimal ? 40.0 : Math.max(0.0, 40.0 - (steps.length - effectiveOptimal) * 10.0)
    const target_law = target_laws.size === 0 ? 30.0 : Math.round((Array.from(target_laws).filter(l => laws_used.has(l)).length / target_laws.size) * 30.0 * 10) / 10
    const totalAssistance = (hintsUsed || 0) + (guidesUsed || 0)
    const hint_independence = totalAssistance === 0 ? 30.0 : Math.max(0.0, 30.0 - totalAssistance * 10.0)
    const total = Math.round((efficiency + target_law + hint_independence) * 10) / 10
    const earnedPoints = Math.round((total / 100.0) * 5) // +5 bonus for 100% score

    // ── SANDBOX: free practice. Nothing is awarded or persisted — the modal
    // derives its summary from `steps`/`optimalSteps`/`hintsUsed` directly, so
    // there is no score result to store.
    if (isSandbox) {
      const sandboxTimer = setTimeout(() => setShowSuccess(true), 200)
      return () => clearTimeout(sandboxTimer)
    }

    if (isFirstTime) {
      addPoints(earnedXp + earnedPoints)
    }
    completeStage(Number(levelId), stageNum)
    saveSolution(Number(levelId), stageNum, steps)

    const immediateScore = {
      efficiency,
      targetLaw: target_law,
      hintIndependence: hint_independence,
      total,
      earnedPoints,
      breakdown: {
        stepsUsed: steps.length,
        optimalSteps: effectiveOptimal,
        targetLawsRequired: Array.from(target_laws),
        targetLawsUsed: Array.from(laws_used).filter(l => target_laws.has(l)),
        hintsUsed: hintsUsed || 0,
        guidesUsed: guidesUsed || 0,
        totalAssistance,
      },
    }
    setScoreResult(immediateScore)
    saveScore(Number(levelId), stageNum, total)

    // Submit score in background to sync with server/database
    submitScore({
      levelId: Number(levelId),
      stageIdx: stageNum,
      stepsUsed: steps.length,
      lawsUsed,
      hintsUsed,
      guidesUsed,
      optimalSteps: effectiveOptimal,
    }).then(result => {
      if (result) {
        saveScore(Number(levelId), stageNum, result.total)
        setScoreResult(result)
      }
    })

    // Auto-pop the complete modal promptly after solving
    const timer = setTimeout(() => setShowSuccess(true), 200)
    return () => clearTimeout(timer)
    // Intentionally keyed only on completion: the surrounding values are read
    // at the moment the puzzle is solved. isSandbox is route-derived and stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete])

  // Global click-away listener for derivation step inspection
  useEffect(() => {
    if (inspectedStepIdx === null) return
    const handlePointerDown = (e) => {
      if (e.target.closest('[data-inspect-card]') || e.target.closest('[data-inspect-trigger]')) {
        return
      }
      setInspectedStepIdx(null)
    }
    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [inspectedStepIdx])

  const handleOpenScoreSummary = () => {
    // Sandbox is unscored: never submit to the server, just show the breakdown.
    if (isSandbox) {
      setShowSuccess(true)
      return
    }

    if (!scoreResult && isComplete) {
      const nameToId = {
        'Absorption Law': 'absorption',
        'Absorption Law (Product)': 'absorption',
        'Idempotent Law': 'idempotent',
        'Idempotent Law (Product)': 'idempotent',
        'Complement Law': 'complement',
        'Complement Law (Product)': 'complement',
        'Identity Law': 'identity',
        'Identity Law (Product)': 'identity',
        'Annulment Law': 'annulment',
        'Annulment Law (Product)': 'annulment',
        'Double Negation': 'double-neg',
        "De Morgan's (AND\u2192OR)": 'demorgan-and',
        "De Morgan's (OR\u2192AND)": 'demorgan-or',
        'Distributive (Factor)': 'distributive',
        'Distributive (POS)': 'distributive',
      }
      const lawsUsed = steps.map(s => nameToId[s?.law] || s?.law?.toLowerCase() || 'unknown')
      const effectiveOptimal = (optimalSteps && optimalSteps > 0) ? optimalSteps : (puzzle?.optimalSteps || steps.length)
      submitScore({
        levelId: Number(levelId),
        stageIdx: stageNum,
        stepsUsed: steps.length,
        lawsUsed,
        hintsUsed,
        guidesUsed,
        optimalSteps: effectiveOptimal,
      }).then(result => {
        if (result) {
          saveScore(Number(levelId), stageNum, result.total)
          setScoreResult(result)
        }
        setShowSuccess(true)
      })
    } else {
      setShowSuccess(true)
    }
  }

  const handleHint = () => {
    if (!puzzle || isComplete) return
    const hint = useHint(puzzle)
    if (hint) {
      setCurrentHint(hint)
      setShowHint(true)
      setTimeout(() => setShowHint(false), 6000)
    }
  }

  const handleNextStage = () => {
    const nextIdx = stageNum + 1
    if (level && nextIdx < level.puzzles.length) {
      const isTutLevel = Number(levelId) === 0
      const tutParam = isTutLevel ? '?tutorial=true' : ''
      navigate(`/level/${levelId}/stage/${nextIdx}${tutParam}`)
    } else {
      if (Number(levelId) === 0) {
        setIsTutorialActive(false)
      }
      navigate(`/level/${levelId}/stages`)
    }
  }

  /**
   * Sandbox only: swap in a freshly generated, solver-verified problem.
   * Bumping the nonce remounts the workspace so the previous derivation,
   * selection, hint and animation state are all discarded.
   */
  const handleRandomize = () => {
    try {
      const next = buildSandboxState(puzzle?.expr || null)
      setLevel(next.level)
      setLevelPuzzle(next.puzzle)
      setSandboxNonce(n => n + 1)
      setShowSuccess(false)
      setShowHint(false)
      setInspectedStepIdx(null)
      setShowResetConfirm(false)
      setScoreResult(null)
      loadedAsSavedRef.current = false
    } catch {
      toast.error('Could not generate a new problem — try again.')
    }
  }

  // The Guide is a graded-level aid: 20 points there, free in the unscored
  // sandbox (the spec requires Hint/Guide to stay available while practicing).
  const guideCost = isSandbox ? 0 : 20

  const handleGuide = () => {
    if (isComplete) return
    if (guideCost === 0 || (progress.points ?? 0) >= guideCost) {
      const activated = activateGuide()
      if (activated && guideCost > 0) {
        deductPoints(guideCost)
      }
    } else {
      alert(`Not enough points! You need ${guideCost} points to use the Guide.`)
    }
  }

  const handleResetClick = () => {
    // If the stage is completed and user hasn't opted out in this session
    const skipPrompt = sessionStorage.getItem('praxis_skip_reset_confirm') === 'true'
    if (isComplete && !skipPrompt) {
      setDontAskResetAgain(false)
      setShowResetConfirm(true)
    } else {
      executeReset()
    }
  }

  const executeReset = () => {
    if (dontAskResetAgain) {
      sessionStorage.setItem('praxis_skip_reset_confirm', 'true')
    }
    setInspectedStepIdx(null)
    loadedAsSavedRef.current = false
    setShowResetConfirm(false)
    setShowSuccess(false)
    setShowHint(false)
    resetPuzzle(puzzle)
  }

  const handleUndo = () => {
    setInspectedStepIdx(null)
    loadedAsSavedRef.current = false
    undoAction()
  }

  /* Wrapper functions to pass current expr snapshot to handlers */
  const onClickLit = (path) => {
    setInspectedStepIdx(null)
    if (expr) handleClickLit(path, expr)
  }
  const onClickNot = (path) => {
    setInspectedStepIdx(null)
    if (expr) handleClickNot(path, expr)
  }
  const onClickTerm = (path) => {
    setInspectedStepIdx(null)
    if (expr) handleClickTerm(path, expr)
  }
  const onApplyLaw = (law) => {
    setInspectedStepIdx(null)
    loadedAsSavedRef.current = false
    const enableTutorialPause = isTutorialActive && stageNum < 3
    if (expr) applyLaw(law, expr, steps, hintsUsed, enableTutorialPause)
  }
  const onSwapTerms = (sumPath, fromIdx, toIdx) => {
    setInspectedStepIdx(null)
    loadedAsSavedRef.current = false
    swapTerms(sumPath, fromIdx, toIdx)
  }

  if (!level || !puzzle) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-7 w-7 text-accent" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm font-semibold text-text-3">{isSandbox ? 'Generating problem...' : 'Loading stage...'}</span>
        </div>
      </div>
    )
  }

  /* ──────────────────────────────────────────────────────────────────────
     Tier-dependent placement of the shared blocks. Wide tiers render these
     exactly where they have always been; the touch tiers re-home them so the
     canvas keeps its full width and every control stays thumb-reachable.
     ────────────────────────────────────────────────────────────────────── */

  const chromeText = touchTargets ? 'text-[14px]' : 'text-xs'
  const chromeHeight = touchTargets ? 'min-h-[44px] min-w-[44px] praxis-touch-target' : ''

  /** Header title/subtitle — custom sandbox announces the typed expression. */
  const workspaceTitle = isSandbox ? 'Sandbox' : 'Simplify Expression'
  const workspaceSubtitle = isSandbox
    ? (isCustomSandbox
      ? 'Your expression · no points awarded'
      : 'Random practice · no points awarded')
    : 'Reduce to its simplest form'

  /** Zoom magnitude controls — header on wide tiers, drawer on compact ones. */
  const renderZoomControls = (compact) => (
    <>
      <button
        className={compact
          ? `flex items-center justify-center rounded-md border border-border bg-bg text-[16px] text-text-2 transition-all hover:bg-border hover:text-text-1 disabled:opacity-30 disabled:cursor-not-allowed ${chromeHeight}`
          : 'w-8 h-8 rounded-md border border-border bg-bg text-[16px] text-text-2 flex items-center justify-center transition-all hover:bg-border hover:text-text-1 disabled:opacity-30 disabled:cursor-not-allowed'}
        onClick={() => setZoom(z => Math.max(ZOOM_MIN, parseFloat((z - ZOOM_STEP).toFixed(2))))}
        disabled={zoom <= ZOOM_MIN}
        title="Zoom out"
      >−</button>
      <button
        className={compact
          ? `flex items-center justify-center rounded-md border border-border bg-bg text-[14px] font-mono text-text-2 transition-all hover:bg-border ${chromeHeight}`
          : 'h-7 px-2 rounded border border-border bg-bg text-[10px] font-mono text-text-2 hover:bg-border transition-all'}
        onClick={() => setZoom(1)}
      >{compact ? `${Math.round(zoom * 100)}%` : '100%'}</button>
      <button
        className={compact
          ? `flex items-center justify-center rounded-md border border-border bg-bg text-[16px] text-text-2 transition-all hover:bg-border hover:text-text-1 disabled:opacity-30 disabled:cursor-not-allowed ${chromeHeight}`
          : 'w-8 h-8 rounded-md border border-border bg-bg text-[16px] text-text-2 flex items-center justify-center transition-all hover:bg-border hover:text-text-1 disabled:opacity-30 disabled:cursor-not-allowed'}
        onClick={() => setZoom(z => Math.min(ZOOM_MAX, parseFloat((z + ZOOM_STEP).toFixed(2))))}
        disabled={zoom >= ZOOM_MAX}
        title="Zoom in"
      >+</button>
    </>
  )

  const handleTutorialToggle = () => {
    setIsTutorialActive(prev => {
      const next = !prev
      if (next && puzzle) {
        loadedAsSavedRef.current = false
        setShowSuccess(false)
        setShowHint(false)
        setScoreResult(null)
        resetPuzzle(puzzle)
      }
      return next
    })
  }

  /** Interactive-tutorial toggle — header on wide tiers, drawer on compact ones. */
  const renderTutorialToggle = (compact) => (
    <button
      className={`flex items-center justify-center gap-1.5 rounded-md border font-semibold transition-all ${compact ? `px-3 ${chromeText}` : 'px-3 py-1.5 text-xs'} ${chromeHeight} ${
        isTutorialActive
          ? 'bg-teal text-white border-teal shadow-xs'
          : 'border-border bg-bg text-text-2 hover:bg-border hover:text-text-1'
      }`}
      onClick={handleTutorialToggle}
      title="Toggle Interactive Tutorial Guide"
    >
      Tutorial
    </button>
  )

  /** Hint + Guide. `compact` = placed in the header instead of the side panel. */
  const renderAssistance = (compact) => (
    <div data-tutorial="assistance-group" className={compact ? 'flex gap-1.5 shrink-0' : 'flex gap-2'}>
      <button
        data-tutorial="hint-button"
        className={`${compact ? 'shrink-0 px-3' : 'flex-1 px-2.5'} py-2 rounded-lg font-semibold border border-border bg-bg text-text-2 transition-all hover:bg-border/60 hover:text-text-1 flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-bg disabled:hover:text-text-2 ${chromeText} ${chromeHeight}`}
        onClick={handleHint}
        disabled={isComplete}
        title={isComplete ? 'Expression is already simplified' : 'Get a hint for the next step'}
      >
        <span>💡</span> Hint
      </button>
      <button
        data-tutorial="guide-button"
        className={`${compact ? 'shrink-0 px-3' : 'flex-1 px-2'} py-2 rounded-lg font-semibold border border-amber/50 bg-amber-50/80 text-amber-900 transition-all hover:bg-amber-100 hover:border-amber flex items-center justify-center gap-1 shadow-xs disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-amber-50/80 disabled:hover:border-amber/50 ${chromeText} ${chromeHeight}`}
        onClick={handleGuide}
        disabled={isComplete || (!isSandbox && (progress.points ?? 0) < guideCost)}
        title={isSandbox
          ? 'Highlight terms for the next move (free in the sandbox)'
          : isComplete
            ? 'Expression is already simplified'
            : `Highlight terms for the next move (Costs ${guideCost} pts)`}
      >
        <span>🎯</span> Guide <span className="text-[10px] text-amber-700 font-normal">{isSandbox ? '(Free)' : `(${guideCost}p)`}</span>
      </button>
    </div>
  )

  const renderLawsReferenceButton = (compact) => (
    <button
      data-tutorial="laws-reference-button"
      data-testid="laws-sheet-anchor"
      className={compact
        ? `shrink-0 px-3 py-2 bg-bg border border-border rounded-lg font-semibold text-text-2 hover:bg-border/60 transition-all flex items-center justify-center gap-1.5 shadow-xs ${chromeText} ${chromeHeight}`
        : 'w-full py-2 px-3 bg-bg border border-border rounded-lg text-xs font-semibold text-text-2 hover:bg-border/60 transition-all flex items-center justify-between shadow-xs'}
      onClick={() => setShowLawsDrawer(true)}
    >
      {compact
        ? <><span aria-hidden="true">📖</span> Laws</>
        : <><span>📖 Laws Quick Reference</span><span className="text-text-3">→</span></>}
    </button>
  )

  /**
   * Step history. It is the first column on wide tiers; on the tiers that put
   * it in a drawer the SAME element (same `data-tutorial` hook the tutorial
   * overlay and the e2e suites resolve) is rendered inside the overlay.
   */
  const stepHistoryPanel = (
    <aside
      data-tutorial="step-history-panel"
      className={useOverlayHistory
        ? 'w-full h-full min-w-0 bg-white flex flex-col overflow-hidden'
        : 'w-[260px] min-w-[200px] max-w-[300px] bg-white border-r border-border flex flex-col overflow-hidden'}
    >
      <div className={useOverlayHistory
        ? 'px-3 pt-2.5 pb-2 border-b border-border flex items-end justify-between gap-2 shrink-0'
        : 'px-4 pt-3.5 pb-2.5 border-b border-border flex flex-col gap-2'}>
        <div className="flex flex-col gap-2 min-w-0">
          <button
            className={`flex items-center gap-1.5 px-2.5 py-1 font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-all shadow-2xs w-fit ${useOverlayHistory ? 'text-[13px]' : 'text-xs'}`}
            onClick={() => navigate(isSandbox ? '/levels' : `/level/${levelId}/stages`)}
          >
            <span className="font-extrabold text-teal">←</span> {isSandbox ? 'Back to Levels' : 'Back to Stages'}
          </button>
          <div className={`font-bold text-text-2 tracking-[0.5px] uppercase ${useOverlayHistory ? 'text-[15px]' : 'text-[13px]'}`}>Step History</div>
        </div>
        {useOverlayHistory && (
          <button
            type="button"
            data-testid="step-history-close"
            className="shrink-0 w-11 h-11 rounded-lg border border-border bg-bg text-[16px] font-bold text-text-2 hover:bg-border transition-all flex items-center justify-center"
            onClick={() => setShowStepHistory(false)}
            title="Close step history"
          >✕</button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-3.5 py-3 flex flex-col gap-2.5">
        {steps.length === 0 && (
          <div className={`text-text-3 text-center pt-5 ${useOverlayHistory ? 'text-[14px]' : 'text-[13px]'}`}>No steps yet.</div>
        )}
        {steps.map((s, i) => {
          const isInspected = inspectedStepIdx === i
          const isLatest = i === steps.length - 1

          return (
            <div
              key={i}
              data-tutorial={`step-history-card-${i}`}
              onClick={() => setInspectedStepIdx(prev => (prev === i ? null : i))}
              className={`border rounded-xl px-3 py-2.5 font-mono cursor-pointer transition-all ${touchTargets ? 'min-h-[44px] text-[14px]' : 'text-[11px]'} ${
                isInspected
                  ? 'border-sky-400 bg-sky-50 shadow-md ring-2 ring-sky-300/80 -translate-y-px'
                  : isLatest
                  ? 'border-teal bg-teal-light hover:border-teal hover:shadow-xs'
                  : 'border-border bg-bg hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="text-text-2 leading-relaxed">
                <span className="text-text-3 mr-1">F =</span> <ExprText text={s.from} />
              </div>
              <div className="text-text-1 font-semibold leading-relaxed">
                <span className="text-text-3 mr-1">F =</span> <ExprText text={s.to} />
              </div>
              <div
                className={`mt-1.5 inline-flex items-center font-sans font-semibold rounded px-2 py-0.5 transition-colors ${touchTargets ? 'text-[12px]' : 'text-[10px]'} ${
                  isInspected
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-teal bg-white border border-teal'
                }`}
              >
                {s.law}
              </div>
            </div>
          )
        })}
      </div>
      {useOverlayHistory && (
        <div className="shrink-0 border-t border-border bg-bg/40 px-3 py-2.5 flex flex-col gap-2">
          <div className="text-[12px] font-bold tracking-[1px] uppercase text-text-3">Workspace controls</div>
          <div className="flex items-center gap-1.5">
            {renderZoomControls(true)}
            <div className="w-[1px] h-5 bg-border mx-0.5" />
            {renderTutorialToggle(true)}
          </div>
        </div>
      )}
    </aside>
  )

  /** Overlay drawer wrapper used by the tiers that cannot afford a column. */
  const historyDrawer = useOverlayHistory ? (
    <>
      {stepHistoryOpen && (
        <div
          data-testid="step-history-backdrop"
          className="fixed inset-0 z-40 bg-black/30"
          onClick={() => setShowStepHistory(false)}
        />
      )}
      <div
        data-testid="step-history-drawer"
        className={`fixed inset-y-0 left-0 z-50 ${stepHistoryOpen ? 'flex' : 'hidden'}`}
        style={isPhoneLandscape ? { width: '85vw', maxWidth: '320px' } : { width: '360px', maxWidth: '80vw' }}
        aria-hidden={!stepHistoryOpen}
      >
        <div className="flex h-full w-full flex-col overflow-hidden border-r border-border bg-white shadow-2xl">
          {stepHistoryPanel}
        </div>
      </div>
    </>
  ) : null

  /**
   * Applicable-laws / completion panel. It sits under the canvas on every
   * tier except a landscape tablet, where it becomes the right column so the
   * laws stay visible next to the expression.
   */
  const lawsPanel = (
    // ── APPLICABLE LAWS / STAGE COMPLETE BAR ──
    <div
      data-tutorial="laws-dock"
      className={lawsAsStrip
        ? 'border-t-[1.5px] border-border bg-white shrink-0 px-2 py-1.5'
        : lawsAsGrid
          ? 'border-t-[1.5px] border-border p-3 bg-white shrink-0 max-h-[46vh] overflow-y-auto'
          : 'border-t-[1.5px] border-border p-3 px-5 pb-4 bg-white shrink-0'}
    >
      {isComplete ? (
        <div className={`flex items-center justify-between gap-4 flex-wrap ${lawsAsStrip ? 'gap-2 py-0' : 'py-1'}`}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-sm shrink-0">
              ✓
            </div>
            <div>
              <div className={`font-bold text-text-1 ${lawsAsStrip ? 'text-[14px]' : 'text-[13px]'}`}>
                {isSandbox ? 'Problem Simplified! 🎉' : 'Stage Completed! 🎉'}
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
                  className={`px-5 py-2 bg-accent text-white rounded-lg font-semibold transition-all shadow-sm hover:bg-text-1 hover:shadow-md hover:-translate-y-px cursor-pointer ${lawsAsStrip ? 'text-[14px]' : 'text-sm'}`}
                  onClick={() => navigate('/sandbox')}
                >
                  ✎ New expression
                </button>
              ) : (
                <button
                  data-tutorial="randomize-next-btn"
                  className={`px-5 py-2 bg-accent text-white rounded-lg font-semibold transition-all shadow-sm hover:bg-text-1 hover:shadow-md hover:-translate-y-px cursor-pointer ${lawsAsStrip ? 'text-[14px]' : 'text-sm'}`}
                  onClick={() => handleRandomize()}
                >
                  🎲 Randomize
                </button>
              )
            ) : (
              <>
            <button
              data-tutorial="reopen-score-btn"
              className={`px-3.5 py-2 border border-slate-200 text-text-2 font-semibold rounded-lg bg-slate-50 hover:bg-slate-100 hover:text-text-1 transition-all cursor-pointer ${lawsAsStrip ? 'text-[14px]' : 'text-xs'}`}
              onClick={handleOpenScoreSummary}
            >
              📊 Score Summary
            </button>
            {level && stageNum + 1 < level.puzzles.length ? (
              <button
                data-tutorial="next-stage-btn"
                className={`px-5 py-2 bg-accent text-white rounded-lg font-semibold transition-all shadow-sm hover:bg-text-1 hover:shadow-md hover:-translate-y-px ${lawsAsStrip ? 'text-[14px]' : 'text-sm'}`}
                onClick={handleNextStage}
              >
                Next Stage →
              </button>
            ) : (
              <button
                data-tutorial="next-stage-btn"
                className={`px-5 py-2 bg-accent text-white rounded-lg font-semibold transition-all shadow-sm hover:bg-text-1 hover:shadow-md hover:-translate-y-px ${lawsAsStrip ? 'text-[14px]' : 'text-sm'}`}
                onClick={() => navigate(`/level/${levelId}/stages`)}
              >
                Back to Stages
              </button>
            )}
              </>
            )}
          </div>
        </div>
      ) : lawsAsStrip ? (
        /* Phone landscape / narrow window: one thumb-reachable, horizontally
           scrollable rail. It carries ONLY the laws that apply right now — the
           full reference lives behind the Laws button so the strip cannot turn
           into a wall of chips. */
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-[14px] font-bold tracking-[1px] uppercase text-text-3 whitespace-nowrap">Laws</span>
          <div
            data-testid="laws-list"
            data-layout="strip"
            ref={lawsStripRef}
            className="praxis-rail items-stretch flex-1 min-w-0 min-h-[44px] py-0.5"
          >
            {applicableLaws.length === 0 && (
              <span className="shrink-0 inline-flex min-h-[44px] items-center px-1 text-[14px] text-text-3 italic">
                {sel.length === 0 ? '← Select a term to begin' : 'No laws apply — try again'}
              </span>
            )}
            {applicableLaws.map((law, i) => (
              <button
                key={i}
                data-tutorial={`law-card-${i}`}
                data-law-id={law.id}
                className="snap-start shrink-0 min-h-[44px] min-w-[180px] max-w-[260px] bg-white border-[1.5px] border-border rounded-md px-3 py-1.5 text-left cursor-pointer transition-all hover:border-text-1 hover:bg-bg flex flex-col justify-center"
                onClick={() => onApplyLaw(law)}
              >
                <div className="text-[14px] font-semibold text-text-1 leading-tight">{law.name}</div>
                <div className="font-mono text-[14px] text-teal leading-tight">{law.formula}</div>
              </button>
            ))}
            <button
              type="button"
              data-testid="laws-rail-reference"
              className="snap-start shrink-0 min-h-[44px] inline-flex items-center gap-1.5 rounded-md border border-dashed border-border bg-bg px-3 text-[14px] font-semibold text-text-2 cursor-pointer transition-all hover:bg-border/60 hover:text-text-1"
              onClick={() => setShowLawsDrawer(true)}
            >
              <span aria-hidden="true">📖</span> All laws
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className={`flex items-center gap-3 ${lawsAsGrid ? 'mb-2' : 'mb-2.5'}`}>
            <span className={`font-bold tracking-[1px] uppercase text-text-3 whitespace-nowrap ${touchTargets ? 'text-[14px]' : 'text-[11px]'}`}>APPLICABLE LAWS</span>
            {applicableLaws.length === 0 && (
              <span className={`text-text-3 italic ${touchTargets ? 'text-[14px]' : 'text-xs'}`}>
                {sel.length === 0 ? '← Select a term or variable to begin' : 'No laws apply — try a different selection'}
              </span>
            )}
          </div>
          {applicableLaws.length > 0 && (
            <div
              data-testid="laws-list"
              data-layout={lawsAsGrid ? 'grid' : 'wrap'}
              className={lawsAsGrid ? 'grid grid-cols-2 lg:grid-cols-3 gap-2' : 'flex flex-wrap gap-2'}
            >
              {applicableLaws.map((law, i) => (
                <button
                  key={i}
                  data-tutorial={`law-card-${i}`}
                  data-law-id={law.id}
                  className={`bg-white border-[1.5px] border-border rounded-md px-3.5 py-2.5 text-left cursor-pointer transition-all hover:border-text-1 hover:bg-bg hover:shadow-sm hover:-translate-y-[1px] ${lawsAsGrid ? 'min-h-[44px] w-full' : 'min-w-[160px] max-w-[240px]'}`}
                  onClick={() => onApplyLaw(law)}
                >
                  <div className={`font-semibold text-text-1 mb-0.5 ${touchTargets ? 'text-[14px]' : 'text-[13px]'}`}>{law.name}</div>
                  <div className={`font-mono text-teal mb-1 ${touchTargets ? 'text-[13px]' : 'text-[11px]'}`}>{law.formula}</div>
                  <div className="text-[12px] text-text-3 leading-tight">{law.desc}</div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )

  /**
   * Undo / Reset. They live in the first header row on wide tiers and in the
   * compact control rail on the tiers that have no side column.
   */
  const undoResetGroup = (
    <div data-tutorial="undo-reset-group" className="flex items-center gap-1.5 shrink-0">
      <button
        data-tutorial="undo-button"
        className={`flex items-center gap-1.5 rounded-md border-[1.5px] border-border bg-bg font-semibold text-text-2 transition-all hover:bg-border hover:text-text-1 disabled:opacity-40 disabled:cursor-not-allowed ${compactHeader ? 'px-2.5 py-1.5' : 'px-3 py-1.5 text-xs'} ${chromeText} ${chromeHeight}`}
        onClick={handleUndo}
        disabled={steps.length === 0}
        title="Undo last step"
      >
        <span>↶</span> Undo
      </button>

      <button
        data-tutorial="reset-button"
        className={`flex items-center gap-1.5 rounded-md border-[1.5px] border-border bg-bg font-semibold text-text-2 transition-all hover:bg-border hover:text-text-1 ${compactHeader ? 'px-2.5 py-1.5' : 'px-3 py-1.5 text-xs'} ${chromeText} ${chromeHeight}`}
        onClick={handleResetClick}
        title="Reset problem to start"
      >
        <span>↺</span> Reset
      </button>
    </div>
  )

  return (
    <div className={isPhoneLandscape ? 'flex h-[100dvh] overflow-hidden bg-bg' : 'flex h-screen overflow-hidden bg-bg'}>
      {!useOverlayHistory && stepHistoryPanel}
      {historyDrawer}

      {/* ── CENTER PANEL: Expression Workspace ── */}
      <main className={`flex-1 flex flex-col bg-white border border-border rounded-xl shadow-sm overflow-hidden ${isPhoneLandscape ? 'm-1.5' : 'm-3'}`}>
        {/* Center header. Compact tiers split it in two rows: identity + primary
            action on top, then a horizontally scrollable control rail. A single
            row could not hold every control at 844x390 without clipping the
            right-most button ("Laws") off the screen. */}
        <div className={compactHeader
          ? 'px-2.5 py-1.5 border-b border-border flex flex-col gap-1.5 shrink-0'
          : 'px-5 py-3.5 border-b border-border flex items-center justify-between'}>
          <div className={compactHeader ? 'flex items-center justify-between gap-2 min-w-0 w-full' : 'contents'}>
          <div className="flex items-center gap-2 min-w-0">
            {/* Direct Back to Stages / Levels navigation button */}
            <button
              type="button"
              data-testid="header-back-button"
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 hover:border-slate-400 text-slate-800 font-bold transition-all shadow-xs active:scale-95 cursor-pointer ${compactHeader ? 'text-xs min-h-[36px]' : 'text-xs min-h-[34px]'} ${chromeHeight}`}
              onClick={() => navigate(isSandbox ? '/levels' : `/level/${levelId}/stages`)}
              title={isSandbox ? 'Back to Levels' : 'Back to Stages Overview'}
            >
              <span className="text-sm font-extrabold text-teal leading-none">←</span>
              <span className="whitespace-nowrap">{isSandbox ? 'Levels' : 'Stages'}</span>
            </button>

            {useOverlayHistory && (
              <button
                type="button"
                data-testid="step-history-toggle"
                className={`shrink-0 rounded-lg border border-border bg-bg text-[16px] leading-none text-text-2 transition-all hover:bg-border hover:text-text-1 flex items-center justify-center ${chromeHeight}`}
                onClick={() => setShowStepHistory(prev => !prev)}
                title={stepHistoryOpen ? 'Hide step history' : 'Show step history'}
                aria-expanded={stepHistoryOpen}
              >☰</button>
            )}
            <div className="min-w-0">
              <div className="text-[15px] font-bold text-text-1 truncate">
                {workspaceTitle}
              </div>
              <div className={`text-text-3 mt-0.5 truncate ${compactHeader ? 'text-[14px]' : 'text-[11px]'}`}>
                {workspaceSubtitle}
              </div>
            </div>
          </div>
          <div className={`flex items-center ${compactHeader ? 'gap-1 shrink-0' : 'gap-1.5'}`}>
            {/* Compact tiers fold the side panel's status card into the header */}
            {compactHeader && (isSandbox ? (
              <div
                data-tutorial="sandbox-notice"
                title="Sandbox practice — no points, stars or progress are recorded"
                className={`shrink-0 inline-flex items-center gap-1 px-2.5 rounded-lg border border-sky-200 bg-sky-50/70 font-semibold text-sky-900 ${chromeText} ${chromeHeight}`}
              >
                <span aria-hidden="true">🧪</span>
                <span data-tutorial="sandbox-stats">{steps.length}{optimalSteps > 0 ? `/${optimalSteps}` : ''}</span>
              </div>
            ) : (
              <div
                data-tutorial="points-card"
                title="Total points"
                className={`shrink-0 inline-flex items-center gap-1 px-2.5 rounded-lg border border-amber/40 bg-amber-50/70 font-extrabold text-amber-600 ${chromeText} ${chromeHeight}`}
              >
                <span aria-hidden="true">⭐</span>{progress.points ?? 0}
              </div>
            ))}

            {/* Sandbox (random mode) only: randomize the problem */}
            {isSandbox && !isCustomSandbox && (
              <>
                <button
                  id="randomize-btn"
                  className={`shrink-0 flex items-center gap-1.5 rounded-md border-[1.5px] border-teal bg-teal-light font-bold text-sky-700 transition-all hover:bg-teal hover:text-white hover:border-teal cursor-pointer ${compactHeader ? 'px-2.5 py-1.5' : 'px-3.5 py-1.5 text-xs'} ${chromeText} ${chromeHeight}`}
                  onClick={() => handleRandomize()}
                  title="Swap in a new random, solver-verified problem"
                >
                  <span className="text-sm leading-none">🎲</span> Randomize
                </button>
                {!headerControlRail && <div className="w-[1px] h-4 bg-border mx-1" />}
              </>
            )}

            {/* Custom sandbox: the typed expression is the only problem — go back and type another */}
            {isSandbox && isCustomSandbox && (
              <>
                <button
                  data-tutorial="new-expression-btn"
                  className={`shrink-0 flex items-center gap-1.5 rounded-md border-[1.5px] border-teal bg-teal-light font-bold text-sky-700 transition-all hover:bg-teal hover:text-white hover:border-teal cursor-pointer ${compactHeader ? 'px-2.5 py-1.5' : 'px-3.5 py-1.5 text-xs'} ${chromeText} ${chromeHeight}`}
                  onClick={() => navigate('/sandbox')}
                  title="Type a different expression"
                >
                  <span className="text-sm leading-none" aria-hidden="true">✎</span> New expression
                </button>
                {!headerControlRail && <div className="w-[1px] h-4 bg-border mx-1" />}
              </>
            )}

            {/* Wide tiers: zoom, undo/reset and the tutorial toggle stay inline.
                Compact tiers move them into the control rail or the drawer. */}
            {!headerControlRail && (
              <>
                {renderZoomControls(false)}

                <div className="w-[1px] h-4 bg-border mx-1" />

                {undoResetGroup}

                <div className="w-[1px] h-4 bg-border mx-1" />

                {/* Interactive Tutorial Button */}
                {renderTutorialToggle(false)}
              </>
            )}
          </div>
          </div>

          {/* Compact control rail: the same hooks, one thumb-reachable row that
              wraps (and scrolls) instead of overflowing the viewport. A very
              narrow window wraps it into two short rows so no control is ever
              half off the screen. */}
          {headerControlRail && (
            <div
              data-testid="header-control-rail"
              className="praxis-rail flex-wrap items-center gap-1.5 w-full pb-0.5"
            >
              {undoResetGroup}
              {renderAssistance(true)}
              {renderLawsReferenceButton(true)}
            </div>
          )}
        </div>


        {/* Expression workspace — grid bg + derivation chain */}
        <div className={`flex-1 flex flex-col bg-white bg-[linear-gradient(rgba(0,0,0,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.045)_1px,transparent_1px)] bg-[size:28px_28px] relative ${isPhoneLandscape ? 'min-h-0 justify-start items-stretch' : 'min-h-[400px] justify-start items-stretch'} ${touchTargets ? 'overflow-auto [-webkit-overflow-scrolling:touch]' : 'overflow-hidden'} ${isAnimating ? 'pointer-events-none opacity-90' : ''}`}>
          {isAnimating && <AnimationOverlay data={animationData} />}

          {/* Status banner — placed in flow at top so it NEVER overlays equations */}
          {status !== 'select' && (
            <div className="w-full flex justify-center items-center px-4 pt-3 pb-1 z-20 shrink-0 select-none">
              <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold tracking-[0.1px] shadow-sm border-[1.5px] max-w-[95%] sm:max-w-xl text-center transition-all duration-200
                ${status === 'error' ? 'bg-red-100 text-red-700 border-red-300' : ''}
                ${status === 'laws' ? 'bg-teal-light text-sky-700 border-sky-300' : ''}
                ${status === 'success' ? 'bg-green-light text-green-800 border-green-300' : ''}
              `}>
                {status === 'success' && <span className="text-xs font-bold shrink-0">✓</span>}
                {status === 'error'   && <span className="text-xs font-bold shrink-0">✕</span>}
                {status === 'laws'    && <span className="text-xs font-bold shrink-0">→</span>}
                <span className="leading-snug break-words">{statusMsg}</span>
              </div>
            </div>
          )}

          <div className={isPhoneLandscape
            ? 'relative w-full flex-1 flex flex-col items-start justify-start py-1'
            : 'relative w-full flex-1 flex flex-col justify-center items-center py-2'}>

            {/* Zoom wrapper — scales the entire expression block.
                In sandbox mode the nonce forces a clean remount on randomize so
                no stale selection/animation state can leak into a new problem. */}
            <div data-tutorial="canvas" key={isSandbox ? sandboxNonce : undefined} style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', transition: 'transform 0.18s ease' }}>
              {/* Custom sandbox: keep the typed expression in view so the
                  derivation can always be compared with what was asked for. */}
              {isCustomSandbox && (
                <div
                  data-testid="custom-expression-label"
                  className={`mb-2 flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50/80 px-3 py-1.5 ${isPhoneLandscape ? 'text-[14px]' : 'text-[12px]'}`}
                >
                  <span className="font-bold uppercase tracking-wider text-sky-900/70">Your expression</span>
                  <span className={`font-mono font-semibold text-sky-900 whitespace-nowrap ${isPhoneLandscape ? 'text-[16px]' : 'text-[15px]'}`}>
                    {customPuzzle.expr}
                  </span>
                </div>
              )}
              {/* Derivation chain — clean FIFO top-to-bottom queue */}
            {expr && (() => {
              const totalSteps = steps.length

              // Build unified list of derivation lines
              const lines = []
              if (totalSteps === 0) {
                lines.push({
                  key: 'active-0',
                  isFirst: true,
                  isActive: true,
                  text: null,
                  stepIdx: null,
                  law: null,
                })
              } else {
                // Line 0: Starting problem
                lines.push({
                  key: 'past-0',
                  isFirst: true,
                  isActive: false,
                  text: steps[0].from,
                  stepIdx: 0,
                  law: steps[0].law,
                })
                // Intermediate lines
                for (let i = 1; i < totalSteps; i++) {
                  lines.push({
                    key: `past-${i}`,
                    isFirst: false,
                    isActive: false,
                    text: steps[i - 1].to,
                    stepIdx: i,
                    law: steps[i].law,
                  })
                }
                // Active bottom line
                lines.push({
                  key: `active-${totalSteps}`,
                  isFirst: false,
                  isActive: true,
                  text: null,
                  stepIdx: null,
                  law: null,
                })
              }

              return (
                <motion.div
                  layout
                  className="flex flex-col gap-3 font-mono text-[22px] font-medium items-start select-none"
                  onClick={() => setInspectedStepIdx(null)}
                >
                  {lines.map((line, idx) => {
                    const isFromInspected = line.stepIdx !== null && inspectedStepIdx === line.stepIdx
                    const isToInspected = idx > 0 && inspectedStepIdx === idx - 1
                    const isLineHighlighted = isFromInspected || isToInspected
                    return (
                      <motion.div
                        layout
                        key={line.key}
                        initial={{ opacity: 0, y: line.isActive && idx > 0 ? 6 : 0 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
                        className="relative flex items-center min-h-[44px] gap-2.5"
                      >
                        {/* Stepper Left Rail: Dot + Symmetrical Connector Line (Independent Column with z-30) */}
                        <div className="relative flex items-center justify-center w-6 self-stretch shrink-0 select-none z-30">
                          {/* Downward connector line centered exactly between node i and node i+1 */}
                          {line.stepIdx !== null && (
                            <button
                              type="button"
                              data-inspect-trigger="true"
                              onClick={(e) => {
                                e.stopPropagation()
                                setInspectedStepIdx(prev => (prev === line.stepIdx ? null : line.stepIdx))
                              }}
                              className="group absolute top-[calc(50%+8px)] left-1/2 -translate-x-1/2 w-6 h-[calc(100%-4px)] flex items-center justify-center cursor-pointer p-0 bg-transparent border-0 z-30"
                              title={`Click to inspect ${line.law}`}
                            >
                              {/* Symmetrical vertical line */}
                              <div
                                className={`w-[2px] h-full rounded-full transition-all duration-200 ${
                                  inspectedStepIdx === line.stepIdx
                                    ? 'bg-teal w-[3px] shadow-sm'
                                    : 'bg-slate-300 group-hover:bg-teal group-hover:w-[3px]'
                                }`}
                              />
                            </button>
                          )}

                          {/* Node Dot */}
                          {isLineHighlighted ? (
                            <div className="relative z-30 w-3 h-3 rounded-full bg-teal ring-4 ring-teal/20 shadow-xs transition-all duration-200" />
                          ) : line.isActive ? (
                            <div className="relative z-30 flex items-center justify-center w-4 h-4 rounded-full border-2 border-teal bg-white shadow-xs transition-all">
                              <div className="w-1.5 h-1.5 rounded-full bg-teal animate-pulse" />
                            </div>
                          ) : (
                            <div className="relative z-30 w-2.5 h-2.5 rounded-full bg-slate-300 transition-all duration-200" />
                          )}

                          {/* The law-explanation card and the step-inspection tip
                              used to live here, absolutely anchored to this 24px
                              rail cell with `right-full`. That parked them over
                              the expression (and, on compact tiers, over the law
                              dock) with no viewport clamp. They are now rendered
                              by the collision-aware fixed layer at the end of
                              this component, which points them at this line. */}
                        </div>

                        {/* Formula Display with Highlight Box wrapping ONLY the equation */}
                        <div
                          data-tutorial={line.isActive ? "active-equation" : undefined}
                          className={`relative flex items-baseline gap-1.5 px-3 py-1.5 rounded-xl border transition-all duration-300 ${
                            isLineHighlighted
                              ? 'border-sky-300 bg-sky-50/70 shadow-xs ring-1 ring-sky-200/60'
                              : 'border-transparent'
                          }`}
                        >
                          <span
                            className={`font-mono text-[22px] whitespace-pre shrink-0 select-none mr-1 transition-colors duration-300 ${
                              isLineHighlighted ? 'text-teal font-semibold' : 'text-text-2 font-medium'
                            }`}
                          >
                            {line.isFirst ? 'F =' : '\u00a0\u00a0='}
                          </span>
                          {line.isActive ? (
                            <ExpressionDisplay
                              expr={expr}
                              sel={sel}
                              onClickLit={onClickLit}
                              onClickNot={onClickNot}
                              onClickTerm={onClickTerm}
                              onSwapTerms={swapTerms}
                              activeGuidePaths={activeGuidePaths}
                              animationPaths={isAnimating ? animationData?.paths : []}
                              animationLaw={isAnimating ? animationData?.lawId : null}
                              touchTargets={touchTargets}
                            />
                          ) : (
                            <ExprText
                              text={line.text}
                              className={isLineHighlighted ? 'text-slate-900 font-semibold' : 'text-text-1'}
                            />
                          )}
                        </div>
                      </motion.div>
                    )
                  })}
                </motion.div>
              )
            })()}
            </div>{/* end zoom wrapper */}

            {/* The hint bubble is no longer an inline flex sibling: in flow it
                pushed the canvas content and was clipped by the scrollable
                canvas on a 320px-tall phone. It renders in the collision layer
                below instead. */}
          </div>
        </div>


        {!lawsInRightColumn && lawsPanel}
      </main>

      {/* ── RIGHT PANEL: Level Progress, Points, Assistance & Stages ──
           Hidden on the tiers that fold it into the header / bottom dock. */}
      {showRightPanel && (
      <aside className={lawsInRightColumn
        ? 'w-[300px] min-w-[260px] bg-white border-l border-border flex flex-col overflow-hidden'
        : 'w-[280px] min-w-[240px] bg-white border-l border-border flex flex-col overflow-hidden'}>
        {/* Top: Stage / Level Progress (sandbox shows problem stats instead) */}
        {isSandbox ? (
          <div data-tutorial="sandbox-stats" className="border-b border-border p-3.5 pt-4 bg-bg/30">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold tracking-[1px] uppercase text-text-3">SANDBOX</span>
              <span className="text-xs font-bold text-sky-700">{isCustomSandbox ? 'Custom' : 'Free Practice'}</span>
            </div>
            <div className="h-1.5 bg-border rounded-full mb-2 overflow-hidden">
              <div
                className="h-full bg-teal transition-all duration-300 rounded-full"
                style={{ width: `${optimalSteps > 0 ? Math.min(100, (steps.length / optimalSteps) * 100) : (isComplete ? 100 : 0)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10.5px] text-text-3 font-medium">
              <span>{isCustomSandbox ? 'Your expression' : 'Random problem'}</span>
              <span>
                <span className="font-bold text-text-2">{steps.length}</span> steps
                {optimalSteps > 0 && <span> · optimal {optimalSteps}</span>}
              </span>
            </div>
          </div>
        ) : (
        <div className="border-b border-border p-3.5 pt-4 bg-bg/30">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold tracking-[1px] uppercase text-text-3">LEVEL PROGRESS</span>
            <span className="text-xs font-bold text-teal">{completedSet.size} / {level?.puzzles.length ?? '?'} Completed</span>
          </div>
          <div className="h-1.5 bg-border rounded-full mb-1.5 overflow-hidden">
            <div
              className="h-full bg-teal transition-all duration-300 rounded-full"
              style={{ width: `${level && level.puzzles.length > 0 ? (completedSet.size / level.puzzles.length) * 100 : 0}%` }}
            />
          </div>
          <div className="text-[10.5px] text-text-3 font-medium">
            {level?.name || 'Level Stages'}
          </div>
        </div>
        )}

        {/* Middle: User Points & Assistance Controls (Replaced Target Box) */}
        <div data-tutorial="points-and-assistance" className="p-3.5 border-b border-border flex flex-col gap-2.5 bg-white">
          {/* User Points Card — sandbox play is unscored, so it shows a notice instead */}
          {isSandbox ? (
            <div data-tutorial="sandbox-notice" className="flex items-start gap-2.5 px-3.5 py-2.5 bg-sky-50/70 border border-sky-200 rounded-xl">
              <span className="text-lg leading-none">🧪</span>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-sky-900/80">SANDBOX MODE</div>
                <div className="text-[11px] text-sky-900/90 leading-snug mt-0.5">
                  Free practice — no points, stars, or progress are recorded.
                </div>
              </div>
            </div>
          ) : (
          <div data-tutorial="points-card" className="flex items-center justify-between px-3.5 py-2.5 bg-amber-50/70 border border-amber/40 rounded-xl">
            <div className="flex items-center gap-2">
              <span className="text-lg">⭐</span>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-900/80">TOTAL POINTS</div>
                <div className="text-base font-extrabold text-amber-600 leading-none mt-0.5">
                  {progress.points ?? 0} <span className="text-[11px] font-semibold text-amber-700">pts</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold text-teal bg-teal/10 border border-teal/30 px-2 py-0.5 rounded-full">
                +10 to +15 on clear
              </span>
            </div>
          </div>
          )}

          {/* Sandbox random mode: ONE clear randomizer. The easy/medium/hard
              picker was removed at the user's request — the generator keeps its
              documented default preset, it is simply no longer a user setting. */}
          {isSandbox && !isCustomSandbox && (
            <button
              type="button"
              className="w-full py-2 rounded-lg border-[1.5px] border-teal bg-teal-light text-xs font-bold text-sky-700 hover:bg-teal hover:text-white hover:border-teal transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              onClick={() => handleRandomize()}
            >
              <span>🎲</span> New Random Problem
            </button>
          )}

          {/* Hint & Guide. Folded into the header when there is no side panel. */}
          {!assistanceInHeader && (
            <>
              {renderAssistance(false)}
              {renderLawsReferenceButton(false)}
            </>
          )}
        </div>

        {/* Level Puzzles List (Quick Stage Select) — replaced by the laws column
            on a landscape tablet, hidden entirely in sandbox mode. */}
        {lawsInRightColumn ? lawsPanel : (
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1.5">
          {isSandbox ? (
            <div className="text-[10.5px] text-text-3 leading-relaxed px-1 pt-1">
              <div className="font-bold tracking-[1px] uppercase text-text-3 mb-2">HOW IT WORKS</div>
              {isCustomSandbox ? (
                <>
                  <p className="mb-2">
                    This is the expression you typed. The engine always has a legal path back to its simplest
                    form, so every step you find is checked against the laws.
                  </p>
                  <p>
                    Press <span className="font-bold text-sky-700">✎ New expression</span> any time to go back and
                    type a different one — your current derivation is discarded.
                  </p>
                </>
              ) : (
                <>
                  <p className="mb-2">
                    Every problem is generated from an inverse Boolean law, so the engine can always simplify it back down.
                  </p>
                  <p>
                    Press <span className="font-bold text-sky-700">🎲 New Random Problem</span> any time to swap in a
                    fresh expression — your current derivation is discarded.
                  </p>
                </>
              )}
            </div>
          ) : (
          <>
          {/* Review Mode Reminder Card */}
          {isComplete && !showSuccess && !dismissReviewReminder && level && stageNum + 1 < level.puzzles.length && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="bg-emerald-50 border border-emerald-500/60 rounded-xl p-2.5 mb-1.5 flex flex-col gap-2 shadow-2xs"
            >
              <div className="flex items-start gap-2">
                <span className="relative flex h-2 w-2 mt-1 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <div className="text-[11.5px] leading-snug font-semibold text-emerald-950">
                  When you're ready, press the next stage.
                </div>
              </div>
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setDismissReviewReminder(true)}
                  className="px-3 py-0.5 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-[11px] font-bold transition-all cursor-pointer shadow-2xs"
                >
                  Okay
                </button>
              </div>
            </motion.div>
          )}

          <div className="flex items-center justify-between mb-1.5 px-1">
            <span className="text-[11px] font-bold tracking-[1px] uppercase text-text-3">STAGES</span>
            <button
              type="button"
              onClick={() => navigate(`/level/${levelId}/stages`)}
              className="text-xs font-bold text-teal hover:text-teal-600 hover:underline flex items-center gap-0.5 transition-colors cursor-pointer"
              title="View all stages overview"
            >
              All Stages →
            </button>
          </div>
          {level?.puzzles.map((p, idx) => {
            const isCurrent = idx === stageNum
            const isCompleted = completedSet.has(idx)
            const isAvailable = idx === 0 || completedSet.has(idx - 1) || isCompleted
            const isLocked = !isAvailable && !isCompleted
            const isNextAvailable = isComplete && !showSuccess && idx === stageNum + 1 && (idx === 0 || completedSet.has(idx - 1) || isCompleted)

            return (
              <button
                key={p.id || idx}
                disabled={isLocked || isTutorialActive}
                onClick={() => {
                  if (!isLocked && !isTutorialActive && levelId) {
                    const isTutLevel = Number(levelId) === 0
                    const tutParam = isTutLevel ? '?tutorial=true' : ''
                    navigate(`/level/${levelId}/stage/${idx}${tutParam}`)
                  }
                }}
                className={`flex items-center justify-between p-2.5 rounded-lg text-left transition-all border ${
                  isTutorialActive
                    ? isCurrent
                      ? 'bg-teal/10 border-teal text-teal font-bold shadow-xs'
                      : 'bg-transparent border-transparent text-text-3 opacity-40 cursor-not-allowed pointer-events-none'
                    : isNextAvailable
                    ? 'ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50 text-emerald-800 font-bold shadow-md animate-pulse cursor-pointer'
                    : isCurrent
                    ? 'bg-teal/10 border-teal text-teal font-bold shadow-xs'
                    : isCompleted
                    ? 'bg-bg/50 border-transparent text-text-2 hover:bg-bg hover:border-border cursor-pointer'
                    : isAvailable
                    ? 'bg-transparent border-border text-text-1 hover:bg-bg cursor-pointer'
                    : 'bg-transparent border-transparent text-text-3 opacity-40 cursor-not-allowed pointer-events-none'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs w-4">{idx + 1}.</span>
                  <span className="font-mono text-xs">{p.initial || `Stage ${idx + 1}`}</span>
                </div>
                {isNextAvailable && (
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Next →</span>
                )}
                {!isNextAvailable && isCompleted && <span className="text-teal text-xs font-bold">✓</span>}
                {!isNextAvailable && isLocked && <span className="text-xs text-text-3 opacity-60">🔒</span>}
              </button>
            )
          })}
          </>
          )}
        </div>
        )}
      </aside>
      )}

      {/* ── LAWS QUICK REFERENCE ──
           Wide + tall viewports get the side drawer; narrow windows and short
           landscape phones get a full-width bottom sheet, so the close button
           and every formula stay reachable instead of being clipped. */}
      <AnimatePresence>
        {showLawsDrawer && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/25"
              onClick={() => setShowLawsDrawer(false)}
            />
            <motion.div
              data-testid={lawsSheet ? 'laws-sheet' : 'laws-drawer'}
              ref={lawsPanelNode}
              initial={lawsSheet ? { y: '18%' } : { x: '100%' }}
              animate={lawsSheet ? { y: 0 } : { x: 0 }}
              exit={lawsSheet ? { y: '18%' } : { x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 350 }}
              style={{
                top: `${Math.round(lawsPanelBand ? lawsPanelBand.top : 0)}px`,
                maxHeight: `${Math.round(lawsPanelBand ? lawsPanelBand.maxHeight : 0)}px`,
                opacity: lawsPanelReady ? 1 : 0,
                pointerEvents: lawsPanelReady ? 'auto' : 'none',
              }}
              className="praxis-sheet-panel fixed inset-x-0 z-50 bg-white border-t border-border shadow-2xl flex flex-col will-change-transform"
            >
              <div className={`flex items-center justify-between bg-bg ${lawsSheet ? 'px-4 py-2 shrink-0' : 'p-4'}`}>
                <div className="font-bold text-sm text-text-1 flex items-center gap-2">
                  <span>📖</span> Boolean Laws Reference
                </div>
                <button
                  type="button"
                  data-testid="laws-close"
                  className="praxis-touch-target rounded-md hover:bg-border text-text-3 hover:text-text-1 flex items-center justify-center font-bold text-sm transition-colors"
                  onClick={() => setShowLawsDrawer(false)}
                  title="Close the laws reference"
                >
                  ✕
                </button>
              </div>
              <div className={`flex-1 overflow-y-auto overscroll-contain p-4 flex flex-col gap-3 ${lawsSheet ? 'praxis-safe-b' : ''}`}>
                {laws && laws.map(law => (
                  <div key={law.id} className="bg-bg border border-border rounded-lg p-3.5 text-left">
                    <div className="text-[13px] font-bold text-text-1 mb-1">{law.name}</div>
                    <div className="flex flex-col gap-1 my-2 bg-white border border-border rounded px-3 py-2 shadow-xs">
                      {law.formulas && law.formulas.map((f, idx) => (
                        <div key={idx} className="font-mono text-xs font-semibold text-text-1">{f}</div>
                      ))}
                    </div>
                    <div className="text-[12px] text-text-3 leading-relaxed mt-2">{law.desc}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── SUCCESS OVERLAY ── */}
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
            onClick={() => setShowSuccess(false)}
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
                        onClick={() => navigate('/sandbox')}
                      >
                        ✎ New expression
                      </button>
                    ) : (
                      <button
                        data-tutorial="randomize-modal-btn"
                        className={`flex-1 bg-accent text-white rounded-lg font-semibold text-sm transition-all shadow-md hover:bg-text-1 hover:shadow-lg hover:-translate-y-px cursor-pointer ${shortViewport ? 'py-2.5' : 'py-3'}`}
                        onClick={() => handleRandomize()}
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
                      onClick={handleNextStage}
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
                      onClick={() => navigate(`/level/${levelId}/stages`)}
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
                    onClick={executeReset}
                  >
                    {isSandbox ? 'Replay' : 'Try Again'}
                  </button>
                </div>

                {/* Review Completed Derivation Button */}
                <button
                  data-tutorial="review-derivation-btn"
                  className={`w-full border border-slate-200 text-text-2 font-semibold text-xs rounded-lg bg-slate-50 transition-all hover:bg-slate-100 hover:text-text-1 flex items-center justify-center gap-1.5 cursor-pointer ${shortViewport ? 'py-2' : 'py-2.5'}`}
                  onClick={() => setShowSuccess(false)}
                >
                  <span>🔍</span> Review Completed Derivation
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── RESET CONFIRMATION MODAL ── */}
      {showResetConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/30 backdrop-blur-[2px] cursor-pointer"
          onClick={() => setShowResetConfirm(false)}
        >
          <div
            className={`bg-white rounded-2xl flex flex-col shadow-2xl max-w-[380px] w-full border border-border cursor-default praxis-modal-panel ${shortViewport ? 'p-4' : 'p-6'}`}
            onClick={e => e.stopPropagation()}
          >
            <div className={`flex items-center gap-3 ${shortViewport ? 'mb-2' : 'mb-3'}`}>
              <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-lg font-bold shrink-0">
                ↺
              </div>
              <div>
                <h3 className="text-[16px] font-bold text-text-1">
                  {isSandbox ? 'Reset this problem?' : 'Reset this stage?'}
                </h3>
                <p className="text-xs text-text-3 mt-0.5">
                  {isSandbox
                    ? 'This clears your current derivation so you can solve the same random problem again.'
                    : 'Are you sure you want to reset the stage? This will clear your current derivation so you can solve it from scratch.'}
                </p>
              </div>
            </div>

            {/* Don't ask me again checkbox */}
            <label className={`flex items-center gap-2.5 px-1 cursor-pointer select-none ${shortViewport ? 'mt-1 mb-3' : 'mt-2 mb-5'}`}>
              <input
                type="checkbox"
                checked={dontAskResetAgain}
                onChange={e => setDontAskResetAgain(e.target.checked)}
                className="w-4 h-4 rounded border-border text-teal focus:ring-teal cursor-pointer accent-teal"
              />
              <span className="text-xs text-text-2 font-medium">Don't ask me again for this session</span>
            </label>

            {/* Action buttons: Go back & Reset */}
            <div className="praxis-modal-actions flex items-center gap-3 w-full mt-1 pt-1">
              <button
                type="button"
                className="flex-1 py-2.5 px-4 text-xs font-bold text-text-2 bg-bg hover:bg-border/70 hover:text-text-1 border border-border rounded-xl transition-all shadow-xs"
                onClick={() => setShowResetConfirm(false)}
              >
                Go back
              </button>
              <button
                type="button"
                className="flex-1 py-2.5 px-4 text-xs font-bold text-white bg-red hover:opacity-90 rounded-xl transition-all shadow-sm active:scale-[0.98]"
                style={{ backgroundColor: '#ef4444', color: '#ffffff' }}
                onClick={executeReset}
              >
                Reset Stage
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── NON-BLOCKING POPUP LAYER ──
           Hint bubble + step-inspection tip + law-explanation card. One fixed
           layer, collision-aware, clamped into the viewport, never over the
           controls the learner still needs (see useCollisionPlacement). */}
      <div
        data-testid="hint-bubble-layer"
        style={{ ...hintPopupStyle, pointerEvents: 'none' }}
        aria-hidden={!showHint}
      >
        <div ref={hintPopupNode}>
          {showHint && (
            <div
              data-testid="hint-bubble"
              className={`flex items-start gap-2 px-3.5 py-2.5 bg-amber-50 border border-amber rounded-lg text-amber-900 shadow-sm pointer-events-auto ${
                isPhoneLandscape || isNarrowViewport ? 'text-[14px]' : 'text-[13px]'
              } ${hintPopupReady ? 'opacity-100' : 'opacity-0'}`}
              style={{ width: '100%', transition: 'opacity 0.12s ease' }}
            >
              <span className="text-base leading-none shrink-0">💡</span>
              <span className="leading-snug">{currentHint}</span>
              <button
                type="button"
                data-testid="hint-bubble-close"
                className="ml-auto shrink-0 -mr-1 -mt-0.5 w-6 h-6 rounded-md text-amber-800/70 hover:text-amber-900 hover:bg-amber-100 flex items-center justify-center text-xs font-bold transition-colors"
                onClick={() => setShowHint(false)}
                title="Dismiss hint"
              >✕</button>
            </div>
          )}
        </div>
      </div>

      <div
        data-testid="inspect-popup-layer"
        style={{ ...inspectPopupStyle, pointerEvents: 'none' }}
        aria-hidden={!showStepInspectionTip && inspectedStepIdx === null}
        onClick={e => e.stopPropagation()}
      >
        <div ref={inspectPopupNode}>
          <AnimatePresence>
            {/* Law explanation — opened by clicking a past step / its connector. */}
            {inspectedStepIdx !== null && (
              <div
                data-inspect-card="true"
                className={`bg-white border border-teal/40 shadow-xl rounded-xl text-left select-none pointer-events-auto ${
                  compactCanvas
                    ? 'p-2.5 w-[156px] max-w-full [@media(max-height:359px)]:p-2'
                    : 'p-3.5 w-[260px]'
                } ${inspectPopupReady ? 'opacity-100' : 'opacity-0'}`}
                style={{ transition: 'opacity 0.12s ease' }}
              >
                <div className="flex items-center justify-between gap-1 text-[11px] font-bold text-teal uppercase tracking-wide border-b border-slate-100 pb-1.5 mb-1.5">
                  <span className="truncate">{steps[inspectedStepIdx]?.law}</span>
                  <button
                    type="button"
                    data-testid="inspect-card-close"
                    onClick={() => setInspectedStepIdx(null)}
                    className={`text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded flex items-center justify-center font-bold text-xs transition-colors ${
                      compactCanvas ? 'w-6 h-6' : 'praxis-touch-target'
                    }`}
                    title="Close explanation"
                  >
                    ✕
                  </button>
                </div>
                <div className={`text-slate-600 leading-snug font-sans font-normal ${
                  compactCanvas ? 'text-[12.5px] line-clamp-2' : 'text-[12px] leading-relaxed'
                } ${shortViewport ? 'praxis-hide-short' : ''}`}>
                  {getLawExplanation(steps[inspectedStepIdx]?.law)}
                </div>
              </div>
            )}

            {/* First-run hint that a past step can be inspected. */}
            {showStepInspectionTip && inspectedStepIdx === null && (
              <div
                data-testid="step-inspection-tip"
                className={`bg-white border-2 border-teal/70 shadow-2xl rounded-2xl text-left flex flex-col ring-4 ring-teal/10 select-none pointer-events-auto ${
                  compactCanvas
                    ? 'p-2.5 gap-1 w-[170px] max-w-full [@media(max-height:359px)]:p-2 [@media(max-height:359px)]:w-[156px]'
                    : 'p-3.5 gap-2 w-[250px]'
                } ${inspectPopupReady ? 'opacity-100' : 'opacity-0'}`}
                style={{ transition: 'opacity 0.12s ease' }}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-teal">
                  <span>💡</span> Try Inspecting Steps
                </div>

                <p className={`text-[11.5px] text-text-2 leading-snug font-sans font-normal line-clamp-3 ${shortViewport ? 'praxis-hide-short' : ''}`}>
                  Click any past step in the left history panel OR any connection line between equations to inspect the applied law and reasoning!
                </p>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    data-testid="step-inspection-tip-ok"
                    onClick={() => setShowStepInspectionTip(false)}
                    className="px-3.5 py-1.5 min-h-[32px] [@media(max-height:359px)]:min-h-[28px] [@media(max-height:359px)]:py-1 bg-teal hover:bg-teal-dark text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    Okay
                  </button>
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── INTERACTIVE TUTORIAL OVERLAY ── */}
      {isTutorialActive && (
        <InteractiveTutorial
          stageIdx={stageNum}
          sel={sel}
          steps={steps}
          expr={expr}
          applicableLaws={applicableLaws}
          isComplete={isComplete}
          isPreLawHighlight={isPreLawHighlight}
          isAnimating={isAnimating}
          showSuccess={showSuccess}
          onResetStage={executeReset}
          onNextStage={() => {
            if (stageNum + 1 < (level?.puzzles?.length || 4)) {
              navigate(`/level/0/stage/${stageNum + 1}?tutorial=true`)
            } else {
              setIsTutorialActive(false)
              navigate('/level/0/stages')
            }
          }}
          onFinish={() => {
            setIsTutorialActive(false)
            if (stageNum === 1) {
              setShowStepInspectionTip(true)
            }
            if (stageNum + 1 >= (level?.puzzles?.length || 4)) {
              navigate('/levels')
            }
          }}
          onSkip={() => {
            setIsTutorialActive(false)
            navigate('/level/0/stages')
          }}
        />
      )}
    </div>
  )
}
