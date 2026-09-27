/**
 * useCollisionPlacement — the collision-aware popup layer of the workspace.
 *
 * The step-inspection tip, the law-explanation card and the hint bubble float
 * OVER the workspace. Anchoring them statically (right-full / inline flow) put
 * them on top of the expression, the applicable-law buttons or the header
 * controls on every compact tier, so they share one collision-aware layer:
 *
 *   measure the anchor + the popup → try the candidate sides in priority
 *   order → keep the first that overlaps nothing the learner still needs
 *   (and fits the viewport) → otherwise clamp into the largest free gap →
 *   recompute on resize / orbit / scroll.
 *
 * The layer is `position: fixed`, so the canvas zoom transform and the
 * scrollable canvas cannot drag the card off its anchor.
 */
import { useEffect, useRef, useState } from 'react'

export const CANVAS_SELECTOR = '[data-tutorial="canvas"]'

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
export const POPUP_MARGIN = 8
export const POPUP_GAP = 8
/** Below this the explanation card stops being readable. */
const POPUP_NARROW_MIN_WIDTH = 112

export const clampNum = (value, min, max) => (min > max ? min : Math.min(Math.max(value, min), max))

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
export function viewportBox() {
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
export const popupLayerStyle = (placement) => ({
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
export const INSPECT_POPUP_CANDIDATES = [
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
export const HINT_POPUP_CANDIDATES = [
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

export default function useCollisionPlacement({
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
