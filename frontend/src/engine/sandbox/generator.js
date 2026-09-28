import { lit, prod } from '../node.js'
import { nodeText, canonText } from '../render.js'
import { normalizeFlat } from '../normalize.js'
import { extractVariables, isEquivalent } from '../equivalence.js'
import { validateExpr } from '../validate.js'
import { parseExpr } from '../parser.js'
import { findSimplestForm, findOptimalPath } from '../solver.js'
import { randomPoolEquation } from './pool.js'
import { coverVariables, expandOnce, isPosRoot, isSopRoot } from './expand.js'
import { resolveMaxVariables } from './validate.js'
import { SANDBOX, SOLVER_BUDGET } from '../../config/gameRules.js'

/**
 * Random practice problem generator for Sandbox mode.
 *
 * The generator starts from a tiny seed expression and repeatedly applies
 * EXPANSIONS (./expand.js) that are the exact inverse of laws the game engine
 * can apply. The result is therefore always simplifiable back down by
 * construction, and is additionally verified end-to-end with the same BFS the
 * game uses before it is handed to the workspace.
 *
 * `{ complex: true }` switches to the four-variable pool — the widest problem
 * the configured sandbox budget allows — and covers every pool variable.
 */

/** Variable pool — the default 2-3 variable scope (Level 1 complexity). */
export const VAR_POOL = ['x', 'y', 'z']

/** Four-variable pool for `{ complex: true }` — the proposal's boss-tier width. */
export const VAR_POOL_COMPLEX = ['w', 'x', 'y', 'z']

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

/**
 * Turns a raw expression string into a complete puzzle object shaped like the
 * level data the rest of the app consumes, or null when it is unusable.
 *
 * Verification pipeline (mirrors the engine the player actually uses):
 *  1. the string must pass the expression validator
 *  2. it must survive a nodeText -> parseExpr round-trip canonically
 *  3. its variable count must be inside the requested scope
 *  4. findSimplestForm must reach a terminal (fully simplified) state that is
 *     still EQUIVALENT to the start (the goal is never allowed to drift)
 *  5. findOptimalPath must reach that terminal state forward from the start
 *  6. the goal must differ from the start and meet the difficulty's minSteps
 *
 * @param {string} exprString
 * @param {string} difficulty
 * @param {number} minSteps
 * @param {{ simplestForm: object, optimalPath: object }} budget
 * @param {{ min: number, max: number }} scope - allowed distinct-variable count
 * @returns {Object|null}
 */
