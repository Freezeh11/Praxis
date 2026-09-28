/**
 * @file spotlightRects.js
 * @description Pure builders for the spotlight highlight rectangles — the snug
 * teal ring plus the soft backdrop cutout for the active equation, the current
 * target, the score-modal fallback and the secondary target — and the rect
 * comparison used to skip redundant state writes.
 */

/** Highlight bookkeeping keeps both `top/left` and `cutoutTop/cutoutLeft`. */
export const cutoutRectOf = (r) => ({
  x: r.cutoutLeft ?? r.left,
  y: r.cutoutTop ?? r.top,
  w: r.cutoutWidth ?? r.width,
  h: r.cutoutHeight ?? r.height,
})

export const isSameRect = (a, b) => {
  if (!a && !b) return true
  if (!a || !b) return false
  return Math.abs((a.cutoutTop ?? a.top) - (b.cutoutTop ?? b.top)) < 0.5 &&
         Math.abs((a.cutoutLeft ?? a.left) - (b.cutoutLeft ?? b.left)) < 0.5 &&
         Math.abs((a.cutoutWidth ?? a.width) - (b.cutoutWidth ?? b.width)) < 0.5 &&
         Math.abs((a.cutoutHeight ?? a.height) - (b.cutoutHeight ?? b.height)) < 0.5 &&
         a.isScoreModal === b.isScoreModal
}

/** Highlight for the active equation while a law is pressed or animating. */
export function buildEquationHighlight(rect) {
  const ringPadSide = 12
  const ringPadTop = 8
  const ringRx = 14
  const cutoutPadSide = 24
  const cutoutPadTop = 16
  const cutoutRx = 20

  return {
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
}

/** Highlight for a step's primary target, padded per kind of target. */
export function buildTargetHighlight(rect, effectiveTarget) {
  const isVar = effectiveTarget.includes('data-path')
  const isNot = effectiveTarget.includes('not-capsule') || effectiveTarget.includes('not-bar')
  const isTerm = effectiveTarget.includes('term-') || isNot
  const isScoreModal = effectiveTarget.includes('score-modal') || effectiveTarget.includes('review-derivation-btn')

  // Snug teal highlight box padding
  const ringPadTop = isVar ? 2 : isNot ? 6 : isTerm ? 4 : isScoreModal ? 4 : 6
  const ringPadBottom = isVar ? 2 : isScoreModal ? 4 : 6
  const ringPadSide = isVar ? 3 : isTerm ? 6 : isScoreModal ? 4 : 8
  const ringRx = isVar ? 6 : isScoreModal ? 24 : 10

  // Spacious, soft curved dark backdrop cutout padding
  const cutoutPadTop = isVar ? 4 : isTerm ? 26 : isScoreModal ? 10 : 12
  const cutoutPadBottom = isVar ? 4 : isTerm ? 18 : isScoreModal ? 10 : 12
  const cutoutPadSide = isVar ? 5 : isTerm ? 24 : isScoreModal ? 10 : 16
  const cutoutRx = isVar ? 8 : isScoreModal ? 28 : 22

  return {
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
}

/** Keeps the active equation highlighted while the score modal mounts. */
export function buildScoreModalFallbackHighlight(rect) {
  return {
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
}

/** Highlight for the secondary target (e.g. drop target 'z' during a drag). */
export function buildSecondaryHighlight(secRect, secondaryTarget) {
  const isSecVar = secondaryTarget.includes('data-path')
  const isSecTerm = secondaryTarget.includes('term-') || secondaryTarget.includes('not-capsule')

  const ringPadTop = isSecVar ? 2 : isSecTerm ? 4 : 6
  const ringPadBottom = isSecVar ? 2 : 6
  const ringPadSide = isSecVar ? 3 : isSecTerm ? 6 : 8
  const ringRx = isSecVar ? 6 : 10

  const cutoutPadTop = isSecVar ? 4 : isSecTerm ? 24 : 12
  const cutoutPadBottom = isSecVar ? 4 : isSecTerm ? 18 : 12
  const cutoutPadSide = isSecVar ? 5 : isSecTerm ? 24 : 16
  const cutoutRx = isSecVar ? 8 : 22

  return {
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
}
