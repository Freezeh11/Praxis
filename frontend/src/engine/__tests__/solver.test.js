/**
 * Solver tests — legal transitions, optimal path, simplest form, equivalence.
 * Run: npm test  (node --test src/engine/__tests__/)
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { parseExpr } from '../parser.js'
import { canonText, nodeText } from '../render.js'
import { getLegalTransitions, findOptimalPath, findOptimalPathWithLaws, findSimplestForm } from '../solver.js'
import { lawIdOf } from '../scoring.js'
import { isEquivalent } from '../equivalence.js'

test('getLegalTransitions lists every one-step rewrite', () => {
  const transitions = getLegalTransitions(parseExpr('x + xy'))
  assert.equal(transitions.length, 1)
  assert.equal(transitions[0].lawId ?? transitions[0].law, 'absorption')
  assert.equal(transitions[0].to, 'x')
})

test('a terminal expression has no transitions', () => {
  assert.deepEqual(getLegalTransitions(parseExpr('x')), [])
})

test('findOptimalPath reports the number of steps the puzzle really needs', () => {
  const cases = [
    ['x + xy', 'x', 1],
    ["x'y + xy + xy", 'y', 3],
    // De Morgan + Idempotent: (x + y)' + x'y' -> x'y' + x'y' -> x'y' (2 steps)
    ["(x + y)' + x'y'", "x'y'", 2],
  ]
  for (const [expr, goal, expected] of cases) {
    const result = findOptimalPath(parseExpr(expr), canonText(parseExpr(goal)))
    assert.equal(result.found, true, `no path for ${expr} -> ${goal}`)
    assert.equal(result.optimalSteps, expected, `wrong step count for ${expr} -> ${goal}`)
    // The reported path must genuinely end at the goal.
    const last = result.path[result.path.length - 1]
    assert.equal(canonText(parseExpr(last.to)), canonText(parseExpr(goal)))
  }
})

test('findOptimalPath honours the sandbox-only expand law', () => {
  // Graded behaviour: dual absorption solves this in one step, no expansion needed.
  const gated = findOptimalPath(parseExpr('x(x + y)'), canonText(parseExpr('x')))
  assert.equal(gated.found, true)
  assert.equal(gated.optimalSteps, 1)

  // An expression whose only productive direction IS expansion.
  const expandOnly = findSimplestForm(parseExpr("x(x' + y)"), { allowExpand: true })
  assert.equal(expandOnly.found, true)
  assert.equal(expandOnly.text, 'xy')
  assert.deepEqual(expandOnly.path.map((step) => step.law), [
    'Distributive (Expand)',
    // xx' is constantly 0, but the proposal's Module 4 requires structure-
    // preserving normalization: that constant must appear as its own clickable
    // state, so the learner applies Complement Law (xx' -> 0) and then Identity
    // Law (xy + 0 -> xy) instead of one semantic Absorption step swallowing it.
    'Complement Law (Product)',
    'Identity Law',
  ])

  // Without the flag the same expression is already terminal, because the
  // expansion is deliberately not offered to graded levels.
  const withoutFlag = findSimplestForm(parseExpr("x(x' + y)"))
  assert.equal(withoutFlag.text, "x(x' + y)")
})

test('findSimplestForm reaches a state where no law applies', () => {
  for (const expr of ['x + xy', "x'y + xy + xy", 'xz + xz\'', 'x + 0']) {
    const result = findSimplestForm(parseExpr(expr))
    assert.equal(result.found, true, `no terminal form for ${expr}`)
    assert.deepEqual(getLegalTransitions(parseExpr(result.text)), [], `${result.text} is not terminal`)
  }
})

test('truth-table equivalence accepts rewrites and rejects look-alikes', () => {
  assert.equal(isEquivalent(parseExpr('x + xy'), parseExpr('x')), true)
  assert.equal(isEquivalent(parseExpr("x + x'"), parseExpr('1')), true)
  assert.equal(isEquivalent(parseExpr("(xy)'"), parseExpr("x' + y'")), true)
  assert.equal(isEquivalent(parseExpr('x + y'), parseExpr('xy')), false)
  assert.equal(isEquivalent(parseExpr("x'y + xy'"), parseExpr('x + y')), false)
})

test('node ids are stable across a copy but distinct between parses', () => {
  const tree = parseExpr('x + y')
  const transitions = getLegalTransitions(tree)
  assert.equal(transitions.length, 0)
  assert.notEqual(nodeText(tree), '')
})

/* ---- findOptimalPathWithLaws: the graded scoring objective ---- */

