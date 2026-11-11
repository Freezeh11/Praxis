/**
 * Inverse-law expansion machinery for the sandbox generator: the AST edit
 * helpers and the four EXPANSIONS that grow a tiny seed into a practice problem.
 * Every rule is the exact inverse of a law the game engine can apply, so a grown
 * expression is always simplifiable back down by construction.
 *
 * Pure JS, no DOM/network.
 */
import { lit, prod, sum, cloneN } from '../node.js'
import { extractVariables } from '../equivalence.js'

/** Maximum node budget for a generated expression (keeps puzzles manageable). */
const MAX_NODES = 35

function countNodes(n) {
  if (!n) return 0
  if (n.type === 'lit' || n.type === 'const') return 1
  if (n.type === 'not') return 1 + countNodes(n.child)
  if (n.type === 'prod') return 1 + n.factors.reduce((a, f) => a + countNodes(f), 0)
  if (n.type === 'sum') return 1 + n.terms.reduce((a, t) => a + countNodes(t), 0)
  return 1
}

/**
 * Builds a random product of 1..maxLen distinct variables, each possibly
 * negated. Used as the "absorbed" or "split" operand in expansion rules.
 */
function randomTerm(vars, maxLen, rng) {
  const pool = [...vars]
  const len = Math.floor(rng() * Math.min(maxLen, pool.length)) + 1
  const chosen = []
  while (chosen.length < len && pool.length > 0) {
    const idx = Math.floor(rng() * pool.length)
    chosen.push(pool.splice(idx, 1)[0])
  }
  const factors = chosen.map(v => lit(v, rng() < 0.4))
  return factors.length === 1 ? factors[0] : prod(...factors)
}

/** Walks the tree and collects every subnode with a path to replace it. */
function collectSubnodes(node, path = 'R', acc = []) {
  acc.push({ node, path })
  if (node.type === 'sum') {
    node.terms.forEach((c, i) => collectSubnodes(c, `${path}.${i}`, acc))
  } else if (node.type === 'prod') {
    node.factors.forEach((c, i) => collectSubnodes(c, `${path}.${i}`, acc))
  } else if (node.type === 'not') {
    collectSubnodes(node.child, `${path}.0`, acc)
  }
  return acc
}

function replaceNode(root, targetPath, newNode) {
  if (targetPath === 'R') return newNode
  const parts = targetPath.slice(2).split('.').map(Number)
  let n = root
  for (let i = 0; i < parts.length - 1; i++) {
    n = n.type === 'sum' ? n.terms[parts[i]] : n.type === 'prod' ? n.factors[parts[i]] : n.child
    if (!n) return root
  }
  const last = parts[parts.length - 1]
  if (n.type === 'sum') n.terms[last] = newNode
  else if (n.type === 'prod') n.factors[last] = newNode
  else if (n.type === 'not') n.child = newNode
  return root
}

/**
 * Expansion rules, grouped by the shape they produce.
 *  - SOP-inverse:  grow the expression into a Sum of Products
 *  - POS-inverse:  grow the expression into a Product of Sums
 */
const SOP_RULES = ['absorb', 'complement-split']
const POS_RULES = ['dual-absorb', 'dual-complement']
const EXPANSION_RULES = [...SOP_RULES, ...POS_RULES]

/** Pick one element of an array using the supplied rng. */
const pickOne = (arr, rng) => arr[Math.floor(rng() * arr.length)]

/**
 * Root-level shape tests. Only the outermost node decides the algebra form the
 * player sees: a sum with product terms is SOP, a product with sum clauses is
 * POS. Nested interior structure is irrelevant for classification (both shapes
 * can contain sub-expressions of the other form).
 */
export const isSopRoot = (n) => Boolean(n) && n.type === 'sum' && n.terms.some(t => t.type === 'prod')
export const isPosRoot = (n) => Boolean(n) && n.type === 'prod' && n.factors.some(f => f.type === 'sum')

