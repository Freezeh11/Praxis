/**
 * Law soundness — the property test for the absorption bug.
 *
 * A law may only ever rewrite an expression into an EQUIVALENT one. The bug this
 * guards against: Absorption was offered on a syntactic literal-subset test, so
 * `B'(A'C'D + ACD) + A'B'CD` lost `A'B'CD` (the survivor's literal `B'` looked
 * like it subsumed the term, but the survivor also required `A'C' + AC`).
 *
 * The test therefore never trusts a predicate: it re-parses the text the engine
 * produced and compares it with the state it came from on every variable
 * assignment (`isEquivalent`). It generates a few hundred random expressions
 * over up to 4 variables in SOP and POS shapes — including products that carry
 * sum factors and clauses that carry product terms — and for EVERY state the
 * solver's BFS visits checks:
 *
 *   1. every transition `getLegalTransitions` returns,
 *   2. every law `analyzeSelection` / `analyzeNot` / `analyzeSumConst` /
 *      `analyzeProductConst` returns for every selection in that state,
 *   3. every hint `scanHints` returns (the hint must correspond to a law that is
 *      really offered, and applying it must preserve equivalence).
 *
 * The generator is seeded, so a failure is reproducible and the run is
 * deterministic. Budgets are passed explicitly (the config budgets belong to the
 * graded puzzles) and the state caps keep the suite fast.
 *
 * Run: npm test  (node --test src/engine/__tests__/)
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { parseExpr } from '../parser.js'
import { nodeText, canonText } from '../render.js'
import { isEquivalent } from '../equivalence.js'
import { getNode } from '../tree.js'
import { getLegalTransitions } from '../solver.js'
import {
  analyzeNot,
  analyzeProductConst,
  analyzeSelection,
  analyzeSumConst,
  scanHints,
} from '../laws/index.js'

// ── deterministic generator ────────────────────────────────────────────────

/** Small deterministic PRNG (mulberry32) so a failing case can be replayed. */
function mulberry32(seed) {
  let a = seed
  return function next() {
    a |= 0
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pick = (rng, list) => list[Math.floor(rng() * list.length)]
const chance = (rng, p) => rng() < p

function randomLiteral(rng, vars) {
  return pick(rng, vars) + (chance(rng, 0.45) ? "'" : '')
}

/** A product of literals, used as a term inside a clause: A'C'D. */
function randomLiteralProduct(rng, vars) {
  const n = 2 + Math.floor(rng() * 2)
  return Array.from({ length: n }, () => randomLiteral(rng, vars)).join('')
}

/** A clause that may contain product terms: (A'C'D + AC). */
function randomClause(rng, vars) {
  const n = 2 + Math.floor(rng() * 2)
  return Array.from({ length: n }, () => (chance(rng, 0.6) ? randomLiteral(rng, vars) : randomLiteralProduct(rng, vars))).join(' + ')
}

/** A SOP term: a literal, or a product that may carry sum factors: B'(A'C' + AC). */
function randomSopTerm(rng, vars) {
  if (chance(rng, 0.35)) return randomLiteral(rng, vars)
  const n = 1 + Math.floor(rng() * 3)
  const factors = []
  for (let i = 0; i < n; i++) {
    factors.push(chance(rng, 0.65) ? randomLiteral(rng, vars) : '(' + randomClause(rng, vars) + ')')
  }
  return factors.join('')
}

/** A POS factor: a literal, or a clause that may carry product terms: (A + B'C). */
function randomPosFactor(rng, vars) {
  if (chance(rng, 0.45)) return randomLiteral(rng, vars)
  const n = 2 + Math.floor(rng() * 3)
  return '(' + Array.from({ length: n }, () => (chance(rng, 0.6) ? randomLiteral(rng, vars) : randomLiteralProduct(rng, vars))).join(' + ') + ')'
}

/** Random expression: up to 4 variables, 1-6 terms, SOP or POS shape. */
function randomExpression(rng) {
  const pool = ['A', 'B', 'C', 'D']
  const vars = pool.slice(0, 2 + Math.floor(rng() * 3))
  const count = 1 + Math.floor(rng() * 6)
  const sop = chance(rng, 0.6)
  const parts = Array.from({ length: count }, () => (sop ? randomSopTerm(rng, vars) : randomPosFactor(rng, vars)))
  return parts.join(sop ? ' + ' : '')
}

// ── harness ────────────────────────────────────────────────────────────────

/**
 * The hint scanner reports paths, not selections. The Guide reconstructs the
 * selection exactly this way (useGameState.activateGuide): term-level laws are
 * applied to whole terms/clauses, the rest to the literal itself.
 */
const TERM_LEVEL_HINTS = new Set(['idempotent', 'absorption', 'complement', 'annulment', 'identity'])

/** Every law a hint could be applied through, using the Guide's own mapping. */
function lawsForHint(tree, hint, options) {
  const found = []
  const { law, paths } = hint
  if (paths.length === 2) {
    const isTermSel = TERM_LEVEL_HINTS.has(law)
    found.push(...analyzeSelection(tree, paths.map(path => ({ path, isTermSel })), options).filter(l => l.id === law))
    return found
  }
  const path = paths[0]
  found.push(...analyzeNot(tree, path).filter(l => l.id === law))
  const parentPath = path === 'R' ? 'R' : path.slice(0, path.lastIndexOf('.'))
  const parent = getNode(tree, parentPath)
  if (parent?.type === 'sum') {
    found.push(...analyzeSumConst(tree, path, getNode(tree, path)?.val, parentPath).filter(l => l.id === law))
  }
  if (parent?.type === 'prod') {
    found.push(...analyzeProductConst(tree, path, getNode(tree, path)?.val, parentPath).filter(l => l.id === law))
  }
  return found
}

/** Every two-node selection the solver or the UI can build in this state. */
function everySelection(tree) {
  const selections = []
  function walk(node, path) {
    if (!node) return
    if (node.type === 'not') {
      walk(node.child, path + '.0')
      return
    }
    const children = node.type === 'sum' ? node.terms : node.type === 'prod' ? node.factors : []
    for (let i = 0; i < children.length; i++) {
      const p1 = path + '.' + i
      for (let j = i + 1; j < children.length; j++) {
        const p2 = path + '.' + j
        // Whole-child selections, in both intents, plus the mixed shapes.
        for (const s1 of [true, false]) {
          for (const s2 of [true, false]) {
            selections.push([{ path: p1, isTermSel: s1 }, { path: p2, isTermSel: s2 }])
          }
        }
        // Literal-level selections (Distributive, Complement) as the solver enumerates them.
        for (const l1 of literalChildren(children[i])) {
          for (const l2 of literalChildren(children[j])) {
            selections.push([
              { path: childPath(children[i], p1, l1), isTermSel: false },
              { path: childPath(children[j], p2, l2), isTermSel: false },
            ])
          }
        }
      }
      walk(children[i], p1)
    }
  }
  walk(tree, 'R')
  return selections
}

/** The literal nodes a two-literal law can select inside a term/clause. */
function literalChildren(node) {
  if (node.type === 'lit') return [node]
  if (node.type === 'prod') return node.factors.filter(f => f.type === 'lit')
  if (node.type === 'sum') return node.terms.filter(t => t.type === 'lit')
  return []
}

/** Path of the first literal `target` inside `node`, assuming it is a direct child. */
function childPath(node, base, target) {
  if (node.type === 'lit') return base
  const children = node.type === 'sum' ? node.terms : node.factors
  return base + '.' + children.indexOf(target)
}

/**
 * Walks the same state graph the solver walks and collects every law
 * application that does not preserve the function.
 *
 * @param {string} text expression to explore
 * @param {object} options engine options (allowExpand)
 * @param {number} maxStates BFS budget for this expression
 */
function collectViolations(text, options, maxStates) {
  const violations = { transitions: [], analyses: [], hints: [], unreachableHints: [] }
  const tree = parseExpr(text)
  const queue = [{ tree, text: nodeText(tree) }]
  const visited = new Set([canonText(tree)])
  let states = 0

  while (queue.length > 0 && states < maxStates) {
    const current = queue.shift()
    states++

    // 1. every transition the solver would take from this state.
    for (const transition of getLegalTransitions(current.tree, options)) {
      if (!isEquivalent(current.tree, parseExpr(transition.to))) {
        violations.transitions.push({ expr: current.text, law: transition.law, to: transition.to })
      }
      if (!visited.has(transition.nextCanon)) {
        visited.add(transition.nextCanon)
        queue.push({ tree: transition.nextTree, text: transition.to })
      }
    }

    // 2. every law the analyze* entry points offer for any selection in this state.
    for (const selection of everySelection(current.tree)) {
      for (const law of analyzeSelection(current.tree, selection, options)) {
        if (!isEquivalent(current.tree, law.apply())) {
          violations.analyses.push({
            expr: current.text,
            law: law.name,
            selection: selection.map(s => s.path + (s.isTermSel ? '(term)' : '(lit)')),
            to: nodeText(law.apply()),
          })
        }
      }
    }
    forEachNode(current.tree, (node, path) => {
      if (node.type === 'not') {
        for (const law of analyzeNot(current.tree, path)) {
          if (!isEquivalent(current.tree, law.apply())) {
            violations.analyses.push({ expr: current.text, law: law.name, selection: [path], to: nodeText(law.apply()) })
          }
        }
        return
      }
      const parentPath = path === 'R' ? 'R' : path.slice(0, path.lastIndexOf('.'))
      const parent = getNode(current.tree, parentPath)
      if (node.type !== 'const' || !parent) return
      const offered = parent.type === 'sum'
        ? analyzeSumConst(current.tree, path, node.val, parentPath)
        : parent.type === 'prod'
          ? analyzeProductConst(current.tree, path, node.val, parentPath)
          : []
      for (const law of offered) {
        if (!isEquivalent(current.tree, law.apply())) {
          violations.analyses.push({ expr: current.text, law: law.name, selection: [path], to: nodeText(law.apply()) })
        }
      }
    })

    // 3. every hint: it must be a move that exists, and it must preserve the function.
    for (const hint of scanHints(current.tree, 'R', options)) {
      const laws = lawsForHint(current.tree, hint, options)
      if (laws.length === 0) {
        violations.unreachableHints.push({ expr: current.text, law: hint.law, paths: hint.paths })
        continue
      }
      for (const law of laws) {
        if (!isEquivalent(current.tree, law.apply())) {
          violations.hints.push({ expr: current.text, law: law.name, paths: hint.paths, to: nodeText(law.apply()) })
        }
      }
    }
  }
  return violations
}

function forEachNode(node, visit, path = 'R') {
  visit(node, path)
  const children = node.type === 'sum' ? node.terms : node.type === 'prod' ? node.factors : node.type === 'not' ? [node.child] : []
  children.forEach((child, index) => forEachNode(child, visit, path + '.' + index))
}

// ── the run (once; the tests below assert on its result) ───────────────────

const EXPANDED = { cases: 300, states: 14, options: { allowExpand: true } }
const GRADED = { cases: 100, states: 10, options: {} }

function runScan({ cases, states, options }, seed) {
  const rng = mulberry32(seed)
  const violations = { transitions: [], analyses: [], hints: [], unreachableHints: [] }
  let visited = 0
  for (let i = 0; i < cases; i++) {
    const text = randomExpression(rng)
    const result = collectViolations(text, options, states)
    visited += 1
    for (const key of Object.keys(violations)) violations[key].push(...result[key])
  }
  return { cases, visited, violations }
}

const expandedScan = runScan(EXPANDED, 0x5EED01)
const gradedScan = runScan(GRADED, 0x5EED02)

function assertNoViolations(scan, kind, description) {
  const found = scan.violations[kind]
  const detail = found.slice(0, 5).map(v => JSON.stringify(v)).join('\n  ')
  assert.equal(
    found.length,
    0,
    `${description}: ${found.length} violation(s) over ${scan.cases} random expressions\n  ${detail}`,
  )
}

test('property (sandbox laws): every transition of every visited state preserves the function', () => {
  assertNoViolations(expandedScan, 'transitions', "a transition changed the function")
})

test('property (sandbox laws): every analyze* law preserves the function', () => {
  assertNoViolations(expandedScan, 'analyses', 'an offered law changed the function')
})

test('property (sandbox laws): every hint is a real move that preserves the function', () => {
  assertNoViolations(expandedScan, 'hints', 'a hint changed the function')
  assertNoViolations(expandedScan, 'unreachableHints', 'a hint pointed at a move the engine does not offer')
})

test('property (graded laws): transitions, laws and hints all preserve the function', () => {
  assertNoViolations(gradedScan, 'transitions', 'a transition changed the function')
  assertNoViolations(gradedScan, 'analyses', 'an offered law changed the function')
  assertNoViolations(gradedScan, 'hints', 'a hint changed the function')
  assertNoViolations(gradedScan, 'unreachableHints', 'a hint pointed at a move the engine does not offer')
})

test('property: the generated corpus really contains the shapes the bug needed', () => {
  // Guards against a green test that only generated literals: the corpus must
  // contain products with sum factors and clauses with product terms.
  const rng = mulberry32(0x5EED01)
  let nested = 0
  let posShape = 0
  let sopShape = 0
  for (let i = 0; i < EXPANDED.cases; i++) {
    const tree = parseExpr(randomExpression(rng))
    forEachNode(tree, (node) => {
      if (node.type === 'prod' && node.factors.some(f => f.type === 'sum')) nested++
      if (node.type === 'sum' && node.terms.some(t => t.type === 'prod')) nested++
    })
    if (tree.type === 'sum') sopShape++
    if (tree.type === 'prod') posShape++
  }
  assert.ok(nested > 100, `expected many nested shapes, saw ${nested}`)
  assert.ok(sopShape > 50, `expected SOP shapes, saw ${sopShape}`)
  assert.ok(posShape > 10, `expected POS shapes, saw ${posShape}`)
})
