// Shared inline styles for the law-animation overlays: the "ghost text" layers sitting on a
// measured term rect, and the shockwave rings centred on one. Their `animation` shorthands drive
// the keyframes in styles/animations.css (absorb*/idempotent*/identity*/annulment*/complement*/
// factor*/paren* plus absorbShockwave, idempotentShockwave, annulmentShockwave, complementShockwave).

const MONO_STACK = "'JetBrains Mono', 'Fira Code', monospace"

/**
 * Fixed-position overlay text layer placed exactly on a measured term rect.
 * Per-law colour, padding, border, background, z-index, `animation` and the
 * `--*-dx`/`--*-dy` custom properties the keyframes read all arrive via `overrides`.
 */
export function ghostTextStyle(rect, overrides = {}) {
  return {
    position: 'fixed',
    left: rect.left,
    top: rect.top,
    display: 'inline-flex',
    alignItems: 'baseline',
    fontFamily: MONO_STACK,
    fontSize: rect.fontSize || '22px',
    fontWeight: '600',
    zIndex: 9999,
    pointerEvents: 'none',
    ...overrides,
  }
}

/**
 * Fixed-position shockwave ring centred on a rect's centre point (`rect.cx` / `rect.cy`),
 * sized 16px larger than the rect with a 36px floor.
 */
export function shockwaveStyle(rect, overrides = {}) {
  return {
    position: 'fixed',
    left: rect.cx,
    top: rect.cy,
    width: Math.max(rect.width, 36) + 16,
    height: Math.max(rect.height, 36) + 16,
    borderRadius: '9999px',
    pointerEvents: 'none',
    zIndex: 9998,
    ...overrides,
  }
}