/**
 * Applies one random equivalence-preserving EXPANSION to the tree.
 *
 * Every rule is the exact inverse of a law the game engine can apply:
 *  - absorb:            A  ->  A + A·B
 *  - dual-absorb:       A  ->  A·(A + B)
 *  - complement-split:  A  ->  A·B + A·B'
 *  - dual-complement:   A  ->  (A + B)·(A + B')
 *
 * @param {Object} tree
 * @param {string[]} vars
 * @param {Function} rng
 * @param {Object} [options]
 * @param {string[]} [options.rules] - candidate rules; defaults to all four
 * @param {string[]} [options.onlyPaths] - restrict expansion to these paths
 * @param {string[]} [options.paths] - restrict expansion to a path prefix
 * @param {string} [options.varName] - prefer this variable for the new operand
 *   (used by `coverVariables` to pull every pool variable into the expression)
 */
export function expandOnce(tree, vars, rng, options = {}) {
  const { rules = EXPANSION_RULES, onlyPaths = null, paths = null, varName = null } = options

  let eligible = collectSubnodes(tree).filter(
    s => s.node.type !== 'const' && countNodes(s.node) <= 6,
  )
  if (onlyPaths) eligible = eligible.filter(s => onlyPaths.includes(s.path))
  if (paths) eligible = eligible.filter(s => paths.some(p => s.path === p || s.path.startsWith(p + '.')))
  if (eligible.length === 0) return tree

  const start = Math.floor(rng() * rules.length)

  for (let attempt = 0; attempt < rules.length * 2; attempt++) {
    const rule = rules[(start + attempt) % rules.length]
    const target = pickOne(eligible, rng)
    const node = cloneN(target.node)
    const used = new Set(extractVariables(node))
    const freeVars = vars.filter(v => !used.has(v))

    // Every operand must use variables NOT already in the target node:
    // reusing a variable produces degenerate duplicates (x + xx, xy + xxy)
    // that clutter the UI and blow up the BFS solver's state space.
    if (freeVars.length === 0) continue
    const b = varName && freeVars.includes(varName) ? varName : pickOne(freeVars, rng)
    const bLit = lit(b, rng() < 0.4)
    const bNot = lit(b, !bLit.n)

    let replacement = null
    if (rule === 'absorb') {
      replacement = sum(node, prod(node, randomTerm(freeVars, 1, rng)))
    } else if (rule === 'dual-absorb') {
      replacement = prod(node, sum(node, randomTerm(freeVars, 1, rng)))
    } else if (rule === 'complement-split') {
      replacement = sum(prod(node, bLit), prod(node, bNot))
    } else if (rule === 'dual-complement') {
      replacement = prod(sum(node, bLit), sum(node, bNot))
    }

    if (!replacement) continue
    // NOTE: replaceNode returns the new root — replacing path 'R' swaps the
    // entire tree — so its return value must be used, not the mutated clone.
    const next = replaceNode(cloneN(tree), target.path, replacement)
    if (countNodes(next) > MAX_NODES) continue
    return next
  }

  return tree
}

/**
 * Complex mode only: makes sure every variable of the pool really appears.
 *
 * The expansion rules pick their operand at random, so a 4-variable request can
 * otherwise land on a 3-variable problem. Each missing variable is added with
 * the inverse of Absorption at one existing root slot (`t -> t + t·v`, which is
 * cheap in nodes and always simplifies back), so the result stays a genuine
 * four-variable problem rather than a padded one.
 *
 * @param {Object} tree
 * @param {string[]} vars - the pool the problem must cover
 * @param {Function} rng
 */
export function coverVariables(tree, vars, rng) {
  let out = tree
  for (const variable of vars) {
    if (extractVariables(out).includes(variable)) continue
    const sibling = out.type === 'sum' ? 'terms' : out.type === 'prod' ? 'factors' : null
    const slots = sibling ? out[sibling].map((_, i) => 'R.' + i) : ['R']
    for (const slot of slots) {
      const grown = expandOnce(out, vars, rng, { paths: [slot], rules: ['absorb'], varName: variable })
      if (grown !== out) { out = grown; break }
    }
  }
  return out
}
