/**
 * @file coachCardGeometry.js
 * @description Pure geometry and measurement primitives for the collision-aware
 * coach-card placement engine: card size constants, rect math, obstacle
 * collection and free-span scans. No React, no state.
 */
import { CARD_OBSTACLE_SELECTOR } from './tutorialTargets'

/** Viewport margin kept free around the coach card. */
export const CARD_EDGE_MARGIN = 12
/** Breathing room kept between the card and every box it must not cover. */
export const CARD_OBSTACLE_GAP = 10
/** Below this height the card stops being readable, so avoidance is relaxed. */
export const CARD_USABLE_HEIGHT = 118
/** Narrowest card still readable. Cards must never crush text into unreadable slivers. */
export const CARD_MIN_WIDTH = 180
/** Natural card width (mirrors the `w-[330px]` class). */
export const CARD_NATURAL_WIDTH = 330

const rectsOverlap = (a, b) => !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y)

export const rectOverlapArea = (a, b) => {
  if (!rectsOverlap(a, b)) return 0
  return (Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
         (Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
}

export const unionRect = (a, b) => {
  if (!a) return b
  if (!b) return a
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y }
}



export const clampToViewport = (rect, vw, vh, margin = CARD_EDGE_MARGIN) => {
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
export const collectCardObstacles = (cardEl) => {
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
export const cardSideRect = (side, align, box, w, h) => {
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
export const cardFreeExtent = (obstacles, axis, dir, crossStart, crossSize, from) => {
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
export const cardFreeBands = (obstacles, extent, axis = 'y') => {
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
