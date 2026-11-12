import { memo, useEffect, useRef } from 'react'
import { useTheme } from '../../state/theme.js'

/**
 * @file WorkspaceLiveBackdrop.jsx
 * @description Live wallpaper painted INSIDE the derivation workspace, behind
 * the equations: a faint blueprint grid plus slow data pulses travelling along
 * horizontal / vertical circuit traces.
 *
 * It is deliberately very quiet — the equation has to keep full focus — so the
 * grid is ~7% ink and the pulses are short, sparse and dim (average canvas
 * alpha stays well under 0.10). Nothing here reacts to pointer or scroll input.
 *
 * Performance contract:
 * - devicePixelRatio clamped to 1.5, backing store sized to the layer only;
 * - ~30 FPS via a timestamp accumulator (never more than one paint per 33ms);
 * - rAF stops when the tab is hidden and when the layer is out of view;
 * - `prefers-reduced-motion: reduce` paints ONE static frame and never starts
 *   an rAF loop (the media query is watched, so a change mid-session honours
 *   the new preference);
 * - paints imperatively from refs: no per-frame React state, no re-render of
 *   the workspace (memo + stable props; the theme is read here, not passed);
 * - only flat canvas fills/strokes: no filter, backdrop-filter or box-shadow.
 */

const FRAME_MS = 1000 / 30
const GRID_PX = 32
const MAX_DPR = 1.5
/** Deterministic timestamp used for the single reduced-motion frame. */
const STATIC_TIME = 4200

const GRID_COLOR = { light: 'rgba(79,70,229,0.12)', dark: 'rgba(148,163,184,0.10)' }
const GRID_MAJOR_COLOR = { light: 'rgba(79,70,229,0.20)', dark: 'rgba(148,163,184,0.17)' }
const WIRE_COLOR = { light: 'rgba(79,70,229,0.22)', dark: 'rgba(34,211,238,0.22)' }
const WIRE_ALT_COLOR = { light: 'rgba(79,70,229,0.18)', dark: 'rgba(99,102,241,0.22)' }
const PULSE_COLOR = { light: 'rgba(79,70,229,0.62)', dark: 'rgba(34,211,238,0.78)' }
const PULSE_ALT_COLOR = { light: 'rgba(6,182,212,0.52)', dark: 'rgba(99,102,241,0.68)' }
const GLOW_COLOR = { light: 'rgba(79,70,229,0.14)', dark: 'rgba(34,211,238,0.18)' }
const GLOW_ALT_COLOR = { light: 'rgba(6,182,212,0.12)', dark: 'rgba(99,102,241,0.16)' }

/**
 * Circuit traces in normalized coordinates (fractions of the layer box).
 * `speed` is px/second, `pulse`/`gap` are the dashed-stroke pattern that
 * renders a single travelling data packet, and `offset` staggers the packets.
 */
const TRACES = [
  { pts: [[-0.08, 0.14], [0.30, 0.14], [0.30, 0.40]], speed: 40, pulse: 58, gap: 520, offset: 0.05, tone: 0 },
  { pts: [[0.62, -0.10], [0.62, 0.26], [0.94, 0.26], [0.94, 0.62]], speed: 34, pulse: 66, gap: 620, offset: 0.55, tone: 1 },
  { pts: [[-0.06, 0.68], [0.22, 0.68], [0.22, 0.98]], speed: 28, pulse: 50, gap: 460, offset: 0.30, tone: 0 },
  { pts: [[0.46, 0.86], [0.86, 0.86], [0.86, 0.56]], speed: 32, pulse: 56, gap: 500, offset: 0.75, tone: 1 },
  { pts: [[0.08, 0.42], [0.08, 0.60], [0.40, 0.60]], speed: 24, pulse: 44, gap: 400, offset: 0.15, tone: 0 },
  { pts: [[0.74, 0.04], [0.74, 0.50]], speed: 38, pulse: 74, gap: 600, offset: 0.90, tone: 0 },
]

