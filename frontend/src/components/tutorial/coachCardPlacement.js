/**
 * @file coachCardPlacement.js
 * @description Collision-aware coach-card placement: given the card's natural
 * size, the highlighted targets, every on-screen control, and the step's
 * declared placement, picks the rectangle (and optional max-height) that covers
 * as little as possible. Pure: everything it needs is passed in.
 */

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

import {
  CARD_EDGE_MARGIN,
  CARD_OBSTACLE_GAP,
  CARD_MIN_WIDTH,
  CARD_USABLE_HEIGHT,
  clampToViewport,
  cardFreeBands,
  cardFreeExtent,
  cardSideRect,
  rectOverlapArea,
  unionRect,
} from './coachCardGeometry'

/**
 * Picks the coach-card rectangle (and optional max-height) that covers as few
 * targets/controls as possible. Pure: everything it needs is passed in.
 */
export function pickCoachPlacement({ naturalW, naturalH, targets, obstacles: allObstacles, vw, vh, preferred, declaredRect }) {
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

  const groups = [sidesFull, sidesFitted, scan, columns, sheets]
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
