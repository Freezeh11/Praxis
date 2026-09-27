/**
 * Shared predicates used across the law builders.
 *
 * These answer "what shape is this node / these two nodes?" — the questions the
 * law detection asks before offering a law. They are deliberately statement-only
 * (no state, no side effects) so the builders can be read as a list of rules.
 */
import { nodeText } from '../render.js'
import { sumContainsLit } from '../tree.js'

/** Literal children of a product, or the node itself when it is a literal. */
export function getLits(node) {
  if (!node) return []
  if (node.type === 'lit') return [node]
  if (node.type === 'prod') return node.factors.filter(f => f.type === 'lit')
  return []
}

/** Structural equality by rendered text (order-sensitive). */
export function termsEq(a, b) {
  return nodeText(a) === nodeText(b)
}

/** True when every literal of `shorter` also appears in `longer` (Absorption). */
export function isSubT(shorter, longer) {
  const sLits = getLits(shorter)
  const lLits = getLits(longer)
  if (sLits.length === 0 || sLits.length >= lLits.length) return false
  return sLits.every(sl => lLits.some(ll => ll.v === sl.v && ll.n === sl.n))
}

/** Paths of the literals of a product/sum node, used by the hint scanner. */
export function findLitPath(node, base, v, n) {
  if (node.type === 'lit' && node.v === v && node.n === n) return base
  if (node.type === 'prod') {
    for (let i = 0; i < node.factors.length; i++) {
      if (node.factors[i].type === 'lit' && node.factors[i].v === v && node.factors[i].n === n)
        return base + '.' + i
    }
  }
  if (node.type === 'sum') {
    for (let i = 0; i < node.terms.length; i++) {
      if (node.terms[i].type === 'lit' && node.terms[i].v === v && node.terms[i].n === n)
        return base + '.' + i
    }
  }
  return null
}

/**
 * Detects the shape A(B + A') — a bare literal factor of a product whose
 * complement appears inside a sibling sum factor. Returns the two factor
 * indices (works in either selection order) or null.
 *
 * Every caller keeps this behind `options.allowExpand`, so graded levels and
 * the random sandbox generator keep their exact current behaviour.
 */
export function findExpandablePair(prodNode, i, j) {
  const a = prodNode?.factors?.[i]
  const b = prodNode?.factors?.[j]
  if (!a || !b) return null

  let litNode
  let clauseNode
  let litIndex
  let sumIndex
  if (a.type === 'lit' && b.type === 'sum') {
    litNode = a; clauseNode = b; litIndex = i; sumIndex = j
  } else if (b.type === 'lit' && a.type === 'sum') {
    litNode = b; clauseNode = a; litIndex = j; sumIndex = i
  } else {
    return null
  }

  // Complement-guarded: for the productive direction we also need A' inside the
  // clause. A general expansion (A(B+C) = AB + AC) is deliberately NOT offered:
  // it turns A(B+C) from "already simplest" into "not simplifiable" and makes
  // the solver search ~20x slower.
  if (clauseNode.terms.length < 2) return null
  if (!sumContainsLit(clauseNode, litNode.v, !litNode.n)) return null

  return { litNode, clauseNode, litIndex, sumIndex }
}
