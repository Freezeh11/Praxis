/**
 * Shared predicates used across the law builders.
 *
 * These answer "what shape is this node / these two nodes?" — the questions the
 * law detection asks before offering a law. They are deliberately statement-only
 * (no state, no side effects) so the builders can be read as a list of rules.
 */
import { nodeText } from '../render.js'
import { sumContainsLit, termContainsLit } from '../tree.js'
import { cloneN, con, prod } from '../node.js'
import { isEquivalent } from '../equivalence.js'

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

/**
 * Syntactic literal-subset test: every literal of `shorter` also appears in
 * `longer`. This is a FAST PATH only — it is NOT a decision procedure.
 *
 * It only looks at literal factors, so it reads `B'(A'C' + AC)` as the bare
 * literal `B'` and `B + B + B'B'` as `B + B`. Using it as the absorption test
 * produced invalid steps (the survivor was kept, but the deleted term was not
 * implied by it). Use `absorbsInSum` / `absorbsInProduct` for the decision.
 */
export function isSubT(shorter, longer) {
  const sLits = getLits(shorter)
  const lLits = getLits(longer)
  if (sLits.length === 0 || sLits.length >= lLits.length) return false
  return sLits.every(sl => lLits.some(ll => ll.v === sl.v && ll.n === sl.n))
}

/** True when the node is a conjunction of literals (a literal or a literal product). */
function isLitProduct(node) {
  if (!node) return false
  if (node.type === 'lit') return true
  return node.type === 'prod' && node.factors.length > 0 && node.factors.every(f => f.type === 'lit')
}

/** True when every literal of `shorter` is a literal factor of `longer`. */
function litsContained(shorter, longer) {
  const sLits = getLits(shorter)
  const lLits = getLits(longer)
  return sLits.length > 0 && sLits.every(sl => lLits.some(ll => ll.v === sl.v && ll.n === sl.n))
}

/**
 * SOP absorption: does `survivor + absorbed` collapse to `survivor`?
 *
 *   X + Y = X   ⟺   Y ⇒ X   ⟺   X ∧ Y ≡ Y
 *
 * The DECISION is the truth-table comparison (bounded: at most 2^6 rows for the
 * variable counts this app allows), so it is correct for every shape a term can
 * have — including products that carry sum factors. The two tests above it are
 * fast ACCEPT paths only, each provably sufficient:
 *   - A + AB = A: a bare literal is implied by any conjunction that carries it
 *     as a literal factor, whatever else that conjunction contains.
 *   - AB + AB(C + D) = AB: a conjunction of literals is implied by any
 *     conjunction whose literal factors cover all of them.
 *
 * @param {object} survivor term that stays, X
 * @param {object} absorbed term that would be dropped, Y
 */
export function absorbsInSum(survivor, absorbed) {
  if (!survivor || !absorbed) return false
  if (survivor.type === 'lit' && termContainsLit(absorbed, survivor.v, survivor.n)) return true
  if (isLitProduct(survivor) && litsContained(survivor, absorbed)) return true
  // Structure-preserving normalization (proposal Module 4). `y + x·x'` IS
  // equivalent to `y`, but only because `x·x'` collapses to the constant 0 —
  // and the proposal requires that constant to be rendered as its own clickable
  // state (`y + 0`) via Annulment, then removed by Identity. The semantic
  // fallback below therefore refuses to swallow a contradiction in one step.
  if (isEquivalent(cloneN(absorbed), con(0))) return false
  return isEquivalent(prod(cloneN(survivor), cloneN(absorbed)), absorbed)
}

/**
 * POS (dual) absorption: does `survivor · absorbed` collapse to `survivor`?
 *
 *   X · Y = X   ⟺   X ⇒ Y   ⟺   X ∧ Y ≡ X
 *
 * Same structure as `absorbsInSum`: the truth table decides, the syntactic
 * tests are sound fast accepts:
 *   - A(A + B) = A: a bare literal implies any clause containing it.
 *   - AB(A + B + C) = AB: a conjunction of literals implies any clause that
 *     contains one of those literals.
 *
 * @param {object} survivor clause that stays, X
 * @param {object} absorbed clause that would be dropped, Y
 */
export function absorbsInProduct(survivor, absorbed) {
  if (!survivor || !absorbed) return false
  if (survivor.type === 'lit' && sumContainsLit(absorbed, survivor.v, survivor.n)) return true
  if (isLitProduct(survivor) && getLits(survivor).some(sl => sumContainsLit(absorbed, sl.v, sl.n))) return true
  // Structure-preserving normalization (proposal Module 4). `y(x + x')` IS
  // equivalent to `y`, but only because `x + x'` collapses to the constant 1 —
  // and the proposal requires that constant to be rendered as its own clickable
  // state (`y · 1`) via Complement, then removed by Identity. The learner must
  // take those two explicit steps; the semantic fallback refuses to skip them.
  //
  // The syntactic accepts above are unaffected: in `A(A + B) = A` the survivor
  // literal really is present in the clause, so no constant is involved.
  if (isEquivalent(cloneN(absorbed), con(1))) return false
  return isEquivalent(prod(cloneN(survivor), cloneN(absorbed)), survivor)
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