function buildVerifiedPuzzle(exprString, difficulty, minSteps, budget, scope) {
  if (!validateExpr(exprString).valid) return null

  const parsed = parseExpr(exprString)
  if (canonText(parseExpr(nodeText(parsed))) !== canonText(parsed)) return null
  const varCount = extractVariables(parsed).length
  if (varCount > scope.max || varCount < scope.min) return null

  const simplest = findSimplestForm(parsed, budget.simplestForm)
  if (!simplest.found || simplest.optimalSteps === 0) return null
  if (simplest.canon === canonText(parsed)) return null
  if (!isEquivalent(parsed, simplest.tree)) return null

  const solution = findOptimalPath(parsed, simplest.canon, budget.optimalPath)
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
function buildPoolPuzzle(exclude = null, difficulty = 'medium', budget = SOLVER_BUDGET.generator, maxVariables = 3) {
  const scope = { min: 1, max: maxVariables }
  for (let i = 0; i < 8; i++) {
    const exprString = randomPoolEquation(exclude)
    const puzzle = buildVerifiedPuzzle(exprString, difficulty, 1, budget, scope)
    if (puzzle) return puzzle
  }
  // Hand-verified final fallback — always solvable, never degenerate.
  return buildVerifiedPuzzle("xy + xyz + x'", difficulty, 1, budget, scope)
}

/**
 * Generates a random, guaranteed-solvable practice problem.
 *
 * @param {string} [difficulty='medium'] - 'easy' | 'medium' | 'hard'
 * @param {Object} [options]
 * @param {number} [options.seed] - deterministic seed for reproducible runs
 * @param {string} [options.excludeExpr] - expression the result must differ from
 * @param {boolean} [options.complex] - draw from the four-variable pool
 *   (VAR_POOL_COMPLEX) instead of the two/three-variable one; verified with the
 *   sandbox budget because a 4-variable search is much wider
 * @param {number} [options.maxVariables] - variable ceiling for this call
 *   (default SANDBOX.maxVariables, the same number validateSandboxInput uses)
 * @param {{ simplestForm: object, optimalPath: object }} [options.budget] -
 *   BFS budgets for the verification pass
 * @returns {{ expr, goal, targetLaws, hints, optimalSteps, optimalHint, difficulty, solutionPath, seed }}
 */
export function generateRandomPuzzle(difficulty = 'medium', options = {}) {
  const diff = normalizeDifficulty(difficulty)
  const preset = DIFFICULTIES[diff]
  /* The variable budget is the sandbox's own configured ceiling, so a generated
     problem can never exceed what validateSandboxInput would accept. A problem
     needs two variables to have any move at all, hence the floor of 2. */
  const complex = options.complex === true
  const pool = complex ? VAR_POOL_COMPLEX : VAR_POOL
  const vars = pool.slice(0, Math.min(pool.length, Math.max(2, resolveMaxVariables(options))))
  /* Complex problems must really use the whole pool, so a 4-variable request is
     never quietly answered with a 3-variable problem. */
  const scope = complex ? { min: vars.length, max: vars.length } : { min: 1, max: vars.length }
  /* Complex puzzles get the (larger, measured) sandbox budget; the default
     2-3 variable path keeps the generator budget it has always used. */
  const budget = options.budget ?? (complex ? SANDBOX.budget : SOLVER_BUDGET.generator)
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
    // Complex mode: pull in every pool variable the random growth skipped.
    if (complex) tree = coverVariables(tree, vars, rng)
    tree = normalizeFlat(tree)

    // The root expansion above is what fixes the algebra form; assert it held.
    if (wantSop ? !isSopRoot(tree) : !isPosRoot(tree)) continue

    const exprString = nodeText(tree)
    if (options.excludeExpr && exprString === options.excludeExpr) continue

    const puzzle = buildVerifiedPuzzle(exprString, diff, preset.minSteps, budget, scope)
    if (!puzzle) continue

    return { ...puzzle, seed }
  }

  /* Last resort: the curated pool is two/three-variable, so a complex request
     that exhausted the attempts above degrades to a smaller problem rather than
     shipping an unverified one. */
  const fallback = buildPoolPuzzle(options.excludeExpr || null, diff, budget, vars.length)
    || buildPoolPuzzle(null, diff, budget, vars.length)
  return { ...fallback, difficulty: diff, seed }
}

/**
 * Generates a fresh problem that is guaranteed not to repeat `prevExpr`.
 *
 * @param {string|null} prevExpr - expression currently on screen
 * @param {string} [difficulty='medium']
 * @param {Object} [options] - forwarded to generateRandomPuzzle (incl. `complex`)
 */
export function generatePuzzlePair(prevExpr, difficulty = 'medium', options = {}) {
  for (let i = 0; i < 4; i++) {
    const puzzle = generateRandomPuzzle(difficulty, options)
    if (!prevExpr || puzzle.expr !== prevExpr) return puzzle
  }
  // Extremely unlikely: force a pool draw that excludes the current problem.
  const complex = options.complex === true
  const poolBudget = options.budget ?? (complex ? SANDBOX.budget : SOLVER_BUDGET.generator)
  const maxVariables = resolveMaxVariables(options)
  const forced = buildPoolPuzzle(prevExpr, normalizeDifficulty(difficulty), poolBudget, maxVariables)
  return { ...forced, difficulty: normalizeDifficulty(difficulty), seed: options.seed ?? randomSeed() }
}
