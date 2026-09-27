/**
 * Parser tests — notation, precedence, complements, constants.
 * Run: npm test  (node --test src/engine/__tests__/)
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { parseExpr } from '../parser.js'
import { nodeText, canonText } from '../render.js'
import { extractVariables } from '../equivalence.js'

const text = (input) => nodeText(parseExpr(input))

test('literals, constants and empty input', () => {
  assert.equal(text('x'), 'x')
  assert.equal(text('1'), '1')
  assert.equal(text('0'), '0')
  // An empty / non-string expression degrades to the constant 0 rather than throwing.
  assert.equal(text(''), '0')
  assert.equal(text('   '), '0')
  assert.equal(nodeText(parseExpr(null)), '0')
})

test('OR and AND notation are interchangeable', () => {
  const expected = text('x + y')
  for (const input of ['x + y', 'x | y', 'x ∨ y']) {
    assert.equal(text(input), expected, `OR alias failed for ${input}`)
    assert.equal(canonText(parseExpr(input)), canonText(parseExpr('x + y')))
  }
  const andExpected = text('xy')
  for (const input of ['x*y', 'x·y', 'x.y', 'x&y', 'x y']) {
    assert.equal(text(input), andExpected, `AND alias failed for ${input}`)
  }
})

test('NOT works as both prefix and postfix', () => {
  assert.equal(text("x'"), "x'")
  assert.equal(text('!x'), "x'")
  assert.equal(text('~x'), "x'")
  assert.equal(text('¬x'), "x'")
  // Double negation of a literal collapses to the uncomplemented literal.
  assert.equal(text("x''"), 'x')
  assert.equal(text('!!x'), 'x')
})

test('AND binds tighter than OR', () => {
  const tree = parseExpr('x + yz')
  assert.equal(tree.type, 'sum')
  assert.equal(tree.terms.length, 2)
  assert.equal(nodeText(tree.terms[1]), 'yz')
  assert.equal(tree.terms[1].type, 'prod')
})

test('parentheses group and survive rendering', () => {
  assert.equal(text('(x + y)z'), '(x + y)z')
  assert.equal(text('(x + y)(x + z)'), '(x + y)(x + z)')
  assert.equal(text("(x + y)'"), "(x + y)'")
  // Redundant parentheses around a single term are not preserved.
  assert.equal(text('(x)'), 'x')
})

test('nested groups flatten into a single sum/product level', () => {
  const tree = parseExpr('(x + y) + z')
  assert.equal(tree.type, 'sum')
  assert.equal(tree.terms.length, 3)
  const prod = parseExpr('(xy)z')
  assert.equal(prod.type, 'prod')
  assert.equal(prod.factors.length, 3)
})

test('parse is order-insensitive up to canonText but not nodeText', () => {
  assert.equal(canonText(parseExpr('x + y')), canonText(parseExpr('y + x')))
  assert.notEqual(nodeText(parseExpr('x + y')), nodeText(parseExpr('y + x')))
})

test('every variable is discovered exactly once', () => {
  assert.deepEqual(extractVariables(parseExpr("x'y + xz + y'z")), ['x', 'y', 'z'])
})

test('parsing twice yields structurally identical trees', () => {
  const a = parseExpr("x'y + z + xy")
  const b = parseExpr("x'y + z + xy")
  assert.equal(canonText(a), canonText(b))
  assert.equal(nodeText(a), nodeText(b))
})

test('every parsed node carries an id', () => {
  const tree = parseExpr('(x + y)')
  assert.ok(tree._id, 'root has no _id')
  for (const term of tree.terms) assert.ok(term._id, 'child has no _id')
})
