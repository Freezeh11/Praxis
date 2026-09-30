/**
 * Syntax validation of a learner-typed Boolean expression.
 *
 * This is the *string* gate (characters, parentheses, operator placement). It is
 * deliberately separate from `sandbox/input.js`, which adds the product rules
 * (variable budget, solvability). Validation returns a verdict object rather
 * than throwing, because callers render the message verbatim.
 *
 * Pure module: no React/DOM/network.
 */

/**
 * @param {string} str
 * @returns {{ valid: boolean, error: string|null }} user-facing message on failure
 */
export function validateExpr(str) {
  if (!str || typeof str !== 'string' || !str.trim()) {
    return { valid: false, error: 'Expression is required.' }
  }

  const s = str.trim()

  // Allowed alphabet: variables (a-z, A-Z), constants (0, 1) and operators
  if (!/^[a-zA-Z0-9+*·&|'!~()\s]+$/.test(s)) {
    return {
      valid: false,
      error: "Invalid characters. Use variables (a-z), constants (0/1) and operators ( + * · & | ' ! ~ ( ) ).",
    }
  }

  // Balanced parentheses
  let depth = 0
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (ch === '(') depth++
    else if (ch === ')') {
      depth--
      if (depth < 0) {
        return { valid: false, error: 'Unbalanced parentheses: found a ")" with no matching "(".', }
      }
    }
  }
  if (depth !== 0) {
    return { valid: false, error: 'Unbalanced parentheses: missing ")".' }
  }

  // Must contain at least one variable or constant
  if (!/[a-zA-Z0-9]/.test(s)) {
    return { valid: false, error: 'Expression must contain at least one variable or constant.' }
  }

  // Binary operators cannot start/end the expression or repeat
  if (/^[+*·&|]/.test(s) || /[+*·&|]$/.test(s)) {
    return { valid: false, error: 'Expression cannot start or end with an operator.' }
  }
  if (/[+*·&|]\s*[+*·&|]/.test(s)) {
    return { valid: false, error: 'Two operators in a row: check for typos like "++" or "+·".' }
  }

  // Content checks around parentheses (no lookbehind, for wider browser support)
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (ch === '(') {
      const next = s[i + 1]
      if (next === undefined || /[+*·&|)]/.test(next)) {
        return { valid: false, error: 'Invalid content right after "(": expected a variable, constant, "!" or "(".', }
      }
    }
    if (ch === ')') {
      const prev = s[i - 1]
      if (prev === undefined || /[+*·&|(]/.test(prev)) {
        return { valid: false, error: 'Invalid content right before ")": expected a variable, constant or "\'".', }
      }
    }
  }

  return { valid: true, error: null }
}
