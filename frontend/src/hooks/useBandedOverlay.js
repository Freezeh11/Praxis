/**
 * useBandedOverlay — places a panel in the free vertical band below the control
 * that opened it.
 *
 * The laws reference used to be a full-height overlay, so opening it hid the
 * header rail — including the button that opened it. It now opens under that
 * rail: fixed top, explicit height, sliding in from the right.
 */
import { useEffect, useRef, useState } from 'react'

import { POPUP_GAP, POPUP_MARGIN, clampNum, viewportBox } from './useCollisionPlacement.js'

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
export default function useBandedOverlay(triggerSelectors, enabled) {
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
