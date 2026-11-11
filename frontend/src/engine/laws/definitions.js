/**
 * Law definitions — the ONE place a law's identity lives.
 *
 * Before this table the same law names and formulas were retyped in the law
 * builders, in the reference cards, in the hint/guide text and in two copies of
 * a name->id map inside the puzzle screen. Now:
 *
 *   - the law builders read name + formula from here (`defineLaw`)
 *   - `LAW_NAME_TO_ID` is derived from here, so scoring maps names to ids once
 *   - the reference screen renders `content/laws.json`, whose `id` matches the
 *     `id` used here (that is the join key between engine and content)
 *
 * `mode` records which selection opens the law: 'literal' needs two literals
 * selected, 'term' works on whole terms/clauses. `form` distinguishes the SOP
 * (sum-level) from the POS (product-level) variant of the same law.
 */

export const LAW_MODE = {
  LITERAL: 'literal',
  TERM: 'term',
}

export const LAW_FORM = {
  SUM: 'sum',
  PRODUCT: 'product',
  NODE: 'node',
}

export const LAW_DEFINITIONS = [
  // ── SOP (sum-level) ──────────────────────────────────────────────────────
  { id: 'distributive', name: 'Distributive (Factor)', formula: 'AB + AC = A(B+C)', mode: LAW_MODE.LITERAL, form: LAW_FORM.SUM },
  { id: 'complement', name: 'Complement Law', formula: "A + A' = 1", mode: LAW_MODE.LITERAL, form: LAW_FORM.SUM },
  { id: 'identity', name: 'Identity Law', formula: 'A + 0 = A', mode: LAW_MODE.TERM, form: LAW_FORM.SUM },
  { id: 'annulment', name: 'Annulment Law', formula: 'A + 1 = 1', mode: LAW_MODE.TERM, form: LAW_FORM.SUM },
  { id: 'idempotent', name: 'Idempotent Law', formula: 'A + A = A', mode: LAW_MODE.TERM, form: LAW_FORM.SUM },
  { id: 'absorption', name: 'Absorption Law', formula: 'A + AB = A', mode: LAW_MODE.TERM, form: LAW_FORM.SUM },

  // ── POS (product-level, duals) ───────────────────────────────────────────
  { id: 'distributive', name: 'Distributive (POS)', formula: '(A+B)(A+C) = A + BC', mode: LAW_MODE.LITERAL, form: LAW_FORM.PRODUCT },
  { id: 'complement', name: 'Complement Law (Product)', formula: "A · A' = 0", mode: LAW_MODE.LITERAL, form: LAW_FORM.PRODUCT },
  { id: 'idempotent', name: 'Idempotent Law (Product)', formula: 'A · A = A', mode: LAW_MODE.TERM, form: LAW_FORM.PRODUCT },
  { id: 'absorption', name: 'Absorption Law (Product)', formula: 'A(A+B) = A', mode: LAW_MODE.TERM, form: LAW_FORM.PRODUCT },
  { id: 'annulment', name: 'Annulment Law (Product)', formula: 'A · 0 = 0', mode: LAW_MODE.TERM, form: LAW_FORM.PRODUCT },
  { id: 'distributive-expand', name: 'Distributive (Expand)', formula: 'A(B + C) = AB + AC', mode: LAW_MODE.LITERAL, form: LAW_FORM.PRODUCT },

  // `Identity Law` is the one law whose formula depends on the form: the sum
  // and product statements are different, but the display name is identical.
  { id: 'identity', name: 'Identity Law', formula: 'A · 1 = A', mode: LAW_MODE.TERM, form: LAW_FORM.PRODUCT },

  // ── single-node laws ─────────────────────────────────────────────────────
  { id: 'double-neg', name: 'Double Negation', formula: "(A')' = A", mode: LAW_MODE.TERM, form: LAW_FORM.NODE },
  { id: 'demorgan-and', name: "De Morgan's (AND→OR)", formula: "(AB)' = A' + B'", mode: LAW_MODE.TERM, form: LAW_FORM.NODE },
  { id: 'demorgan-or', name: "De Morgan's (OR→AND)", formula: "(A+B)' = A'B'", mode: LAW_MODE.TERM, form: LAW_FORM.NODE },
]

// Keyed by name+form: `Identity Law` legitimately has a sum and a product
// statement, and the engine must return the one matching the node it found.
const BY_NAME_AND_FORM = new Map(
  LAW_DEFINITIONS.map((definition) => [`${definition.form}:${definition.name}`, definition])
)

/** Reference-card id for every detection name (used for scoring + explanations). */
export const LAW_NAME_TO_ID = Object.fromEntries(
  LAW_DEFINITIONS.map((definition) => [definition.name, definition.id])
)

/** Definitions grouped by reference-card id, in declaration order. */
/**
 * Looks up the identity of a law by the name the engine emits and the form it
 * was found in.
 *
 * Throws on an unknown pair so a typo fails loudly in the test suite instead of
 * silently producing a law with a missing id.
 *
 * @param {string} name display name the engine emits, e.g. 'Absorption Law'
 * @param {string} form one of LAW_FORM
 * @returns {{ id: string, name: string, formula: string }}
 */
export function defineLaw(name, form) {
  const definition = BY_NAME_AND_FORM.get(`${form}:${name}`)
  if (!definition) {
    throw new Error(`Unknown law: "${name}" (${form}) — add it to LAW_DEFINITIONS.`)
  }
  return { id: definition.id, name: definition.name, formula: definition.formula }
}
