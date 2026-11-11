/**
 * Semantic equivalence — exhaustive truth-table comparison.
 *
 * The engine never trusts "looks the same": two expressions are equivalent when
 * they agree on every assignment of their combined variables (2^n evaluations).
 *
 * There is no memo around it on purpose. A key would have to be a canonical form
 * of both trees, and building those costs more than the 2–16 tiny evaluations it
 * would replace: keyed on canonical text the answer repeats ~98% of the time and
 * the search still runs ~20% slower, because the sandbox sweeps freshly cloned
 * trees that can never hit a per-node entry. The cost that is actually there is
 * allocation — one env object per assignment and one closure per product/sum
 * evaluation — and that is what the loops below avoid.
 *
 * Pure module: no React/DOM/network.
 */

/** Collects the variables of a subtree into `vars`. */
function collectVariables(node, vars) {
  if (!node) return
  if (node.type === 'lit') {
    vars.add(node.v)
    return
  }
  if (node.type === 'prod') {
    for (let i = 0; i < node.factors.length; i++) collectVariables(node.factors[i], vars)
    return
  }
  if (node.type === 'sum') {
    for (let i = 0; i < node.terms.length; i++) collectVariables(node.terms[i], vars)
    return
  }
  if (node.type === 'not') collectVariables(node.child, vars)
}

/** All variables appearing in a tree, sorted alphabetically. */
export function extractVariables(node) {
  const vars = new Set()
  collectVariables(node, vars)
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
  // Plain loops, not `every`/`some`: the closure they allocate for every
  // product and sum visited is pure garbage on the hot path.
  if (node.type === 'prod') {
    const factors = node.factors
    for (let i = 0; i < factors.length; i++) {
      if (evalAST(factors[i], env) !== 1) return 0
    }
    return 1
  }
  if (node.type === 'sum') {
    const terms = node.terms
    for (let i = 0; i < terms.length; i++) {
      if (evalAST(terms[i], env) === 1) return 1
    }
    return 0
  }
  return 0
}

/** True when both trees produce the same output for every variable assignment. */
export function isEquivalent(ast1, ast2) {
  const vars = Array.from(new Set([...extractVariables(ast1), ...extractVariables(ast2)]))
  const numStates = 1 << vars.length
  // Rewritten in place per assignment: a fresh literal per row is 2^n objects
  // per comparison, and a sandbox search makes millions of comparisons.
  const env = {}
  for (let i = 0; i < numStates; i++) {
    for (let j = 0; j < vars.length; j++) {
      env[vars[j]] = (i >> j) & 1
    }
    if (evalAST(ast1, env) !== evalAST(ast2, env)) {
      return false
    }
  }
  return true
}
