import {
  lit, prod, sum,
  cloneN, nodeText, parseExpr, canonText, normalizeFlat, extractVariables,
  validateExpr,
} from './expr.js'
import { findSimplestForm, findOptimalPath } from './solver.js'
import { randomPoolEquation } from './sandboxPool.js'

/**
 * Random practice problem generator for Sandbox mode.
 *
 * The generator starts from a tiny seed expression and repeatedly applies
 * EXPANSIONS that are the exact inverse of laws the game engine can apply.
 * The result is therefore always simplifiable back down by construction, and
 * is additionally verified end-to-end with the same BFS the game uses.
 */

/** Variable pool — kept to 2-3 variables to match Level 1's complexity. */
export const VAR_POOL = ['x', 'y', 'z']

/** Maximum node budget for a generated expression (keeps puzzles manageable). */
const MAX_NODES = 35

const DIFFICULTY_ORDER = ['easy', 'medium', 'hard']

/** Difficulty presets: expansion count range and minimum solvable depth. */
export const DIFFICULTIES = {
  easy: { label: 'Easy', expansions: [1, 2], minSteps: 1 },
  medium: { label: 'Medium', expansions: [2, 3], minSteps: 2 },
  hard: { label: 'Hard', expansions: [3, 4], minSteps: 3 },
}

/** Normalize difficulty input to a known preset key. */
export function normalizeDifficulty(difficulty) {
  const key = String(difficulty || '').toLowerCase()
  return DIFFICULTY_ORDER.includes(key) ? key : 'medium'
}

