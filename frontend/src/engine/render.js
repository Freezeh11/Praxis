/**
 * AST -> string rendering.
 *
 * Two renderings, one purpose each:
 *   nodeText  — display/derivation form, factored and order-sensitive
 *   canonText — canonical form for order-independent structural comparison
 *
 * Pure module: no React/DOM/network.
 */

/** Human-readable text of a node (what the learner sees in the derivation). */
export function nodeText(n) {
  if (!n) return ''
  if (n.type === 'lit') return n.n ? n.v + "'" : n.v
  if (n.type === 'const') return '' + n.val
  if (n.type === 'prod') {
    return n.factors.map(f => (f.type === 'sum' ? '(' + nodeText(f) + ')' : nodeText(f))).join('')
  }
  if (n.type === 'sum') return n.terms.map(nodeText).join(' + ')
  if (n.type === 'not') {
    const inner = nodeText(n.child)
    return (n.child.type === 'sum' || n.child.type === 'prod') ? '(' + inner + ")'" : inner + "'"
  }
  return ''
}

/** Canonical text for order-independent structural comparison. */
export function canonText(n) {
  if (!n) return ''
  if (n.type === 'lit') return n.n ? n.v + "'" : n.v
  if (n.type === 'const') return '' + n.val
  if (n.type === 'prod') {
    const lits = [], others = []
    n.factors.forEach(f => { if (f.type === 'lit') lits.push(f); else others.push(f) })
    lits.sort((a, b) => a.v.localeCompare(b.v) || (a.n ? 1 : 0) - (b.n ? 1 : 0))
    const sortedOthers = others.map(canonText).sort()
    return lits.map(canonText).join('') + sortedOthers.map(t => '(' + t + ')').join('')
  }
  if (n.type === 'sum') {
    const ts = n.terms.map(canonText)
    ts.sort()
    return ts.join('+')
  }
  if (n.type === 'not') return '(' + canonText(n.child) + ")'"
  return ''
}
