/**
 * Tree traversal and structural edits.
 *
 * Paths are strings rooted at 'R' where each segment indexes the next level:
 *   'R'      the root
 *   'R.1'    second term/factor of the root
 *   'R.1.0'  first child of that node
 * A 'not' node has a single child addressed as '.0'.
 *
 * Pure module: no React/DOM/network.
 */
import { cloneN, con } from './node.js'

export function getNode(root, path) {
  if (!root) return null
  if (path === 'R') return root
  const parts = path.slice(2).split('.').map(Number)
  let n = root
  for (const i of parts) {
    if (n.type === 'sum') n = n.terms[i]
    else if (n.type === 'prod') n = n.factors[i]
    else if (n.type === 'not') n = n.child
    else return null
    if (!n) return null
  }
  return n
}

export function setNode(root, path, newNode) {
  if (path === 'R') return newNode
  const parts = path.slice(2).split('.').map(Number)
  let n = root
  for (let i = 0; i < parts.length - 1; i++) {
    const idx = parts[i]
    if (n.type === 'sum') n = n.terms[idx]
    else if (n.type === 'prod') n = n.factors[idx]
    else if (n.type === 'not') n = n.child
  }
  const last = parts[parts.length - 1]
  if (n.type === 'sum') n.terms[last] = newNode
  else if (n.type === 'prod') n.factors[last] = newNode
  else if (n.type === 'not') n.child = newNode
  return root
}

/** Deepest sum node that contains both paths as direct children, or null. */
export function findCommonSum(root, p1, p2) {
  const a = p1.split('.'), b = p2.split('.')
  const common = []
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] === b[i]) common.push(a[i]); else break
  }
  if (a.length <= common.length || b.length <= common.length) return null
  const cp = common.join('.')
  const node = getNode(root, cp)
  if (node && node.type === 'sum') {
    const ti1 = parseInt(a[common.length], 10)
    const ti2 = parseInt(b[common.length], 10)
    if (isNaN(ti1) || isNaN(ti2) || !node.terms[ti1] || !node.terms[ti2]) return null
    return { sumPath: cp, sumNode: node, ti1, ti2 }
  }
  return null
}

/** Deepest product node that contains both paths as direct children, or null. */
export function findCommonProd(root, p1, p2) {
  const a = p1.split('.'), b = p2.split('.')
  const common = []
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] === b[i]) common.push(a[i]); else break
  }
  if (a.length <= common.length || b.length <= common.length) return null
  const cp = common.join('.')
  const node = getNode(root, cp)
  if (node && node.type === 'prod') {
    const fi1 = parseInt(a[common.length], 10)
    const fi2 = parseInt(b[common.length], 10)
    if (isNaN(fi1) || isNaN(fi2) || !node.factors[fi1] || !node.factors[fi2]) return null
    return { prodPath: cp, prodNode: node, fi1, fi2 }
  }
  return null
}

/** Removes the first matching literal from a product; empty product becomes 1. */
export function removeLitFromNode(node, v, n) {
  if (node.type === 'lit' && node.v === v && node.n === n) return con(1)
  if (node.type === 'prod') {
    let removed = false
    const nf = []
    for (const f of node.factors) {
      if (!removed && f.type === 'lit' && f.v === v && f.n === n) {
        removed = true
      } else {
        nf.push(cloneN(f))
      }
    }
    if (nf.length === 0) return con(1)
    if (nf.length === 1) return nf[0]
    return { type: 'prod', factors: nf }
  }
  return cloneN(node)
}

/** Removes the first matching literal from a sum; empty sum becomes 0. */
export function removeLitFromSumNode(node, v, n) {
  if (node.type === 'lit' && node.v === v && node.n === n) return con(0)
  if (node.type === 'sum') {
    let removed = false
    const nt = []
    for (const t of node.terms) {
      if (!removed && t.type === 'lit' && t.v === v && t.n === n) {
        removed = true
      } else {
        nt.push(cloneN(t))
      }
    }
    if (nt.length === 0) return con(0)
    if (nt.length === 1) return nt[0]
    return { type: 'sum', terms: nt }
  }
  return cloneN(node)
}

export function termContainsLit(node, v, n) {
  if (node.type === 'lit') return node.v === v && node.n === n
  if (node.type === 'prod') return node.factors.some(f => f.type === 'lit' && f.v === v && f.n === n)
  return false
}

export function sumContainsLit(node, v, n) {
  if (node.type === 'lit') return node.v === v && node.n === n
  if (node.type === 'sum') return node.terms.some(t => t.type === 'lit' && t.v === v && t.n === n)
  return false
}

/** Literal children of a term (product) or of a sum node. */
export function getSumLits(node) {
  if (!node) return []
  if (node.type === 'lit') return [node]
  if (node.type === 'sum') return node.terms.filter(t => t.type === 'lit')
  return []
}

/** True when every literal of `shorter` also appears in `longer`. */
export function isSubSum(shorter, longer) {
  const sLits = getSumLits(shorter)
  const lLits = getSumLits(longer)
  if (sLits.length === 0 || sLits.length >= lLits.length) return false
  return sLits.every(sl => lLits.some(ll => ll.v === sl.v && ll.n === sl.n))
}
