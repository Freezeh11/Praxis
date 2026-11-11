import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseExpr } from '../parser.js'
import { canonText } from '../render.js'
import { findOptimalPath, findOptimalPathWithLaws } from '../solver.js'
import { effectiveOptimalSteps, estimateScore, lawsUsedFromSteps } from '../scoring.js'
import { paletteLawIds } from '../../config/gameRules.js'

const levels = JSON.parse(readFileSync(new URL('../../../../content/levels.json', import.meta.url), 'utf8'))
const puzzle = levels.find(level => level.id === 1).puzzles[10]

test('Stage 11 distinguishes the shortest shortcut from the target-law benchmark', () => {
  const start = parseExpr(puzzle.expr)
  const goal = canonText(parseExpr(puzzle.goal))
  const options = { allowedLawIds: paletteLawIds(1, 10) }
  const shortcut = findOptimalPath(start, goal, options)
  const objective = findOptimalPathWithLaws(start, goal, puzzle.targetLaws, options)
  assert.equal(shortcut.found, true)
  assert.equal(objective.found, true)
  assert.equal(shortcut.optimalSteps, 4)
  assert.equal(objective.optimalSteps, 5)
  for (const route of [shortcut, objective]) {
    const optimalSteps = effectiveOptimalSteps({
      optimalSteps: objective.optimalSteps,
      puzzleOptimalSteps: puzzle.optimalSteps,
      stepsUsed: route.path.length,
    })
    const score = estimateScore({
      stepsUsed: route.path.length, optimalSteps,
      targetLaws: puzzle.targetLaws, lawsUsed: lawsUsedFromSteps(route.path),
    })
    assert.equal(score.breakdown.optimalSteps, 5)
    assert.equal(score.efficiency, 40)
    assert.equal(score.targetLaw, route === shortcut ? 20 : 30)
  }
  assert.equal(estimateScore({ stepsUsed: 6, optimalSteps: 5 }).efficiency, 30)
})
