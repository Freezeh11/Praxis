import { memo, useEffect, useState } from 'react'
import { useTheme } from '../../state/theme.js'

/**
 * @file LogicCircuitBackdrop.jsx
 * @description The living wallpaper behind every page: a blueprint grid in
 * light mode, an obsidian radial in dark, with Boolean-expression watermarks
 * and a handful of data pulses running along the circuit.
 *
 * The watermarks mirror the app's own Boolean notation (`F = A + A'B`,
 * `(A + B)' = A'·B'`, …) rather than drawing discrete gate symbols, so the
 * backdrop reads as the same algebra the workspace below it speaks — the page
 * asserts its vocabulary instead of picturing it. They stay monospace, tight-
 * tracked and very quiet so the real content keeps every bit of its contrast.
 *
 * Performance contract (see the workspace 60fps budget):
 *  - memoised, and it reads the theme store itself, so typing in the AST
 *    workspace never re-renders it;
 *  - every animation is a CSS keyframe on transform/opacity only — no filter,
 *    no box-shadow, no layout, no requestAnimationFrame;
 *  - pulses pause while the tab is hidden and are not rendered at all under
 *    `prefers-reduced-motion: reduce`; the expression drift stops instead of
 *    disappearing, because the text alone is the decoration.
 */

// Expression watermarks in the app's source notation. `left`/`top` are the same
// percentage anchors the old gate glyphs used; `size` is the font size in px and
// `light`/`dark` are each expression's opacity nudge away from the 0.10/0.15
// baseline, so the field never looks like it was stamped by a single pass.
const EXPRESSIONS = [
  { text: "F = A + A'B", left: '6%', top: '16%', size: 38, rotate: -8, delay: '0s', light: 0.1, dark: 0.15 },
  { text: '(x + y)', left: '78%', top: '10%', size: 44, rotate: 9, delay: '-8s', light: 0.09, dark: 0.13 },
  { text: "x'y + xy", left: '4%', top: '64%', size: 40, rotate: 6, delay: '-15s', light: 0.11, dark: 0.17 },
  { text: "F = AB + A'C", left: '72%', top: '62%', size: 34, rotate: -5, delay: '-4s', light: 0.1, dark: 0.14 },
  { text: 'A + AB = A', left: '44%', top: '80%', size: 36, rotate: 4, delay: '-19s', light: 0.08, dark: 0.12 },
  { text: "(A + B)' = A'·B'", left: '24%', top: '34%', size: 26, rotate: -3, delay: '-11s', light: 0.09, dark: 0.12 },
  { text: 'F = x ⊕ y', left: '62%', top: '22%', size: 32, rotate: 7, delay: '-6s', light: 0.11, dark: 0.16 },
]

// Each pulse travels a fixed vector, so the browser can composite it on the GPU
// from the keyframe alone. `duration`/delay are staggered to avoid a heartbeat.
const PULSES = [
  { left: '10%', top: '22%', x: 190, y: 90, duration: 19, delay: 0 },
  { left: '28%', top: '68%', x: 140, y: -120, duration: 24, delay: -6 },
  { left: '52%', top: '12%', x: -110, y: 150, duration: 21, delay: -11 },
  { left: '66%', top: '72%', x: 160, y: -80, duration: 26, delay: -3 },
  { left: '82%', top: '34%', x: -180, y: 110, duration: 23, delay: -14 },
  { left: '38%', top: '44%', x: 120, y: 130, duration: 28, delay: -8 },
  { left: '92%', top: '78%', x: -150, y: -130, duration: 20, delay: -17 },
]

function LogicCircuitBackdrop({ subtle = false }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [paused, setPaused] = useState(false)
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const visibility = () => setPaused(document.hidden)
    visibility()
    document.addEventListener('visibilitychange', visibility)
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const syncMotion = () => setReduced(motion.matches)
    syncMotion()
    motion.addEventListener('change', syncMotion)
    return () => {
      document.removeEventListener('visibilitychange', visibility)
      motion.removeEventListener('change', syncMotion)
    }
  }, [])

  const gridColor = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(226,232,240,0.9)'

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Base wash: warm paper in light, obsidian radial in dark. */}
      <div className={`absolute inset-0 transition-colors duration-200 ${isDark
        ? 'bg-[radial-gradient(ellipse_at_50%_-10%,#101a2e_0%,#0B0F19_48%,#060911_100%)]'
        : 'bg-[#F8FAFC]'}`} />

      {/* Blueprint grid — painted once, never animated. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(to right, ${gridColor} 1px, transparent 1px), linear-gradient(to bottom, ${gridColor} 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse at 50% 35%, black 25%, transparent 78%)',
          WebkitMaskImage: 'radial-gradient(ellipse at 50% 35%, black 25%, transparent 78%)',
        }}
      />

      {/* Expression watermarks + circuit data pulses. In the expression workspace
          the whole animation layer steps back to a whisper. */}
      <div className={`absolute inset-0 transition-opacity duration-300 ${subtle ? 'opacity-[0.06]' : 'opacity-100'}`}>
        {EXPRESSIONS.map(expression => (
          // Two elements on purpose: the outer one holds the static rotate, the
          // inner one only ever receives gateDrift's translate3d — otherwise the
          // keyframe's transform would overwrite the tilt it was meant to keep.
          <span
            key={expression.text + expression.left}
            className="absolute"
            style={{ left: expression.left, top: expression.top, transform: `rotate(${expression.rotate}deg)` }}
          >
            <span
              className={`block whitespace-nowrap font-mono font-semibold tracking-tight select-none ${isDark ? 'text-cyan-400' : 'text-indigo-600'}`}
              style={{
                fontSize: expression.size,
                opacity: isDark ? expression.dark : expression.light,
                animation: reduced ? 'none' : `gateDrift 24s ease-in-out ${expression.delay} infinite`,
                animationPlayState: paused ? 'paused' : 'running',
                willChange: 'transform',
              }}
            >
              {expression.text}
            </span>
          </span>
        ))}

        {!reduced && PULSES.map((pulse, index) => (
          <span
            key={index}
            className={`absolute h-1.5 w-1.5 rounded-full ${isDark
              ? 'bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.9)]'
              : 'bg-indigo-500 shadow-[0_0_10px_rgba(79,70,229,0.55)]'}`}
            style={{
              left: pulse.left,
              top: pulse.top,
              '--pulse-x': `${pulse.x}px`,
              '--pulse-y': `${pulse.y}px`,
              '--pulse-duration': `${pulse.duration}s`,
              '--pulse-delay': `${pulse.delay}s`,
              animation: 'circuitPulse var(--pulse-duration) linear var(--pulse-delay) infinite',
              animationPlayState: paused ? 'paused' : 'running',
              willChange: 'transform, opacity',
            }}
          />
        ))}
      </div>
    </div>
  )
}

// Muted to a single boolean prop, so navigating between pages is the only thing
// that can re-render it — not the workspace next to it.
export default memo(LogicCircuitBackdrop)
