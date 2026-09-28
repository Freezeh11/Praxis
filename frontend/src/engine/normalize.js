/**
 * AST normalization — the two canonicalisations the engine relies on.
 *
 *   normalize     — full simplification: flattens nesting, drops identity
 *                   elements (0 in sums, 1 in products), folds constants,
 *                   collapses double negation
 *   normalizeFlat — structural flattening only: used where the engine must not
 *                   pre-empt a law the learner should apply themselves
 *
 * Pure module: no React/DOM/network.
 */
import { con, nextNodeId } from './node.js'

export function normalize(n) {
  if (!n) return con(0)
  const baseId = n._id || nextNodeId()
  if (n.type === 'lit' || n.type === 'const') return n._id ? n : { ...n, _id: baseId }
  if (n.type === 'prod') {
    const fs = n.factors.map(normalize)
    const flat = []
    fs.forEach(f => f.type === 'prod' ? flat.push(...f.factors) : flat.push(f))
    const kept = flat.filter(f => !(f.type === 'const' && f.val === 1))
    if (kept.some(f => f.type === 'const' && f.val === 0)) return con(0)
    if (kept.length === 0) return con(1)
    if (kept.length === 1) return kept[0]
    return { type: 'prod', _id: baseId, factors: kept }
  }
  if (n.type === 'sum') {
    const ts = n.terms.map(normalize)
    const flat = []
    ts.forEach(t => t.type === 'sum' ? flat.push(...t.terms) : flat.push(t))
    const kept = flat.filter(t => !(t.type === 'const' && t.val === 0))
    if (kept.some(t => t.type === 'const' && t.val === 1)) return con(1)
    if (kept.length === 0) return con(0)
    if (kept.length === 1) return kept[0]
    return { type: 'sum', _id: baseId, terms: kept }
  }
  if (n.type === 'not') {
    const child = normalize(n.child)
    if (child.type === 'const') return con(1 - child.val)
    if (child.type === 'not') return normalize(child.child)
    return { type: 'not', _id: baseId, child }
  }
  return n
}

export function normalizeFlat(n) {
  if (!n) return con(0)
  const baseId = n._id || nextNodeId()
  if (n.type === 'lit' || n.type === 'const') return n._id ? n : { ...n, _id: baseId }
  if (n.type === 'not') return { type: 'not', _id: baseId, child: normalizeFlat(n.child) }
  if (n.type === 'prod') {
    const fs = n.factors.map(normalizeFlat)
    const flat = []
    fs.forEach(f => f.type === 'prod' ? flat.push(...f.factors) : flat.push(f))
    if (flat.length === 0) return con(1)
    if (flat.length === 1) return flat[0]
    return { type: 'prod', _id: baseId, factors: flat }
  }
  if (n.type === 'sum') {
    const ts = n.terms.map(normalizeFlat)
    const flat = []
    ts.forEach(t => t.type === 'sum' ? flat.push(...t.terms) : flat.push(t))
    if (flat.length === 0) return con(0)
    if (flat.length === 1) return flat[0]
    return { type: 'sum', _id: baseId, terms: flat }
  }
  return n
}
