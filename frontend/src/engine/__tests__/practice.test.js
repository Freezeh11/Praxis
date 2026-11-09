import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseExpr, canonText, nodeText, isEquivalent } from '../index.js'
import { evaluateLawChoice, independentChoices, planGuidance, selectionLaws } from '../practice.js'
import { usesIndependentSelection } from '../../config/gameRules.js'

const levels = JSON.parse(readFileSync(new URL('../../../../content/levels.json', import.meta.url), 'utf8'))
const references = JSON.parse(readFileSync(new URL('../../../../content/laws.json', import.meta.url), 'utf8'))
const pair = (a, b, isTermSel = true) => [{ path: a, isTermSel }, { path: b, isTermSel }]

test('R7 pilot leaves tutorial, earlier stages, other levels and sandbox guided', () => {
  for (const level of [0, 1, 2, 3, 'sandbox']) {
    for (let i = 0; i < 12; i++) assert.equal(usesIndependentSelection(level, i), level === 1 && i >= 6)
  }
  assert.equal(usesIndependentSelection(1, 12), false)
  const choices = independentChoices(references)
  assert.equal(choices.length, 9)
  assert.equal(new Set(choices.map(l => l.id)).size, choices.length)
  assert.ok(!choices.some(l => ['associative', 'distributive-expand'].includes(l.id)))
})

test('R4 wrong choices preserve the expression and explain law-specific conditions', () => {
  const expr = parseExpr('A + B')
  const before = structuredClone(expr)
  for (const id of ['complement', 'identity', 'annulment', 'absorption', 'idempotent', 'distributive', 'double-neg', 'demorgan-or', 'demorgan-and']) {
    const result = evaluateLawChoice(expr, pair('R.0', 'R.1'), id)
    assert.equal(result.ok, false, id)
    assert.equal(result.code, 'pattern')
    assert.ok(result.message.includes('A and B'))
    assert.ok(result.message.includes('has not changed'))
    assert.deepEqual(expr, before)
  }
  assert.match(evaluateLawChoice(expr, [], 'complement').message, /Select the expression/)
  assert.equal(evaluateLawChoice(expr, [{ path: 'R.9' }], 'complement').code, 'selection')
})

test('R7 accepts every applicable choice, including unary and selected constants', () => {
  const examples = [
    ['A + A\'', pair('R.0', 'R.1'), 'complement', '1'],
    ['A + AB', pair('R.0', 'R.1'), 'absorption', 'A'],
    ['AB + AC', pair('R.0.0', 'R.1.0', false), 'distributive', 'A(B+C)'],
    ['(A+B)\'', [{ path: 'R', isTermSel: false }], 'demorgan-or', "A'B'"],
    ['A + 0', [{ path: 'R.1', isTermSel: false }], 'identity', 'A'],
    ['A0', [{ path: 'R.1', isTermSel: false }], 'annulment', '0'],
  ]
  for (const [text, selection, id, goal] of examples) {
    const expr = parseExpr(text)
    const result = evaluateLawChoice(expr, selection, id)
    assert.equal(result.ok, true, `${text}: ${id}`)
    assert.equal(canonText(result.law.apply()), canonText(parseExpr(goal)))
    assert.ok(isEquivalent(expr, result.law.apply()))
  }
})

test('R5 every authored objective has replayable guide selections without extra steps', () => {
  let checked = 0
  for (const level of levels) for (const puzzle of level.puzzles) {
    let expr = parseExpr(puzzle.expr)
    const goal = canonText(parseExpr(puzzle.goal))
    const used = []
    for (let i = 0; i < puzzle.optimalSteps; i++) {
      const plan = planGuidance(expr, goal, puzzle.targetLaws, used)
      assert.equal(plan.status, 'verified', `${level.id}: ${puzzle.expr}`)
      assert.equal(plan.objective, true)
      assert.equal(plan.stepsRemaining, puzzle.optimalSteps - i)
      const next = plan.transition
      const law = selectionLaws(expr, next.selection).find(l => l.name === next.law)
      assert.ok(law, `guide selection cannot replay ${next.law}`)
      const after = law.apply()
      assert.equal(canonText(after), next.nextCanon)
      assert.ok(isEquivalent(expr, after))
      used.push(law.id)
      expr = after
    }
    assert.equal(canonText(expr), goal)
    for (const id of puzzle.targetLaws) assert.ok(used.includes(id))
    assert.equal(planGuidance(expr, goal).status, 'complete')
    checked++
  }
  assert.equal(checked, 40)
})

test('R5 guidance uses already demonstrated laws and labels inconclusive search', () => {
  const expr = parseExpr('A + AB')
  assert.equal(planGuidance(expr, 'A', ['complement'], [], { maxStates: 0 }).status, 'unverified')
  const missing = planGuidance(expr, 'A', ['complement'])
  assert.equal(missing.status, 'verified')
  assert.equal(missing.objective, false)
  assert.equal(planGuidance(expr, 'A', ['complement'], ['complement']).objective, true)
  assert.equal(planGuidance(parseExpr("A + A'B"), canonText(parseExpr('A+B'))).status, 'unverified')
})

test('R5 guidance adapts to legal reordering and sandbox expansion', () => {
  const expr = parseExpr('AC + AB')
  const plan = planGuidance(expr, canonText(parseExpr('A(B+C)')), ['distributive'])
  assert.equal(plan.status, 'verified')
  assert.equal(nodeText(selectionLaws(expr, plan.transition.selection)[0].apply()), plan.transition.to)
  const custom = planGuidance(parseExpr("A(B+A')"), 'AB', [], [], { allowExpand: true })
  assert.equal(custom.status, 'verified')
  assert.equal(custom.transition.lawId, 'distributive-expand')
})
