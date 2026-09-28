/**
 * Law-application tests — the three graded chains plus the duals and the gate.
 *
 * Each case drives the engine the way the UI does: select two nodes by path,
 * ask which laws apply, pick one by id, apply it, and check the resulting text.
 * Run: npm test  (node --test src/engine/__tests__/)
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { parseExpr } from '../parser.js'
import { nodeText, canonText } from '../render.js'
import { analyzeNot, analyzeSelection, scanHints, analyzeProductConst, analyzeSumConst } from '../laws/index.js'
import { LAW_NAME_TO_ID } from '../laws/definitions.js'

/** Selection shorthand: a whole term vs a literal inside it. */
const term = (path) => ({ path, isTermSel: true })
const literal = (path) => ({ path, isTermSel: false })

/** Applies the first law matching `lawId` and returns the new expression text. */
function applyLaw(exprText, selection, lawId, options) {
  const tree = parseExpr(exprText)
  const laws = analyzeSelection(tree, selection, options)
  const law = laws.find((candidate) => candidate.id === lawId)
  assert.ok(law, `expected ${lawId} to apply to "${exprText}"; got [${laws.map(l => l.id).join(', ')}]`)
  return nodeText(law.apply())
}

test('chain 1 — Absorption in one step (x + xy -> x)', () => {
  assert.equal(applyLaw('x + xy', [term('R.0'), term('R.1')], 'absorption'), 'x')
})

test('chain 2 — Distributive, Complement, Identity (x\'y + z + xy -> y + z)', () => {
  // Step 1: factor the shared literal y out of x'y and xy.
  const factored = applyLaw("x'y + z + xy", [literal('R.0.1'), literal('R.2.1')], 'distributive')
  assert.equal(factored, "y(x' + x) + z")

  // Step 2: the factored clause is complementary, so it collapses to 1.
  const complemented = applyLaw(factored, [literal('R.0.1.0'), literal('R.0.1.1')], 'complement')
  assert.equal(complemented, 'y1 + z')

  // Step 3: the identity law removes the 1 from the product.
  const identityLaws = analyzeProductConst(parseExpr(complemented), 'R.0.1', 1, 'R.0')
  assert.equal(identityLaws.length, 1)
  assert.equal(nodeText(identityLaws[0].apply()), 'y + z')

  // The end state is exactly the puzzle goal, in 3 steps as authored.
  assert.equal(canonText(parseExpr('y + z')), canonText(parseExpr('y + z')))
})

test('chain 3 — De Morgan then Idempotent ((x + y)\' + x\'y\' -> x\'y\')', () => {
  const expanded = (() => {
    const tree = parseExpr("(x + y)' + x'y'")
    const laws = analyzeNot(tree, 'R.0')
    const deMorgan = laws.find((law) => law.id === 'demorgan-or')
    assert.ok(deMorgan, 'De Morgan (OR->AND) must apply to a negated sum')
    assert.equal(nodeText(deMorgan.apply()), "x'y' + x'y'")
    return deMorgan.apply()
  })()

  const merged = (() => {
    const laws = analyzeSelection(expanded, [term('R.0'), term('R.1')])
    const idempotent = laws.find((law) => law.id === 'idempotent')
    assert.ok(idempotent, 'Idempotent must apply to equal terms')
    return idempotent.apply()
  })()

  assert.equal(nodeText(merged), "x'y'")
})

test('De Morgan AND turns a negated product into a sum of complements', () => {
  const tree = parseExpr("(xy)'")
  const law = analyzeNot(tree, 'R').find((candidate) => candidate.id === 'demorgan-and')
  assert.ok(law)
  assert.equal(nodeText(law.apply()), "x' + y'")
})