function WorkspaceLiveBackdrop({ calm = true }) {
  const { theme } = useTheme()
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined

    const isDark = theme === 'dark'
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

    /** Mutable paint state — refs only, so a frame never asks React for anything. */
    const view = {
      w: 0, h: 0, dpr: 1, ready: false,
      raf: 0, prev: 0, lastPaint: 0, time: 0,
      visible: true, reduced: motionQuery.matches,
    }

    const paint = () => {
      if (!view.ready) return
      const { w, h, dpr } = view
      const t = view.reduced ? STATIC_TIME : view.time

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      // Blueprint grid — the "paused" register of the wallpaper.
      ctx.lineWidth = 1
      ctx.strokeStyle = isDark ? GRID_COLOR.dark : GRID_COLOR.light
      ctx.beginPath()
      for (let x = 0.5; x < w; x += GRID_PX) {
        ctx.moveTo(x, 0)
        ctx.lineTo(x, h)
      }
      for (let y = 0.5; y < h; y += GRID_PX) {
        ctx.moveTo(0, y)
        ctx.lineTo(w, y)
      }
      ctx.stroke()

      // Every fourth line is a blueprint major rule, so the sheet reads as paper.
      ctx.beginPath()
      for (let x = 0.5; x < w; x += GRID_PX * 4) {
        ctx.moveTo(x, 0)
        ctx.lineTo(x, h)
      }
      for (let y = 0.5; y < h; y += GRID_PX * 4) {
        ctx.moveTo(0, y)
        ctx.lineTo(w, y)
      }
      ctx.strokeStyle = isDark ? GRID_MAJOR_COLOR.dark : GRID_MAJOR_COLOR.light
      ctx.stroke()

      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      for (let i = 0; i < TRACES.length; i += 1) {
        const trace = TRACES[i]
        const wire = trace.tone === 0
          ? (isDark ? WIRE_COLOR.dark : WIRE_COLOR.light)
          : (isDark ? WIRE_ALT_COLOR.dark : WIRE_ALT_COLOR.light)
        const pulse = trace.tone === 0
          ? (isDark ? PULSE_COLOR.dark : PULSE_COLOR.light)
          : (isDark ? PULSE_ALT_COLOR.dark : PULSE_ALT_COLOR.light)
        const glow = trace.tone === 0
          ? (isDark ? GLOW_COLOR.dark : GLOW_COLOR.light)
          : (isDark ? GLOW_ALT_COLOR.dark : GLOW_ALT_COLOR.light)

        ctx.beginPath()
        for (let p = 0; p < trace.pts.length; p += 1) {
          const x = trace.pts[p][0] * w
          const y = trace.pts[p][1] * h
          if (p === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }

        // Static wire.
        ctx.setLineDash([])
        ctx.lineWidth = 1
        ctx.strokeStyle = wire
        ctx.stroke()

        // One constant-speed packet along the same path, with a soft halo so
        // the pulse reads on both the pale and the obsidian sheet.
        const period = trace.pulse + trace.gap
        ctx.setLineDash([trace.pulse, trace.gap])
        ctx.lineDashOffset = -(((t * trace.speed) / 1000 + trace.offset * period) % period)
        ctx.globalAlpha = calm ? 0.55 : 0.7
        ctx.lineWidth = 8
        ctx.strokeStyle = glow
        ctx.stroke()
        ctx.globalAlpha = calm ? 0.9 : 1
        ctx.lineWidth = 2.4
        ctx.strokeStyle = pulse
        ctx.stroke()
        ctx.globalAlpha = 1

        // Solder dots at the corners, matching the wire ink.
        ctx.setLineDash([])
        ctx.fillStyle = wire
        for (let p = 1; p < trace.pts.length - 1; p += 1) {
          ctx.beginPath()
          ctx.arc(trace.pts[p][0] * w, trace.pts[p][1] * h, 2.2, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      ctx.setLineDash([])
    }

    const frame = (now) => {
      view.raf = requestAnimationFrame(frame)
      if (view.prev) view.time += now - view.prev
      view.prev = now
      if (now - view.lastPaint < FRAME_MS) return
      view.lastPaint = now
      paint()
    }

    const start = () => {
      if (view.raf || !view.ready || view.reduced) return
      if (document.hidden || !view.visible) return
      view.prev = 0
      view.lastPaint = 0
      view.raf = requestAnimationFrame(frame)
    }

    const stop = () => {
      if (!view.raf) return
      cancelAnimationFrame(view.raf)
      view.raf = 0
    }

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const w = Math.round(rect.width)
      const h = Math.round(rect.height)
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
      if (w === view.w && h === view.h && dpr === view.dpr) return
      view.w = w
      view.h = h
      view.dpr = dpr
      view.ready = w > 8 && h > 8
      if (!view.ready) return
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      paint()
      start()
    }

    const onVisibility = () => {
      if (document.hidden) stop()
      else start()
    }

    const onMotionChange = () => {
      view.reduced = motionQuery.matches
      if (view.reduced) {
        stop()
        paint()
      } else {
        start()
      }
    }

    let resizeObserver
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(resize)
      resizeObserver.observe(canvas)
    } else {
      window.addEventListener('resize', resize)
    }

    let intersectionObserver
    if (typeof IntersectionObserver !== 'undefined') {
      intersectionObserver = new IntersectionObserver((entries) => {
        view.visible = entries.some((entry) => entry.isIntersecting)
        if (view.visible) start()
        else stop()
      }, { threshold: 0 })
      intersectionObserver.observe(canvas)
    }

    document.addEventListener('visibilitychange', onVisibility)
    if (motionQuery.addEventListener) motionQuery.addEventListener('change', onMotionChange)
    else if (motionQuery.addListener) motionQuery.addListener(onMotionChange)

    resize()
    if (view.reduced) paint()
    else start()

    return () => {
      stop()
      if (resizeObserver) resizeObserver.disconnect()
      else window.removeEventListener('resize', resize)
      if (intersectionObserver) intersectionObserver.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      if (motionQuery.removeEventListener) motionQuery.removeEventListener('change', onMotionChange)
      else if (motionQuery.removeListener) motionQuery.removeListener(onMotionChange)
    }
  }, [theme, calm])

  return <canvas ref={canvasRef} aria-hidden="true" className="block h-full w-full" />
}

export default memo(WorkspaceLiveBackdrop)
