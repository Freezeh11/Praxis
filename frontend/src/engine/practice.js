/** Instructional decisions use the existing law builders; no duplicate algebra. */
import { analyzeSelection, analyzeNot, analyzeProductConst, analyzeSumConst } from './laws/index.js'
import { getNode } from './tree.js'
import { nodeText, canonText } from './render.js'
import { parseExpr } from './parser.js'
import { LAW_DEFINITIONS } from './laws/definitions.js'
import { findOptimalPath, findOptimalPathWithLaws, getLegalTransitions } from './solver.js'

export function selectionLaws(expr, selection, options = {}) {
  if (!expr) return []
  if (selection.length === 2) return analyzeSelection(expr, selection, options)
  if (selection.length !== 1) return []
  const path = selection[0].path
  const node = getNode(expr, path)
  if (node?.type === 'not') return analyzeNot(expr, path)
  if (node?.type !== 'const' || !path.includes('.')) return []
  const parentPath = path.slice(0, path.lastIndexOf('.'))
  const parent = getNode(expr, parentPath)
  if (parent?.type === 'prod') return analyzeProductConst(expr, path, node.val, parentPath)
  if (parent?.type === 'sum') return analyzeSumConst(expr, path, node.val, parentPath)
  return []
}

/** Supported actions in palette order; sandbox expansion is an explicit opt-in. */
export function independentChoices(referenceLaws, { lawIds = null, allowExpand = false } = {}) {
  const supported = new Set(LAW_DEFINITIONS.filter(l => allowExpand || l.id !== 'distributive-expand').map(l => l.id))
  const references = allowExpand ? [...referenceLaws, { ...LAW_DEFINITIONS.find(l => l.id === 'distributive-expand'), formulas: ['A(B + C) = AB + AC'] }] : referenceLaws
  const ordered = lawIds ? lawIds.map(id => references.find(l => l.id === id)).filter(Boolean) : references
  return ordered.filter(l => supported.has(l.id)).map(l => ({
    id: l.id, name: l.name, formula: l.formulas.join(' / '), desc: l.desc,
  }))
}

const CONDITIONS = {
  complement: "Complement needs the same expression and its opposite: A + A' = 1 or A · A' = 0. Different variables are not complements.",
  identity: 'Identity removes 0 from a sum or 1 from a product. Select that constant, or the complete operands containing it.',
  annulment: 'Annulment uses 1 in a sum or 0 in a product. Select the dominant constant or the complete operands.',
  idempotent: 'Idempotent combines identical operands in the same sum or product. Select both complete matching operands.',
  absorption: 'Absorption removes a redundant operand, as in A + AB = A or A(A + B) = A. Select the complete operands; one must make the other redundant.',
  distributive: 'Factoring needs matching literals in separate terms or clauses. Select the shared literal in each, rather than both whole terms.',
  'double-neg': 'Double Negation needs two nested negations. Select the outer negation bar of that group.',
  'demorgan-and': "This De Morgan form needs a negated product, (AB)'. Select its outer negation bar.",
  'demorgan-or': "This De Morgan form needs a negated sum, (A+B)'. Select its outer negation bar.",
}

export function evaluateLawChoice(expr, selection, lawId, options = {}) {
  if (options.allowedLawIds && !options.allowedLawIds.includes(lawId)) {
    return { ok: false, code: 'unavailable', message: "Choose a law available in this stage's palette." }
  }
  if (!selection.length || selection.some(s => !getNode(expr, s.path))) {
    return { ok: false, code: 'selection', message: 'Select the expression parts you want to transform, then press Apply.' }
  }
  const laws = selectionLaws(expr, selection, options)
  const law = laws.find(l => l.id === lawId)
  if (law) return { ok: true, code: 'valid', law }
  const selected = selection.map(s => nodeText(getNode(expr, s.path))).join(' and ')
  return {
    ok: false, code: 'pattern',
    message: `Not matched for ${selected}. ${CONDITIONS[lawId] || 'This operation is not supported for this selection.'} The expression has not changed.`,
  }
}

/** A bounded search failure is inconclusive, never proof of impossibility. */
export function planGuidance(expr, goalCanon, requiredLaws = [], usedLaws = [], options = {}) {
  if (canonText(expr) === goalCanon) return { status: 'complete' }
  const remaining = requiredLaws.filter(id => !usedLaws.includes(id))
  let route = findOptimalPathWithLaws(expr, goalCanon, remaining, options)
  let objective = true
  if (!route.found && remaining.length) {
    route = findOptimalPath(expr, goalCanon, options)
    objective = false
  }
  if (!route.found || !route.path.length) return { status: 'unverified' }
  const first = route.path[0]
  const transition = getLegalTransitions(expr, options).find(t =>
    t.law === first.law && t.nextCanon === canonText(parseExpr(first.to)))
  if (!transition?.selection) return { status: 'unverified' }
  return { status: 'verified', objective, stepsRemaining: route.path.length, transition }
}
