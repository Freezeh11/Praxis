/**
 * Sandbox tests — input validation, puzzle building, pool and generator.
 * Run: npm test  (node --test src/engine/__tests__/)
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { canonText } from '../render.js'
import { parseExpr } from '../parser.js'
import { extractVariables } from '../equivalence.js'
import { getLegalTransitions, findSimplestForm } from '../solver.js'
import { SANDBOX } from '../../config/gameRules.js'
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

/* ── Configurable variable budget ─────────────────────────────────────────── */

test('the variable budget is one config number, overridable per call', () => {
  assert.equal(MAX_SANDBOX_VARS, SANDBOX.maxVariables, 'MAX_SANDBOX_VARS must mirror config SANDBOX.maxVariables')

  /* Five distinct variables: refused at the configured 4, accepted at 6. */
  const fiveVars = 'A + B + C + D + E'
  const refused = validateSandboxInput(fiveVars)
  assert.equal(refused.valid, false)
  assert.equal(refused.errorCode, 'too-many-vars')
  assert.match(refused.error, /up to 4 variables/)
  assert.match(refused.error, /uses 5/)

  const raised = validateSandboxInput(fiveVars, { maxVariables: 6 })
  assert.equal(raised.valid, true, raised.error)
  assert.equal(validateSandboxInput(fiveVars, { maxVariables: 5 }).valid, true)
  assert.equal(validateSandboxInput(fiveVars, { maxVariables: 4 }).valid, false)

  /* buildSandboxPuzzle takes the same option, so a raised ceiling really
     reaches the workspace: A + B + C + D + AE absorbs down to A + B + C + D. */
  const solvableFiveVars = 'A + B + C + D + AE'
  const blocked = buildSandboxPuzzle(solvableFiveVars)
  assert.equal(blocked.ok, false)
  assert.equal(blocked.errorCode, 'too-many-vars')

  const built = buildSandboxPuzzle(solvableFiveVars, { maxVariables: 6 })
  assert.equal(built.ok, true, built.error)
  assert.equal(built.varCount, 5)
  assert.equal(canonText(parseExpr(built.puzzle.goal)), canonText(parseExpr('A + B + C + D')))
})

test('buildSandboxPuzzle honours an explicit solver budget instead of the config one', () => {
  /* The solver needs at least one expansion to reach a terminal form, so a
     zero budget must surface as the recoverable "too complex" verdict — this
     is the option the UI would shrink for a cheap preview. */
  const starved = { simplestForm: { maxDepth: 0, maxStates: 0 }, optimalPath: { maxDepth: 0, maxStates: 0 } }
  const result = buildSandboxPuzzle('x + xy', { budget: starved })
  assert.equal(result.ok, false)
  assert.equal(result.errorCode, 'not-simplifiable')
  assert.ok(result.error.length > 0, 'even a refused build carries its human-readable message')
})

/* ── The published four-variable expressions ──────────────────────────────── */

test('the published four-variable expressions all build a playable puzzle', () => {
  const expressions = [
    "A'B'C'D + A'B'CD + AB'C'D + AB'CD",
    "A'BC'D + A'BCD + ABC'D + ABCD + A'B'CD",
    "A'BC'D' + A'BC'D + ABC'D' + ABC'D + ABCD + AB'CD",
    "A'BC + ABC + B'C",
    "AB + A'C + BC",
    "A'B'C + A'BC' + A'BC + ABC",
  ]
  for (const expression of expressions) {
    const result = buildSandboxPuzzle(expression)
    assert.equal(result.ok, true, `refused "${expression}" (${result.errorCode}): ${result.error}`)
    const expectedVars = extractVariables(parseExpr(expression)).length
    assert.equal(result.varCount, expectedVars, `"${expression}" lost or gained a variable`)
    assert.ok(result.varCount <= SANDBOX.maxVariables, `"${expression}" left the configured budget`)
    assert.ok(result.puzzle.optimalSteps >= 1, 'a shipped puzzle always needs at least one move')
    assert.equal(
      getLegalTransitions(parseExpr(result.puzzle.goal)).length, 0,
      `goal "${result.puzzle.goal}" of "${expression}" is not terminal`,
    )
  }
})

/* ── Complex (four-variable) generation ───────────────────────────────────── */

test('a complex generated problem is four-variable, deterministic and solver-verified', () => {
  const options = { seed: 3, complex: true }
  const puzzle = generateRandomPuzzle('medium', options)
  assert.ok(puzzle?.expr && puzzle?.goal, 'generated puzzle is incomplete')
  assert.equal(extractVariables(parseExpr(puzzle.expr)).length, SANDBOX.maxVariables,
    `complex generation left the ${SANDBOX.maxVariables}-variable scope: "${puzzle.expr}"`)

  /* The goal must be exactly the simplest form the engine reaches, using the
     same budget the generator verified with. */
  const simplest = findSimplestForm(parseExpr(puzzle.expr), SANDBOX.budget.simplestForm)
  assert.equal(simplest.found, true, `generated "${puzzle.expr}" is not simplifiable`)
  assert.equal(canonText(parseExpr(simplest.text)), canonText(parseExpr(puzzle.goal)),
    'generated goal does not match the simplest form the engine reaches')
  assert.equal(getLegalTransitions(parseExpr(puzzle.goal)).length, 0, 'generated goal is not terminal')

  /* Same seed, same problem — the generator stays reproducible for tests. */
  assert.deepEqual(generateRandomPuzzle('medium', options), puzzle)

  /* The complex pool is opt-in: the default generator keeps its 2-3 variables. */
  const plain = generateRandomPuzzle('medium', { seed: 3 })
  assert.ok(extractVariables(parseExpr(plain.expr)).length <= 3, 'default generation must stay in scope')
})
