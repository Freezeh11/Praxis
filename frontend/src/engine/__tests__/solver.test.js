/**
 * Solver tests — legal transitions, optimal path, simplest form, equivalence.
 * Run: npm test  (node --test src/engine/__tests__/)
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { parseExpr } from '../parser.js'
import { canonText, nodeText } from '../render.js'
import { getLegalTransitions, findOptimalPath, findSimplestForm } from '../solver.js'
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
    // Absorption is semantic, and (x + y)' IS x'y' — so the sum collapses in
    // one absorption step instead of De Morgan + Idempotent.
    ["(x + y)' + x'y'", "x'y'", 1],
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
    // xx' is constantly 0, so it implies xy: semantic absorption removes it in
    // one step (previously Complement + Identity took two).
    'Absorption Law',
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