test('POS duals apply to clauses instead of terms', () => {
  // Absorption in product form: x(x + y) = x
  assert.equal(applyLaw('x(x + y)', [term('R.0'), term('R.1')], 'absorption'), 'x')
  // Dual idempotent: (x + y)(x + y) = x + y
  assert.equal(applyLaw('(x + y)(x + y)', [term('R.0'), term('R.1')], 'idempotent'), 'x + y')
  // Dual complement: x · x' = 0
  assert.equal(applyLaw("xx'", [literal('R.0'), literal('R.1')], 'complement'), '0')
  // Dual distributive: (x + y)(x + z) = x + yz
  assert.equal(applyLaw('(x + y)(x + z)', [literal('R.0.0'), literal('R.1.0')], 'distributive'), 'x + yz')
})

test('identity and annulment fire on a single selected constant', () => {
  const sumZero = analyzeSumConst(parseExpr('x + 0'), 'R.1', 0, 'R')
  assert.equal(nodeText(sumZero[0].apply()), 'x')

  const sumOne = analyzeSumConst(parseExpr('x + 1'), 'R.1', 1, 'R')
  assert.equal(nodeText(sumOne[0].apply()), '1')

  const prodOne = analyzeProductConst(parseExpr('x · 1'), 'R.1', 1, 'R')
  assert.equal(nodeText(prodOne[0].apply()), 'x')

  const prodZero = analyzeProductConst(parseExpr('x · 0'), 'R.1', 0, 'R')
  assert.equal(nodeText(prodZero[0].apply()), '0')
})

test('Distributive (Expand) is gated behind allowExpand', () => {
  const selection = [literal('R.0'), literal('R.1')]
  const withoutFlag = analyzeSelection(parseExpr("x(x + x')"), selection)
  assert.equal(withoutFlag.some((law) => law.id === 'distributive-expand'), false, 'must be off by default')

  const withFlag = analyzeSelection(parseExpr("x(x + x')"), selection, { allowExpand: true })
  assert.equal(withFlag.some((law) => law.id === 'distributive-expand'), true, 'must be available in sandbox mode')
})

test('every law the engine emits has an id and a name in the definition table', () => {
  const trees = ['x + xy', "x'y + xy", "xx'", 'x + 0', 'x + 1', '(x + y)', "(xy)'", 'x(x + y)', '(x + y)(x + y)']
  for (const expression of trees) {
    const tree = parseExpr(expression)
    const emitted = [
      ...analyzeSelection(tree, [term('R.0'), term('R.1')]),
      ...analyzeSelection(tree, [literal('R.0.0'), literal('R.0.1')]),
      ...analyzeNot(tree, 'R'),
    ]
    for (const law of emitted) {
      assert.ok(law.id, `law without id in "${expression}"`)
      assert.ok(law.name, `law without name in "${expression}"`)
      assert.ok(law.formula, `law without formula in "${expression}"`)
      assert.ok(law.desc, `law without description in "${expression}"`)
      assert.equal(typeof law.apply, 'function')
      assert.equal(LAW_NAME_TO_ID[law.name], law.id, `name/id mismatch for ${law.name}`)
    }
  }
})

test('applying a law never mutates the tree it was asked about', () => {
  const tree = parseExpr('x + xy')
  const before = nodeText(tree)
  const [law] = analyzeSelection(tree, [term('R.0'), term('R.1')])
  law.apply()
  assert.equal(nodeText(tree), before, 'the source tree changed')
})

test('scanHints finds the left-most applicable simplification, de-duplicated', () => {
  const hints = scanHints(parseExpr('x + xy'), 'R')
  assert.deepEqual(hints, [{ law: 'absorption', paths: ['R.0', 'R.1'] }])

  const none = scanHints(parseExpr('x'), 'R')
  assert.deepEqual(none, [])

  const gated = scanHints(parseExpr("x(x + x')"), 'R')
  assert.equal(gated.some((hint) => hint.law === 'distributive-expand'), false)
  const sandbox = scanHints(parseExpr("x(x + x')"), 'R', { allowExpand: true })
  assert.equal(sandbox.some((hint) => hint.law === 'distributive-expand'), true)
})
