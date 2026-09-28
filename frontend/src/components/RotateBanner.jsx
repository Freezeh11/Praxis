/**
 * RotateBanner — sticky, dismissible hint for small tablets held in portrait.
 *
 * Unlike RotateOverlay this is advisory: the app stays fully usable, so the
 * banner must never block the controls underneath it beyond its own height.
 * Dismissal is remembered in sessionStorage by the hook
 * (`useDeviceTier().dismissRotateBanner`), so it does not come back until a new
 * browser session.
 */
const BANNER_TEXT = 'Rotate for best experience'

/** Inline phone-rotating glyph; pure SVG, no dependency. */
function RotateGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <rect x="7" y="3" width="10" height="18" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 12a8.5 8.5 0 0 1 2-5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M5.5 6.5V10h3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function RotateBanner({ onDismiss, tier }) {
  return (
    <div
      data-testid="rotate-banner"
      data-device-tier={tier}
      role="status"
      aria-live="polite"
      className="sticky top-0 z-[9998] flex w-full items-center justify-center gap-3 border-b px-3 py-2"
      style={{
        backgroundColor: 'var(--color-amber-light, #fef3c7)',
        borderColor: 'var(--color-amber, #f59e0b)',
        color: 'var(--color-text-1, #1a2035)',
      }}
    >
      <span className="text-amber" style={{ color: 'var(--color-amber, #f59e0b)' }}>
        <RotateGlyph />
      </span>

      <span className="text-sm font-semibold" data-testid="rotate-banner-text">
        {BANNER_TEXT}
      </span>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss rotate banner"
        data-testid="rotate-banner-dismiss"
        className="praxis-touch-target ml-1 rounded-full text-base leading-none font-semibold transition-colors hover:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber"
        style={{ color: 'var(--color-text-2, #4b5468)' }}
      >
        <span aria-hidden="true">✕</span>
      </button>
    </div>
  )
}
