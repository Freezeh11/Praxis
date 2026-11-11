/**
 * Curated pool of solver-verified equations for the sandbox randomizer.
 *
 * Used as a fallback whenever inverse-law generation cannot produce a verified
 * problem within its attempt budget. Every entry uses only x/y/z so it matches
 * the sandbox's declared 2-3 variable scope, and mixes SOP and POS shapes.
 *
 * These are hand-picked from the Level 1-3 catalogue plus a few classics, and
 * are all confirmed to reach a terminal (fully simplified) form by the engine.
 */
export const SANDBOX_POOL = [
  // Two-variable — SOP
  'x + xy',
  "x'y + xy + xy",
  "x + x'y + xy",
  "x'y + xy",
  'xy + xy',
  "xy' + xy",
  "x'y' + x'y",
  // Two-variable — POS
  'x(x + y)',
  "(x' + y)(x + y)(x + y)",
  "x(x' + y)(x + y)",
  '(x + y)(x + y)',
  "(x + y)(x' + y)",
  // Three-variable — SOP
  "xyz + xz + x'yz",
  "x'y' + x'yz + x'yz'",
  "x'y'z + x'yz + xy'z + xyz",
  "xyz + xyz'",
  "x'yz + xyz + x'y'z",
  "xz + x'yz + xyz",
  // Three-variable — POS
  "(x + y + z)(x + z)(x' + y + z)",
  "(x' + y')(x' + y + z)(x' + y + z')",
  "(x' + y' + z)(x' + y + z)(x + y' + z)(x + y + z)",
  "(x + y + z)(x + y + z')",
  "(x' + y')(x' + y)",
  "(x + y' + z)(x + y' + z')",
]

/** Pick a random entry from the pool, avoiding the excluded one if possible. */
export function randomPoolEquation(exclude = null) {
  const candidates = SANDBOX_POOL.filter(e => e !== exclude)
  const pool = candidates.length > 0 ? candidates : SANDBOX_POOL
  return pool[Math.floor(Math.random() * pool.length)]
}