/** Deterministic 32-bit PRNG (mulberry32) — lets tests reproduce sequences. */
export function makeRng(seed) {
  let a = (seed >>> 0) || 0x9e3779b9
  return function rng() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function randomSeed() {
  return (Math.random() * 0xffffffff) >>> 0
}

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
const isSopRoot = (n) => Boolean(n) && n.type === 'sum' && n.terms.some(t => t.type === 'prod')
const isPosRoot = (n) => Boolean(n) && n.type === 'prod' && n.factors.some(f => f.type === 'sum')

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
 */
function expandOnce(tree, vars, rng, options = {}) {
  const { rules = EXPANSION_RULES, onlyPaths = null, paths = null } = options

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
    const b = pickOne(freeVars, rng)
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
 * Turns a raw expression string into a complete puzzle object shaped like the
 * level data the rest of the app consumes, or null when it is unusable.
 *
 * Verification pipeline (mirrors the engine the player actually uses):
 *  1. the string must pass the expression validator
 *  2. it must survive a nodeText -> parseExpr round-trip canonically
 *  3. findSimplestForm must reach a terminal (fully simplified) state
 *  4. findOptimalPath must reach that terminal state forward from the start
 *  5. the goal must differ from the start and meet the difficulty's minSteps
 *
 * @param {string} exprString
 * @param {string} difficulty
 * @param {number} minSteps
 * @returns {Object|null}
 */
function buildVerifiedPuzzle(exprString, difficulty, minSteps) {
  if (!validateExpr(exprString).valid) return null

  const parsed = parseExpr(exprString)
  if (canonText(parseExpr(nodeText(parsed))) !== canonText(parsed)) return null

  const simplest = findSimplestForm(parsed, { maxDepth: 12, maxStates: 8000 })
  if (!simplest.found || simplest.optimalSteps === 0) return null
  if (simplest.canon === canonText(parsed)) return null

  const solution = findOptimalPath(parsed, simplest.canon, { maxDepth: 12, maxStates: 12000 })
  if (!solution.found || solution.optimalSteps < minSteps) return null

  return {
    expr: nodeText(parsed),
    goal: simplest.text,
    targetLaws: [],
    hints: [],
    optimalSteps: solution.optimalSteps,
    optimalHint: `This one can be fully simplified in ${solution.optimalSteps} step${solution.optimalSteps === 1 ? '' : 's'}.`,
    difficulty,
    solutionPath: solution.path,
  }
}

/** Builds a puzzle from a curated pool entry (no inverse-expansion needed). */
function buildPoolPuzzle(exclude = null, difficulty = 'medium') {
  for (let i = 0; i < 8; i++) {
    const exprString = randomPoolEquation(exclude)
    const puzzle = buildVerifiedPuzzle(exprString, difficulty, 1)
    if (puzzle) return puzzle
  }
  // Hand-verified final fallback — always solvable, never degenerate.
  return buildVerifiedPuzzle("xy + xyz + x'", difficulty, 1)
}

/**
 * Generates a random, guaranteed-solvable practice problem.
 *
 * @param {string} [difficulty='medium'] - 'easy' | 'medium' | 'hard'
 * @param {Object} [options]
 * @param {number} [options.seed] - deterministic seed for reproducible runs
 * @param {string} [options.excludeExpr] - expression the result must differ from
 * @returns {{ expr, goal, targetLaws, hints, optimalSteps, optimalHint, difficulty, solutionPath, seed }}
 */
export function generateRandomPuzzle(difficulty = 'medium', options = {}) {
  const diff = normalizeDifficulty(difficulty)
  const preset = DIFFICULTIES[diff]
  const vars = [...VAR_POOL]
  const seed = Number.isFinite(options.seed) ? (options.seed >>> 0) : randomSeed()
  const rng = makeRng(seed || 1)

  for (let attempt = 0; attempt < 12; attempt++) {
    // Random seed expression: a single literal, or a two-literal product.
    const seedPool = [...vars]
    const v1 = seedPool.splice(Math.floor(rng() * seedPool.length), 1)[0]
    let seedExpr = lit(v1, rng() < 0.5)
    if (rng() < 0.5 && seedPool.length > 0) {
      const v2 = seedPool[Math.floor(rng() * seedPool.length)]
      seedExpr = prod(seedExpr, lit(v2, rng() < 0.5))
    }

    // Choose the algebra form first. This matters because a fresh literal seed
    // is neither a sum nor a product: the first expansion at the ROOT is what
    // decides the overall shape (absorb/complement-split -> SOP, dual rules ->
    // POS).
    const wantSop = rng() < 0.5
    let tree = expandOnce(seedExpr, vars, rng, {
      rules: [wantSop ? 'absorb' : 'dual-absorb'],
      onlyPaths: ['R'],
    })
    if (tree === seedExpr) continue

    // Grow every sibling slot of the root. For a sum-of-products every term is
    // grown as `A -> A + A·B`; for a product-of-sums every clause as
    // `A -> A·(A + B)`. Those are exactly the shapes the engine can absorb or
    // factor back down, so the generated expression always has a real
    // simplification path — a naive single-slot growth regularly produced sums
    // that were already terminal, which is why useGameState would report
    // "already simplified".
    const slots = tree.type === 'sum' ? tree.terms.length : tree.type === 'prod' ? tree.factors.length : 0
    for (let s = 0; s < slots; s++) {
      const grown = expandOnce(tree, vars, rng, {
        paths: ['R.' + s],
        rules: [wantSop ? 'absorb' : 'dual-absorb'],
      })
      if (grown !== tree) tree = grown
    }

    // Optional extra depth: stretch one slot further at the chosen form.
    const expansionCount =
      Math.floor(rng() * (preset.expansions[1] - preset.expansions[0] + 1)) + preset.expansions[0]
    for (let i = 2; i < expansionCount; i++) {
      const slot = Math.floor(rng() * Math.max(1, slots))
      const grown = expandOnce(tree, vars, rng, { paths: ['R.' + slot] })
      if (grown === tree) break
      tree = grown
    }
    tree = normalizeFlat(tree)

    // The root expansion above is what fixes the algebra form; assert it held.
    if (wantSop ? !isSopRoot(tree) : !isPosRoot(tree)) continue

    const exprString = nodeText(tree)
    if (options.excludeExpr && exprString === options.excludeExpr) continue

    const puzzle = buildVerifiedPuzzle(exprString, diff, preset.minSteps)
    if (!puzzle) continue

    return { ...puzzle, seed }
  }

  const fallback = buildPoolPuzzle(options.excludeExpr || null, diff) || buildPoolPuzzle(null, diff)
  return { ...fallback, difficulty: diff, seed }
}

/**
 * Generates a fresh problem that is guaranteed not to repeat `prevExpr`.
 *
 * @param {string|null} prevExpr - expression currently on screen
 * @param {string} [difficulty='medium']
 * @param {Object} [options] - forwarded to generateRandomPuzzle
 */
export function generatePuzzlePair(prevExpr, difficulty = 'medium', options = {}) {
  for (let i = 0; i < 4; i++) {
    const puzzle = generateRandomPuzzle(difficulty, options)
    if (!prevExpr || puzzle.expr !== prevExpr) return puzzle
  }
  // Extremely unlikely: force a pool draw that excludes the current problem.
  const forced = buildPoolPuzzle(prevExpr, normalizeDifficulty(difficulty))
  return { ...forced, difficulty: normalizeDifficulty(difficulty), seed: options.seed ?? randomSeed() }
}
