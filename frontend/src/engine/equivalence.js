/**
 * Semantic equivalence — exhaustive truth-table comparison.
 *
 * The engine never trusts "looks the same": two expressions are equivalent when
 * they agree on every assignment of their combined variables (2^n evaluations).
 *
 * Pure module: no React/DOM/network.
 */

/** All variables appearing in a tree, sorted alphabetically. */
export function extractVariables(node) {
  const vars = new Set()
  function walk(n) {
    if (!n) return
    if (n.type === 'lit') vars.add(n.v)
    if (n.type === 'prod') n.factors.forEach(walk)
    if (n.type === 'sum') n.terms.forEach(walk)
    if (n.type === 'not') walk(n.child)
  }
  walk(node)
  return Array.from(vars).sort()
}

/** Evaluates a tree under an assignment `{ x: 0|1, y: 0|1 }`. */
export function evalAST(node, env) {
  if (!node) return 0
  if (node.type === 'const') return node.val
  if (node.type === 'lit') {
    const val = env[node.v] ?? 0
    return node.n ? (val ? 0 : 1) : val
  }
  if (node.type === 'not') {
    return evalAST(node.child, env) ? 0 : 1
  }
  if (node.type === 'prod') {
    return node.factors.every(f => evalAST(f, env) === 1) ? 1 : 0
  }
  if (node.type === 'sum') {
    return node.terms.some(t => evalAST(t, env) === 1) ? 1 : 0
  }
  return 0
}

/** True when both trees produce the same output for every variable assignment. */
export function isEquivalent(ast1, ast2) {
  const vars = Array.from(new Set([...extractVariables(ast1), ...extractVariables(ast2)]))
  const numStates = 1 << vars.length
  for (let i = 0; i < numStates; i++) {
    const env = {}
    for (let j = 0; j < vars.length; j++) {
      env[vars[j]] = (i >> j) & 1
    }
    if (evalAST(ast1, env) !== evalAST(ast2, env)) {
      return false
    }
  }
  return true
}
