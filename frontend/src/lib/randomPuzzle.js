import {
  lit, prod, sum, neg,
  cloneN, nodeText, parseExpr, normalizeFlat, extractVariables,
} from './expr.js'
import { findSimplestForm } from './solver.js'

/** Variable pool used to generate practice problems. */
const VAR_POOL = ['x', 'y', 'z', 'w']

/** Maximum node budget for a generated expression (keeps puzzles manageable). */
const MAX_NODES = 35

const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
const pick = (arr) => arr[randInt(0, arr.length - 1)]

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
function randomTerm(vars, maxLen = 2) {
  const pool = [...vars]
  const len = randInt(1, Math.min(maxLen, pool.length))
  const chosen = []
  while (chosen.length < len && pool.length > 0) {
    const idx = randInt(0, pool.length - 1)
    chosen.push(pool.splice(idx, 1)[0])
  }
  const factors = chosen.map(v => lit(v, Math.random() < 0.4))
  return factors.length === 1 ? factors[0] : prod(...factors)
}

/** Walks the tree and collects every subnode with a way to replace it. */
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
 * Applies one random equivalence-preserving EXPANSION to the tree.
 *
 * Every rule is the exact inverse of a law the game engine can apply, so
 * the generated expression is guaranteed to be simplifiable back down:
 *  - absorb:            A  ->  A + A·B
 *  - dual-absorb:       A  ->  A·(A + B)
 *  - complement-split:  A  ->  A·B + A·B'
 *  - dual-complement:   A  ->  (A + B)·(A + B')
 *  - double-neg:        A  ->  (A')'
 */
function expandOnce(tree, vars) {
  const subnodes = collectSubnodes(tree)
  const eligible = subnodes.filter(
    s => s.node.type !== 'const' && countNodes(s.node) <= 6,
  )
  if (eligible.length === 0) return tree

  const rules = ['absorb', 'dual-absorb', 'complement-split', 'dual-complement', 'double-neg']
  const start = randInt(0, rules.length - 1)

  for (let attempt = 0; attempt < rules.length; attempt++) {
    const rule = rules[(start + attempt) % rules.length]
    const target = pick(eligible)
    const node = cloneN(target.node)
    const used = new Set(extractVariables(node))
    const freeVars = vars.filter(v => !used.has(v))
    const bPool = freeVars.length > 0 ? freeVars : vars
    const b = pick(bPool)
    const bLit = lit(b, Math.random() < 0.4)
    const bNot = lit(b, !bLit.n)

    let replacement = null
    if (rule === 'absorb') {
      replacement = sum(node, prod(node, randomTerm(vars, 1)))
    } else if (rule === 'dual-absorb') {
      replacement = prod(node, sum(node, randomTerm(vars, 1)))
    } else if (rule === 'complement-split') {
      replacement = sum(prod(node, bLit), prod(node, bNot))
    } else if (rule === 'dual-complement') {
      replacement = prod(sum(node, bLit), sum(node, bNot))
    } else if (rule === 'double-neg') {
      replacement = neg(neg(node))
    }

    if (!replacement) continue
    const next = cloneN(tree)
    replaceNode(next, target.path, replacement)
    if (countNodes(next) > MAX_NODES) continue
    return next
  }

  return tree
}

/** Difficulty presets: expansion count and minimum solvable depth. */
export const DIFFICULTIES = {
  easy: { label: 'Easy', expansions: [1, 2], minSteps: 1 },
  medium: { label: 'Medium', expansions: [2, 3], minSteps: 2 },
  hard: { label: 'Hard', expansions: [3, 5], minSteps: 3 },
}

/**
 * Generates a random, guaranteed-solvable practice problem.
 *
 * Starts from a small "seed" (a single literal or 2-literal product) and
 * repeatedly applies inverse-law expansions, so the engine can always
 * simplify the result back down. The BFS solver then verifies the puzzle
 * and computes the optimal step count.
 *
 * @param {string} [difficulty='medium'] - 'easy' | 'medium' | 'hard'
 * @returns {{ expr: string, goal: string, optimalSteps: number, solutionPath: Array }}
 */
export function generateRandomPuzzle(difficulty = 'medium') {
  const preset = DIFFICULTIES[difficulty] || DIFFICULTIES.medium
  const vars = [...VAR_POOL]

  for (let attempt = 0; attempt < 12; attempt++) {
    // Random seed: a single literal or a two-literal product
    const seedPool = [...vars]
    const v1 = pick(seedPool)
    let seed = lit(v1, Math.random() < 0.5)
    if (Math.random() < 0.5) {
      const rest = seedPool.filter(v => v !== v1)
      if (rest.length > 0) {
        const v2 = pick(rest)
        seed = prod(seed, lit(v2, Math.random() < 0.5))
      }
    }

    let tree = seed
    const expansionCount = randInt(preset.expansions[0], preset.expansions[1])
    for (let i = 0; i < expansionCount; i++) {
      tree = expandOnce(tree, vars)
    }
    tree = normalizeFlat(tree)

    const simplest = findSimplestForm(tree)
    if (
      simplest.found &&
      simplest.optimalSteps >= preset.minSteps &&
      simplest.text !== nodeText(tree)
    ) {
      return {
        expr: nodeText(tree),
        goal: simplest.text,
        optimalSteps: simplest.optimalSteps,
        solutionPath: simplest.path,
      }
    }
  }

  // Last-resort fallback: hand-crafted classic problem, verified by the solver
  const fallbackTree = normalizeFlat(parseExpr("xy + xyz + x'"))
  const simplest = findSimplestForm(fallbackTree)
  if (simplest.found) {
    return {
      expr: nodeText(fallbackTree),
      goal: simplest.text,
      optimalSteps: simplest.optimalSteps,
      solutionPath: simplest.path,
    }
  }
  return {
    expr: nodeText(fallbackTree),
    goal: '1',
    optimalSteps: 2,
    solutionPath: [],
  }
}