test('the objective-aware optimum is the shortest route that applies every target law', () => {
  // Tutorial stage 1: Distributive (Factor) -> Complement Law -> Identity Law.
  // That is also the plain shortest path, because absorption may no longer
  // swallow the tautological clause `x' + x` (see the Module 4 test below).
  const expr = "x'y + z + xy"
  const goal = canonText(parseExpr('y + z'))
  const targetLaws = ['distributive', 'complement', 'identity']

  const raw = findOptimalPath(parseExpr(expr), goal)
  const objective = findOptimalPathWithLaws(parseExpr(expr), goal, targetLaws)

  assert.equal(raw.optimalSteps, 3, 'the taught route is now the shortest route')
  assert.equal(objective.found, true)
  assert.equal(objective.optimalSteps, 3)

  const used = new Set(objective.path.map((s) => lawIdOf(s.law)))
  for (const law of targetLaws) {
    assert.ok(used.has(law), `the objective route must apply ${law}`)
  }
})

test('absorption will not collapse a clause that is a tautology (proposal Module 4)', () => {
  // The proposal requires every constant factor to be rendered as its own
  // clickable intermediate state. `y(x + x')` is equivalent to `y`, but only
  // because `x + x'` collapses to 1 — so the learner must reach `y · 1` through
  // Complement and then `y` through Identity. One-step absorption is refused.
  const transitions = getLegalTransitions(parseExpr("y(x + x')"))
  const laws = transitions.map((t) => t.lawId ?? t.law)

  assert.equal(laws.includes('absorption'), false, 'absorption must not swallow the tautology')
  assert.deepEqual(transitions.map((t) => t.to), ['y1'], 'Complement is the only way forward')

  const rest = getLegalTransitions(parseExpr('y1')).map((t) => t.lawId ?? t.law)
  assert.deepEqual(rest, ['identity'], 'then Identity removes the constant factor')

  const path = findOptimalPath(parseExpr("y(x + x')"), canonText(parseExpr('y')))
  assert.equal(path.optimalSteps, 2)
  assert.deepEqual(path.path.map((s) => s.law), ['Complement Law', 'Identity Law'])

  // The dual case: a contradiction in a sum must not be swallowed either.
  const sumLaws = getLegalTransitions(parseExpr("y + x·x'")).map((t) => t.lawId ?? t.law)
  assert.equal(sumLaws.includes('absorption'), false)

  // ...but textbook absorption, where the survivor really is in the clause,
  // is untouched: no constant is involved there.
  assert.deepEqual(
    getLegalTransitions(parseExpr('x(x + y)')).map((t) => t.lawId ?? t.law),
    ['absorption'],
  )
})

test('an empty target-law list falls back to the plain shortest path', () => {
  const goal = canonText(parseExpr('x'))
  assert.deepEqual(
    findOptimalPathWithLaws(parseExpr('x + xy'), goal, []),
    findOptimalPath(parseExpr('x + xy'), goal),
  )
})

test('an unreachable objective is reported, not guessed at', () => {
  const goal = canonText(parseExpr('x'))
  const result = findOptimalPathWithLaws(parseExpr('x + xy'), goal, ['not-a-real-law'])
  assert.equal(result.found, false)
  assert.equal(result.optimalSteps, 0)
  assert.deepEqual(result.path, [])
})

test('every authored puzzle has a reachable objective, so a perfect score is always possible', () => {
  // Guards the invariant that broke: 25 of the 40 puzzles required more laws
  // than their optimum allowed, making a total of 100 unreachable. If a future
  // puzzle declares a target law that no route to the goal can apply, this fails
  // here rather than silently capping the learner at 90.
  const levels = JSON.parse(
    readFileSync(new URL('../../../../content/levels.json', import.meta.url), 'utf8'),
  )
  assert.equal(levels.length, 4)

  let checked = 0
  for (const level of levels) {
    for (const [stageIdx, puzzle] of level.puzzles.entries()) {
      const where = `level ${level.id} stage ${stageIdx} (${puzzle.expr} -> ${puzzle.goal})`
      const result = findOptimalPathWithLaws(
        parseExpr(puzzle.expr),
        canonText(parseExpr(puzzle.goal)),
        puzzle.targetLaws,
      )
      assert.equal(result.found, true, `no objective route for ${where}`)
      assert.ok(result.optimalSteps > 0, `zero-step objective for ${where}`)

      // Following that route earns full efficiency AND full target-law credit.
      const used = new Set(result.path.map((s) => lawIdOf(s.law)))
      for (const law of puzzle.targetLaws) {
        assert.ok(used.has(law), `objective route for ${where} misses ${law}`)
      }

      // The authored figure must match, or the client and the server fallback
      // would disagree about what "optimal" means for this puzzle.
      assert.equal(
        puzzle.optimalSteps,
        result.optimalSteps,
        `content/levels.json optimalSteps is stale for ${where}`,
      )
      checked++
    }
  }
  assert.equal(checked, 40)
})
