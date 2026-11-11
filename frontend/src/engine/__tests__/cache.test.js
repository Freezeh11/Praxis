/**
 * Cache tests — a memoised rendering or transition list must never outlive the
 * tree it describes, and callers must never be able to corrupt one.
 * Run: npm test  (node --test src/engine/__tests__/)
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { parseExpr } from '../parser.js'
import { nodeText, canonText } from '../render.js'
import { setNode } from '../tree.js'
import { getLegalTransitions } from '../solver.js'

test('renderings follow an in-place edit made through setNode', () => {
  const tree = parseExpr('A + B')
  assert.equal(nodeText(tree), 'A + B')
  assert.equal(canonText(tree), 'A+B')

  // setNode mutates the sum in place, so both cached texts must be dropped.
  setNode(tree, 'R.0', parseExpr('C'))
  assert.equal(nodeText(tree), 'C + B')
  assert.equal(canonText(tree), 'B+C')
})

test('the transition cache hands every caller its own array', () => {
  const first = getLegalTransitions(parseExpr('A + AB'))
  assert.ok(first.length > 0)

  // A caller that sorts or truncates its list must not damage the cached one.
  first.length = 0
  const again = getLegalTransitions(parseExpr('A + AB'))
  assert.ok(again.length > 0)
  assert.notStrictEqual(again, first)
})

test('the transition cache keeps palettes and expansion settings apart', () => {
  const expr = parseExpr('A + A')
  const plain = getLegalTransitions(expr)
  assert.ok(plain.length > 0)

  // An empty palette allows no move at all; it must not answer from (or
  // overwrite) the entry for the unrestricted sweep.
  assert.deepEqual(getLegalTransitions(expr, { allowedLawIds: [] }), [])

  const again = getLegalTransitions(expr)
  assert.equal(again.length, plain.length)
})
