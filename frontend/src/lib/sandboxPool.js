/**
 * Curated pool of 24 solver-verified equations for the sandbox dice button.
 * Mix of two/three/four-variable expressions in both SOP and POS forms.
 */
export const SANDBOX_POOL = [
  'x + xy',
  'x(x + y)',
  "x'y + xy + xy",
  "(x' + y)(x + y)(x + y)",
  "x + x'y + xy",
  "x(x' + y)(x + y)",
  "xyz + xz + x'yz",
  "(x + y + z)(x + z)(x' + y + z)",
  "x'y' + x'yz + x'yz'",
  "(x' + y')(x' + y + z)(x' + y + z')",
  "x'y'z + x'yz + xy'z + xyz",
  "(x' + y' + z)(x' + y + z)(x + y' + z)(x + y + z)",
  'wxyz + wxz + wyz + w',
  '(w + x + y + z)(w + x + z)(w + y + z)w',
  "wx'y + wxy + wx'yz",
  "(w + x' + y)(w + x + y)(w + x' + y + z)",
  "wx'y'z + wx'yz + wxy'z + wxyz",
  "(w + x' + y' + z)(w + x' + y + z)(w + x + y' + z)(w + x + y + z)",
  "(wx)' + (w'xyz)' + z",
  "(w + x)'(w' + x + y + z)'z",
  "xy + xyz + x'",
  "(x + y)(x' + y)",
  "xy' + xy",
  'w + wx + wy + wz',
]

/** Pick a random entry from the pool, avoiding the last one if possible. */
export function randomPoolEquation(exclude = null) {
  const candidates = SANDBOX_POOL.filter(e => e !== exclude)
  const pool = candidates.length > 0 ? candidates : SANDBOX_POOL
  return pool[Math.floor(Math.random() * pool.length)]
}
