/**
 * AST -> string rendering.
 *
 * Two renderings, one purpose each:
 *   nodeText  — display/derivation form, factored and order-sensitive
 *   canonText — canonical form for order-independent structural comparison
 *
 * Both are pure functions of a subtree and both are hot: one law search renders
 * the same subtrees thousands of times, once per candidate step and again for its
 * `from` text. They are memoised in WeakMaps, which need no bound — an entry dies
 * with the node it describes.
 *
 * The two are cached at different granularities because they are read
 * differently. nodeText is asked for individual subtrees over and over (one
 * comparison per law candidate), so every node gets an entry. canonText is asked
 * for whole trees, and the solver canonicalises a freshly cloned candidate tree
 * each time, so a per-node entry would almost always be written once and never
 * read; one entry per tree is the version that pays for itself.
 *
 * In-place edits are the only way a cached string can go stale, and the engine
 * performs them exclusively through tree.js setNode, which forgets the rendering
 * of every node on the edited path: a child's change alters its ancestors' text
 * and nothing below it, so descendants keep their entries.
 *
 * Pure module: no React/DOM/network.
 */

const textCache = new WeakMap()
const canonCache = new WeakMap()

/**
 * Drops the memoised renderings of one node.
 *
 * Exported for setNode, which calls it for the mutated parent and every ancestor
 * above it — the only nodes whose subtree actually changed.
 */
export function forgetRendering(n) {
  if (!n) return
  textCache.delete(n)
  canonCache.delete(n)
}

/** Human-readable text of a node (what the learner sees in the derivation). */
export function nodeText(n) {
  if (!n) return ''
  if (n.type === 'lit') return n.n ? n.v + "'" : n.v
  if (n.type === 'const') return '' + n.val
  const cached = textCache.get(n)
  if (cached !== undefined) return cached
  let text
  if (n.type === 'prod') {
    text = n.factors.map(f => (f.type === 'sum' ? '(' + nodeText(f) + ')' : nodeText(f))).join('')
  } else if (n.type === 'sum') {
    text = n.terms.map(nodeText).join(' + ')
  } else if (n.type === 'not') {
    const inner = nodeText(n.child)
    text = (n.child.type === 'sum' || n.child.type === 'prod') ? '(' + inner + ")'" : inner + "'"
  } else {
    text = ''
  }
  textCache.set(n, text)
  return text
}

/** Canonical text for order-independent structural comparison. */
export function canonText(n) {
  if (!n) return ''
  if (n.type === 'lit') return n.n ? n.v + "'" : n.v
  if (n.type === 'const') return '' + n.val
  const cached = canonCache.get(n)
  if (cached !== undefined) return cached
  const text = canonTextOf(n)
  canonCache.set(n, text)
  return text
}

/** The recursive walk behind canonText; it deliberately skips the cache. */
function canonTextOf(n) {
  if (n.type === 'prod') {
    const lits = [], others = []
    n.factors.forEach(f => { if (f.type === 'lit') lits.push(f); else others.push(f) })
    lits.sort((a, b) => a.v.localeCompare(b.v) || (a.n ? 1 : 0) - (b.n ? 1 : 0))
    const sortedOthers = others.map(canonTextOf).sort()
    return lits.map(canonTextOf).join('') + sortedOthers.map(t => '(' + t + ')').join('')
  }
  if (n.type === 'sum') {
    const ts = n.terms.map(canonTextOf)
    ts.sort()
    return ts.join('+')
  }
  if (n.type === 'not') return '(' + canonTextOf(n.child) + ")'"
  if (n.type === 'lit') return n.n ? n.v + "'" : n.v
  if (n.type === 'const') return '' + n.val
  return ''
}
