import test from 'node:test'
import assert from 'node:assert/strict'
import { summarizeProfile } from '../../state/profileSummary.js'

const levels = [{ id: 0, name: 'Tutorial', puzzles: [{ expr: 'A+AB' }] }, { id: 1, name: 'Level 1', puzzles: [{ expr: 'A+A' }, { expr: 'A+0' }] }]

test('profile has an honest empty state before any scores are recorded', () => {
  const result = summarizeProfile({}, levels)
  assert.equal(result.completed, 0)
  assert.equal(result.total, 3)
  assert.equal(result.average, null)
  assert.equal(result.stars, 0)
  assert.deepEqual(result.solutions, [])
})

test('profile deduplicates completed stages and scores, including zero scores', () => {
  const result = summarizeProfile({ stageProgress: { 0: [0, 0], 1: [0, 99] }, stageScores: { '0:0': 90, '1:0': 75, '1:1': 0, '1:99': 100, '9:0': 100 } }, levels)
  assert.equal(result.completed, 3)
  assert.equal(result.stars, 6)
  assert.equal(result.average, 55)
  assert.equal(result.levelProgress[1].completed, 2)
})

test('profile reviews known saved derivations and awards a star for unscored completion', () => {
  const steps = [{ law: 'Absorption', from: 'A+AB', to: 'A' }]
  const result = summarizeProfile({ stageProgress: { 0: [0] }, stageSolutions: { '0:0': steps, '1:0': [], '9:0': steps } }, levels)
  assert.equal(result.stars, 1)
  assert.equal(result.average, null)
  assert.equal(result.solutions.length, 1)
  assert.equal(result.solutions[0].levelId, 0)
  assert.equal(result.solutions[0].stageIdx, 0)
  assert.equal(result.solutions[0].score, null)
  assert.equal(result.solutions[0].steps, steps)
})
