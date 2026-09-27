/**
 * Hint copy — turns an engine suggestion into the sentence the learner reads.
 *
 * Pure: takes the law id and the node paths that scanHints reported, and renders
 * the same phrasing the Hint bubble has always shown. Extracted from
 * useGameState.js so the wording can be unit-tested without mounting React.
 */
import { getNode, findCommonProd } from '../engine/index.js'

export const DEAD_END_MSG = "This expression is simplified, but it isn't in its optimal state. A different law path can reach the target answer."

/**
 * Converts a scanHints result into a human-readable hint string.
 * @param {string} law - law id from scanHints
 * @param {string[]} paths - node paths from scanHints
 * @param {object} expr - current expression tree
 */
export function buildHintText(law, paths, expr) {
  try {
    const n1 = paths[0] ? getNode(expr, paths[0]) : null
    const n2 = paths[1] ? getNode(expr, paths[1]) : null

    let isProdContext = false
    if (paths.length >= 2) {
      const cp = findCommonProd(expr, paths[0], paths[1])
      if (cp) isProdContext = true
    } else if (paths.length === 1) {
      const parts = paths[0].split('.')
      if (parts.length > 1) {
        const parentPath = parts.slice(0, -1).join('.')
        const parent = getNode(expr, parentPath)
        if (parent?.type === 'prod') isProdContext = true
      }
    }

    switch (law) {
      case 'double-neg':
        return `There's a term with two negations stacked on top of each other. Double Negation can clean that up: (A')' = A.`
      case 'demorgan':
      case 'demorgan-and':
      case 'demorgan-or':
        return `There's a negated group in the expression. Try applying De Morgan's Law to expand it.`
      case 'absorption':
        return isProdContext
          ? `One clause absorbs another: A(A + B) = A. Absorption Law eliminates the longer clause.`
          : `One term absorbs another: A + AB = A. Absorption Law eliminates the longer term.`
      case 'idempotent':
        return isProdContext
          ? `Duplicate clauses appear in a product: (A)(A) = A. Idempotent Law removes the duplicate.`
          : `Duplicate terms appear in a sum: A + A = A. Idempotent Law removes the duplicate.`
      case 'complement':
        return isProdContext
          ? `A variable meets its complement in a product: A · A' = 0.`
          : `A variable meets its complement in a sum: A + A' = 1.`
      case 'annulment': {
        const hasOne = (n1?.type === 'const' && n1.val === 1) || (n2?.type === 'const' && n2.val === 1)
        return hasOne
          ? `There's a 1 in a sum. Annulment Law says A + 1 = 1 — the whole sum collapses to 1.`
          : `There's a 0 in a product. Annulment Law says A · 0 = 0 — the product collapses to 0.`
      }
      case 'identity': {
        const hasZero = (n1?.type === 'const' && n1.val === 0) || (n2?.type === 'const' && n2.val === 0)
        return hasZero
          ? `There's a 0 in a sum that has no effect. Identity Law says A + 0 = A.`
          : `There's a 1 in a product that has no effect. Identity Law says A · 1 = A.`
      }
      case 'distributive':
        return isProdContext
          ? `Two clauses share a common variable. Try POS Distributive Law: (A+B)(A+C) = A + BC.`
          : `Two terms share a common variable. Try Distributive Law to factor it out: AB + AC = A(B+C).`
      default:
        return `Look at the current expression — a simplification is available.`
    }
  } catch {
    return `A simplification is available in the current expression — look carefully.`
  }
}

