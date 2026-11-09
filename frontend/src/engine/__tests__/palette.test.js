import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseExpr, canonText, getLegalTransitions, findOptimalPathWithLaws, findOptimalPath, isEquivalent, lawIdOf, estimateScore } from '../index.js'
import { independentChoices, evaluateLawChoice, planGuidance } from '../practice.js'
import { paletteLawIds } from '../../config/gameRules.js'

const levels = JSON.parse(readFileSync(new URL('../../../../content/levels.json', import.meta.url), 'utf8'))
const references = JSON.parse(readFileSync(new URL('../../../../content/laws.json', import.meta.url), 'utf8'))
const palette = (levelId, stageIdx) => independentChoices(references, { lawIds: paletteLawIds(levelId, stageIdx) }).map(law => law.id)

test('all 40 puzzles can be completed and fully scored using only their visible palette', () => {
  let checked = 0
  for (const level of levels) for (const [stageIdx, puzzle] of level.puzzles.entries()) {
    const label = `${level.name} Stage ${stageIdx + 1}`
    const allowedLawIds = palette(level.id, stageIdx)
    const options = { allowedLawIds }
    let expr = parseExpr(puzzle.expr)
    const goal = canonText(parseExpr(puzzle.goal))
    const route = findOptimalPathWithLaws(expr, goal, puzzle.targetLaws, options)
    assert.ok(route.found, `${label}: no objective-aware route with visible laws`)
    assert.equal(route.optimalSteps, puzzle.optimalSteps, `${label}: scoring optimum changed`)
    const used = []
    for (const step of route.path) {
      const lawId = lawIdOf(step.law)
      assert.ok(allowedLawIds.includes(lawId), `${label}: hidden ${lawId} needed for ${step.from} -> ${step.to}`)
      const guide = planGuidance(expr, goal, puzzle.targetLaws, used, options)
      assert.equal(guide.status, 'verified', label)
      assert.equal(guide.objective, true, label)
      assert.ok(allowedLawIds.includes(guide.transition.lawId), `${label}: guide uses a hidden law`)
      const verdict = evaluateLawChoice(expr, guide.transition.selection, guide.transition.lawId, options)
      assert.ok(verdict.ok, label)
      const after = verdict.law.apply()
      assert.ok(isEquivalent(expr, after), label)
      used.push(verdict.law.id)
      expr = after
    }
    assert.equal(canonText(expr), goal, label)
    for (const id of puzzle.targetLaws) assert.ok(used.includes(id), `${label}: target ${id} missed`)
    assert.equal(estimateScore({ stepsUsed: used.length, optimalSteps: puzzle.optimalSteps, targetLaws: puzzle.targetLaws, lawsUsed: used, hintsUsed: 0, guidesUsed: 0 }).total, 100, `${label}: perfect score must remain attainable`)
    checked++
  }
  assert.equal(checked, 40)
})

test('reported Level 1 Stage 3 and dual Stage 4 expose Identity for the last step', () => {
  for (const [stageIdx, text] of [[2, 'y1'], [3, 'y+0']]) {
    const allowedLawIds = palette(1, stageIdx)
    assert.ok(allowedLawIds.includes('identity'), `Stage ${stageIdx + 1}`)
    const expr = parseExpr(text)
    const selection = [{ path: 'R.1', isTermSel: false }]
    const result = evaluateLawChoice(expr, selection, 'identity', { allowedLawIds })
    assert.ok(result.ok)
    assert.equal(canonText(result.law.apply()), 'y')
    assert.equal(planGuidance(expr, 'y', [], [], { allowedLawIds }).transition.lawId, 'identity')
  }
})

test('solvers, guidance and application cannot bypass a restricted palette', () => {
  const expr = parseExpr('A1')
  const options = { allowedLawIds: ['complement'] }
  assert.deepEqual(getLegalTransitions(expr, options), [])
  assert.equal(findOptimalPath(expr, 'A', options).found, false)
  assert.equal(findOptimalPathWithLaws(expr, 'A', ['identity'], options).found, false)
  assert.equal(planGuidance(expr, 'A', [], [], options).status, 'unverified')
  assert.equal(evaluateLawChoice(expr, [{ path: 'R.1' }], 'identity', options).code, 'unavailable')
  assert.deepEqual(getLegalTransitions(expr, { allowedLawIds: [] }), [])
})

/** Exhaust the small Level 1 graphs; a wrong move may be a genuine engine dead
 * end, but hiding a law must never introduce an additional dead end. */
test('no reachable Level 1 intermediate state is trapped by a missing palette law', () => {
  const level = levels.find(level => level.id === 1)
  for (const [stageIdx, puzzle] of level.puzzles.entries()) {
    const start = parseExpr(puzzle.expr)
    const goal = canonText(parseExpr(puzzle.goal))
    const options = { allowedLawIds: palette(1, stageIdx) }
    const queue = [start]
    const seen = new Set([canonText(start)])
    for (let index = 0; index < queue.length; index++) {
      assert.ok(queue.length < 5000, 'audit must finish rather than silently truncate')
      const expr = queue[index]
      if (findOptimalPath(expr, goal).found) {
        assert.ok(findOptimalPath(expr, goal, options).found, `Stage ${stageIdx + 1}: palette blocks ${canonText(expr)}`)
        const guide = planGuidance(expr, goal, [], [], options)
        if (canonText(expr) !== goal) {
          assert.equal(guide.status, 'verified')
          assert.ok(options.allowedLawIds.includes(guide.transition.lawId))
          assert.ok(evaluateLawChoice(expr, guide.transition.selection, guide.transition.lawId, options).ok)
        }
      }
      for (const transition of getLegalTransitions(expr, options)) {
        assert.ok(options.allowedLawIds.includes(transition.lawId))
        if (!seen.has(transition.nextCanon)) {
          seen.add(transition.nextCanon)
          queue.push(transition.nextTree)
        }
      }
    }
  }
})
