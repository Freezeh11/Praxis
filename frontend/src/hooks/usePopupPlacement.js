import { useEffect, useState } from 'react'

/**
 * Measures the free band below `anchorSelector` (for the law drawer) and the vertical
 * nudge that keeps a centred `[data-popup-panel="centered"]` dialog clear of it.
 */
export function usePopupPlacement(anchorSelector, active) {
  const [placement, setPlacement] = useState(null)

  useEffect(() => {
    if (!active) return undefined
    let frame = null

    const measure = () => {
      const vh = window.visualViewport?.height ?? window.innerHeight
      const MARGIN = 8
      const anchorEl = document.querySelector(anchorSelector)
      const ar = anchorEl ? anchorEl.getBoundingClientRect() : null
      const anchorBottom = ar ? ar.bottom : 0

      // Drawer band: everything under the control, capped so it stays a
      // drawer and never swallows the page.
      const drawerTop = MARGIN
      // The drawer may be tall, but its left edge must stay clear of the header
      // controls, so a wide viewport gives it a column that starts after them
      // and a narrow one gives it the full width under them.
      const margin = 96
      const narrow = window.innerWidth <= 640
      const maxWidth = narrow
        ? window.innerWidth - MARGIN * 2
        : Math.max(260, window.innerWidth - Math.max(0, (document.querySelector(anchorSelector)?.getBoundingClientRect().left ?? 0) - 24))
      const aboveTrigger = Math.max(0, anchorBottom + MARGIN - drawerTop)
      const fullHeight = (vh - drawerTop - MARGIN) * 0.9
      const band = {
        top: drawerTop,
        maxHeight: Math.max(margin, Math.min(fullHeight, narrow ? aboveTrigger : Math.max(aboveTrigger, fullHeight * 0.7))),
        maxWidth,
      }

      // Centred dialog: keep it vertically centred unless that would cover the
      // control, then slide it down just enough.
      const panel = document.querySelector('[data-popup-panel="centered"]')
      let shift = 0
      if (panel) {
        const naturalH = panel.offsetHeight || 0
        const maxH = Math.max(120, vh - MARGIN * 2)
        const height = Math.min(naturalH, maxH)
        if (naturalH > 0 && anchorBottom + MARGIN > (vh - height) / 2) {
          shift = Math.min(anchorBottom + MARGIN - (vh - height) / 2, Math.max(0, vh - MARGIN - ((vh - height) / 2 + height)))
        }
      }
      publish({ band, shift })
    }

    const publish = (next) => {
      setPlacement(prev => (prev
        && Math.abs(prev.band.top - next.band.top) < 0.6
        && Math.abs(prev.band.maxHeight - next.band.maxHeight) < 0.6
        && Math.abs(prev.shift - next.shift) < 0.6
        ? prev
        : next))
    }
    const schedule = () => {
      if (frame) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }

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
  }, [anchorSelector, active])

  return placement
}
