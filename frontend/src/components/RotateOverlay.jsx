/**
 * RotateOverlay — full-screen, non-dismissible "rotate your device" gate shown
 * to phones held in portrait.
 *
 * Non-negotiable properties (the whole point of the component):
 *  - OPAQUE background: nothing of the app may show through.
 *  - Covers the whole viewport at z-[9999] and swallows every pointer event, so
 *    the app underneath cannot be touched/clicked while it is up.
 *  - No close control, no Escape handler, no backdrop click — the only way out
 *    is to rotate the device (or widen the window), which the hook notices.
 *  - Scrolling is locked for as long as it is mounted via a body class that is
 *    removed again on unmount.
 */
import { useEffect } from 'react'

/** Body class defined in index.css: overflow/overscroll/touch-action lock. */
const OVERLAY_BODY_CLASS = 'praxis-overlay-open'

const OVERLAY_TEXT = 'Praxis works best in landscape mode. Please rotate your device.'
const OVERLAY_HELPER = 'Turn your phone sideways to continue.'

/** Inline phone icon; pure SVG, no dependency. */
function RotatingDeviceIcon() {
  return (
    <svg
      className="praxis-rotate-device"
      width="112"
      height="112"
      viewBox="0 0 112 112"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="34" y="14" width="44" height="76" rx="9" stroke="#ffffff" strokeWidth="4" opacity="0.95" />
      <rect x="41" y="23" width="30" height="54" rx="4" fill="#ffffff" opacity="0.14" />
      <circle cx="56" cy="83" r="3.2" fill="#ffffff" opacity="0.85" />
      {/* motion arcs hinting the 90° turn */}
      <path d="M20 40c-3 5-4 11-3 17" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" opacity="0.45" />
      <path d="M92 72c3-5 4-11 3-17" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" opacity="0.45" />
    </svg>
  )
}

export default function RotateOverlay({ tier }) {
  useEffect(() => {
    if (typeof document === 'undefined') return undefined
    const { body } = document
    if (!body) return undefined
    body.classList.add(OVERLAY_BODY_CLASS)
    return () => {
      body.classList.remove(OVERLAY_BODY_CLASS)
    }
  }, [])

  return (
    <div
      data-testid="rotate-overlay"
      data-device-tier={tier}
      role="dialog"
      aria-modal="true"
      aria-label="Rotate your device"
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-6 px-8 text-center select-none"
      style={{
        // Opaque, and set inline so no utility purge or token change can make
        // the app underneath visible.
        backgroundColor: 'var(--color-accent, #1a2035)',
        color: '#ffffff',
        touchAction: 'none',
        overscrollBehavior: 'none',
      }}
    >
      <RotatingDeviceIcon />

      <p className="max-w-sm text-lg font-semibold leading-snug" data-testid="rotate-overlay-message">
        {OVERLAY_TEXT}
      </p>

      <p className="text-sm font-medium text-white/70" data-testid="rotate-overlay-helper">
        {OVERLAY_HELPER}
      </p>
    </div>
  )
}
