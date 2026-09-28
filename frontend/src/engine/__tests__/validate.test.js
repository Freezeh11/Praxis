/**
 * Validation tests — one case per acceptance rule and per rejection reason.
 * Run: npm test  (node --test src/engine/__tests__/)
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { validateExpr } from '../validate.js'

const accepts = (input) => assert.equal(validateExpr(input).valid, true, `expected "${input}" to be valid`)

const rejects = (input, fragment) => {
  const verdict = validateExpr(input)
  assert.equal(verdict.valid, false, `expected "${input}" to be rejected`)
  assert.equal(typeof verdict.error, 'string')
  assert.ok(verdict.error.length > 0, 'rejection must carry a message')
  if (fragment) {
    assert.ok(
      verdict.error.includes(fragment),
      `expected message for "${input}" to contain "${fragment}", got "${verdict.error}"`
    )
  }
}

test('accepts the notation the parser supports', () => {
  for (const input of [
    'x', 'X', '1', '0',
    'x + y', 'x|y', 'xy', 'x*y', 'x·y', 'x&y',
    "x'", '!x', '~x',
    '(x + y)', "(x + y)'", '(x + y)(x + z)',
    'a + b + c', "x'y + xy' + xy", 'x + y + z + w',
  ]) {
    accepts(input)
  }
})

test('rejects a missing expression', () => {
  for (const input of ['', '   ', null, undefined, 42]) {
    rejects(input, 'Expression is required.')
  }
})

test('rejects characters outside the alphabet', () => {
  rejects('x ^ y', 'Invalid characters')
  rejects('x / y', 'Invalid characters')
  rejects('x + $', 'Invalid characters')
})

test('rejects unbalanced parentheses', () => {
  rejects('(x + y', 'missing ")"')
  rejects('x + y)', 'no matching "("')
  rejects('((x)', 'missing ")"')
})

test('rejects an expression with no variable or constant', () => {
  rejects("''", 'at least one variable or constant')
  rejects('()', 'at least one variable or constant')
})

test('rejects operators at the edges', () => {
  rejects('+ x', 'cannot start or end')
  rejects('x +', 'cannot start or end')
  rejects('*x', 'cannot start or end')
})

test('rejects repeated binary operators', () => {
  rejects('x ++ y', 'Two operators in a row')
  rejects('x + · y', 'Two operators in a row')
  rejects('x |& y', 'Two operators in a row')
})

test('rejects bad content next to parentheses', () => {
  rejects('x + (+y)', 'right after "("')
  rejects('(x+)', 'right before ")"')
  rejects('()', 'at least one variable or constant')
})

test('whitespace before a closing parenthesis is tolerated (pre-existing behaviour)', () => {
  // The character-before-')' check looks at the immediate neighbour, so a space
  // hides a trailing operator. Documented as-is: the refactor must not change
  // what this validator accepts, quirk included.
  assert.equal(validateExpr('(x + )').valid, true)
})

test('a valid expression reports no error', () => {
  const verdict = validateExpr('x + xy')
  assert.equal(verdict.valid, true)
  assert.equal(verdict.error, null)
})
