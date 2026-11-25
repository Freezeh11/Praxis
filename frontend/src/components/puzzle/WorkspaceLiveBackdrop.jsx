import { memo, useEffect, useRef } from 'react'
import { useTheme } from '../../state/theme.js'

/**
 * @file WorkspaceLiveBackdrop.jsx
 * @description The derivation workspace's blueprint sheet: a faint grid painted
 * INSIDE the workspace, behind the equations.
 *
 * The grid is the only thing this layer draws — deliberately. An earlier version
 * also animated "data pulses" along six circuit traces (plus solder dots at the
 * corners), which on a short or empty derivation left short bright dashes and
 * 2.2px dots floating in blank space with nothing to belong to. That read as
 * noise, so the traces, their halo, the travelling dashed packets and the whole
 * requestAnimationFrame loop are gone. Nothing here moves: there is no animation
 * to disable for `prefers-reduced-motion`, and no per-frame work at all.
 *
 * Performance contract:
 * - devicePixelRatio clamped to 1.5, backing store sized to the layer only;
 * - repaints ONLY when the layer box or the theme changes (ResizeObserver);
 * - paints imperatively from refs: no React state updates, no re-render of the
 *   workspace (memo + stable props; the theme is read here, not passed);
 * - only flat canvas fills/strokes: no filter, backdrop-filter or box-shadow.
 */

const GRID_PX = 32
const MAX_DPR = 1.5

const GRID_COLOR = { light: 'rgba(79,70,229,0.12)', dark: 'rgba(148,163,184,0.10)' }
const GRID_MAJOR_COLOR = { light: 'rgba(79,70,229,0.20)', dark: 'rgba(148,163,184,0.17)' }

function WorkspaceLiveBackdrop() {
  const { theme } = useTheme()
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined

    const isDark = theme === 'dark'
    let width = 0
    let height = 0
    let dpr = 1

    const paint = () => {
      if (width <= 8 || height <= 8) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)

      // Blueprint grid — the page's identity, and the only ornament.
      ctx.lineWidth = 1
      ctx.strokeStyle = isDark ? GRID_COLOR.dark : GRID_COLOR.light
      ctx.beginPath()
      for (let x = 0.5; x < width; x += GRID_PX) {
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
      }
      for (let y = 0.5; y < height; y += GRID_PX) {
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
      }
      ctx.stroke()

      // Every fourth line is a blueprint major rule, so the sheet reads as paper.
      ctx.strokeStyle = isDark ? GRID_MAJOR_COLOR.dark : GRID_MAJOR_COLOR.light
      ctx.beginPath()
      for (let x = 0.5; x < width; x += GRID_PX * 4) {
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
      }
      for (let y = 0.5; y < height; y += GRID_PX * 4) {
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
      }
      ctx.stroke()
    }

    /* Runs on mount, on every box resize AND on a theme switch (the effect
       re-runs), so the grid is always repainted in the current ink. */
    const sync = () => {
      const rect = canvas.getBoundingClientRect()
      const w = Math.round(rect.width)
      const h = Math.round(rect.height)
      const nextDpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
      if (w !== width || h !== height || nextDpr !== dpr) {
        width = w
        height = h
        dpr = nextDpr
        canvas.width = Math.round(w * dpr)
        canvas.height = Math.round(h * dpr)
      }
      paint()
    }

    let resizeObserver
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(sync)
      resizeObserver.observe(canvas)
    } else {
      window.addEventListener('resize', sync)
    }

    sync()

    return () => {
      if (resizeObserver) resizeObserver.disconnect()
      else window.removeEventListener('resize', sync)
    }
  }, [theme])

  return <canvas ref={canvasRef} aria-hidden="true" className="block h-full w-full" />
}

export default memo(WorkspaceLiveBackdrop)
