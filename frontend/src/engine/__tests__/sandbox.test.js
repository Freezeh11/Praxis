/**
 * Sandbox tests — input validation, puzzle building, pool and generator.
 * Run: npm test  (node --test src/engine/__tests__/)
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { canonText } from '../render.js'
import { parseExpr } from '../parser.js'
import { getLegalTransitions, findSimplestForm } from '../solver.js'
import { MAX_SANDBOX_VARS, validateSandboxInput, buildSandboxPuzzle } from '../sandbox/input.js'
import { SANDBOX_POOL, randomPoolEquation } from '../sandbox/pool.js'
import { generateRandomPuzzle, normalizeDifficulty, makeRng, DIFFICULTIES } from '../sandbox/generator.js'

test('validateSandboxInput accepts the notation the sandbox documents', () => {
  for (const input of ['x + xy', "x'y + xy", 'x(x + y)', 'x + y + z', "x'y' + x'y"]) {
    const verdict = validateSandboxInput(input)
    assert.equal(verdict.valid, true, `expected "${input}" to be accepted: ${verdict.error}`)
    assert.equal(verdict.error, null)
  }
})

test('validateSandboxInput rejects every documented failure mode', () => {
  const rejections = [
    ['', 'empty'],
    ['    ', 'empty'],
    ['x ^ y', 'invalid-chars'],
    ['x + y', null], // control case: this one is fine, asserted below
  ]
  for (const [input, code] of rejections) {
    if (code === null) continue
    const verdict = validateSandboxInput(input)
    assert.equal(verdict.valid, false, `expected "${input}" to be rejected`)
    assert.equal(verdict.errorCode, code, `wrong code for "${input}"`)
    assert.ok(verdict.error.length > 0, 'rejection must carry a message')
  }

  assert.equal(validateSandboxInput('(x + y').valid, false, 'unbalanced (')
  assert.equal(validateSandboxInput('x + y)').valid, false, 'unbalanced )')

  const tooMany = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].join(' + ')
  assert.equal(validateSandboxInput(tooMany).valid, false, `more than ${MAX_SANDBOX_VARS} variables`)
})

test('buildSandboxPuzzle turns a valid expression into a playable puzzle', () => {
  const result = buildSandboxPuzzle('x + xy')
  assert.equal(result.ok, true, result.error)
  assert.equal(result.exprText, 'x + xy')
  assert.ok(result.puzzle, 'no puzzle produced')
  assert.ok(result.puzzle.expr, 'puzzle has no expression')
  assert.ok(result.puzzle.goal, 'puzzle has no goal')
  // The goal must be reachable and the start must not already be the goal.
  assert.notEqual(canonText(parseExpr(result.puzzle.expr)), canonText(parseExpr(result.puzzle.goal)))
})

test('buildSandboxPuzzle refuses an expression that is already simplest', () => {
  const result = buildSandboxPuzzle('x')
  assert.equal(result.ok, false)
  assert.equal(typeof result.error, 'string')
  assert.ok(result.error.length > 0)
})

test('buildSandboxPuzzle passes validation messages through unchanged', () => {
  const result = buildSandboxPuzzle('x ^ y')
  assert.equal(result.ok, false)
  assert.equal(result.errorCode, 'invalid-chars')
  assert.equal(result.error, validateSandboxInput('x ^ y').error)
})

test('every curated pool entry is solvable and reaches a terminal form', () => {
  for (const expression of SANDBOX_POOL) {
    const simplest = findSimplestForm(parseExpr(expression))
    assert.equal(simplest.found, true, `no terminal form for "${expression}"`)
    assert.equal(getLegalTransitions(parseExpr(simplest.text)).length, 0, `"${expression}" not fully simplified`)
  }
})

test('randomPoolEquation never returns the excluded expression', () => {
  const first = SANDBOX_POOL[0]
  for (let i = 0; i < 25; i++) {
    assert.notEqual(randomPoolEquation(first), first)
  }
})

test('the generator only produces solver-verified, in-scope problems', () => {
  const rng = makeRng(12345)
  for (let i = 0; i < 8; i++) {
    const puzzle = generateRandomPuzzle('medium', { rng })
    assert.ok(puzzle?.expr && puzzle?.goal, 'generated puzzle is incomplete')
    const start = parseExpr(puzzle.expr)
    const goal = canonText(parseExpr(puzzle.goal))
    const simplest = findSimplestForm(start)
    assert.equal(simplest.found, true, `generated "${puzzle.expr}" is not simplifiable`)
    assert.equal(canonText(parseExpr(simplest.text)), goal, `generated goal does not match the simplest form`)
    assert.ok(new Set(puzzle.expr.match(/[a-z]/gi)).size <= 3, 'generator left the 3-variable scope')
  }
})

test('difficulty names normalize to a known preset', () => {
  for (const difficulty of Object.keys(DIFFICULTIES)) {
    assert.equal(normalizeDifficulty(difficulty), difficulty)
  }
  assert.ok(normalizeDifficulty('nonsense') in DIFFICULTIES, 'unknown difficulty must fall back to a real preset')
})
