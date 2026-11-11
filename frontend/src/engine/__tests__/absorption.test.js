/**
 * Absorption regression tests.
 *
 * The bug: Absorption was decided with a literal-subset heuristic, so a step
 * could delete a term the survivor did not imply — `B'(A'C'D + ACD) + A'B'CD`
 * lost `A'B'CD` even though the survivor needed `A'C' + AC`. The same heuristic
 * was unsound for the POS dual when the surviving clause carried a product term
 * (`(B + A'C')(B + C + D)` dropped `B + C + D`).
 *
 * These tests pin the two counterexamples, the four-variable reproduction and
 * the reach the law must keep. Every "is this valid?" assertion here is made
 * with `isEquivalent` (truth tables), never with the engine's own predicate.
 *
 * Run: npm test  (node --test src/engine/__tests__/)
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { parseExpr } from '../parser.js'
import { nodeText, canonText } from '../render.js'
import { isEquivalent } from '../equivalence.js'
import { cloneN, prod } from '../node.js'
import { getLegalTransitions, findOptimalPath, findSimplestForm } from '../solver.js'
import { analyzeSelection, scanHints } from '../laws/index.js'

const term = (path) => ({ path, isTermSel: true })
const literal = (path) => ({ path, isTermSel: false })

/** The solver budgets the reproduction was reported with (sandbox settings). */
const SOLVER_OPTIONS = { maxDepth: 14, maxStates: 24000, allowExpand: true }

/**
 * Independent irredundancy oracle: `survivor` absorbs `absorbed` in a SUM when
 * `absorbed ⇒ survivor`, i.e. `survivor ∧ absorbed ≡ absorbed`. In a PRODUCT the
 * dual: `survivor ⇒ absorbed`, i.e. `survivor ∧ absorbed ≡ survivor`.
 */
const absorbsInSum = (survivor, absorbed) => isEquivalent(prod(cloneN(survivor), cloneN(absorbed)), absorbed)
const absorbsInProduct = (survivor, absorbed) => isEquivalent(prod(cloneN(survivor), cloneN(absorbed)), survivor)

function forEachNode(node, visit) {
  visit(node)
  const children = node.type === 'sum' ? node.terms : node.type === 'prod' ? node.factors : node.type === 'not' ? [node.child] : []
  children.forEach(child => forEachNode(child, visit))
}

/** No sibling term/clause of the result can be absorbed by another. */
function assertIrredundant(tree, label) {
  forEachNode(tree, (node) => {
    if (node.type === 'sum') {
      for (let i = 0; i < node.terms.length; i++) {
        for (let j = 0; j < node.terms.length; j++) {
          if (i === j) continue
          assert.equal(
            absorbsInSum(node.terms[i], node.terms[j]),
            false,
            `${label}: "${nodeText(node.terms[j])}" is absorbed by "${nodeText(node.terms[i])}"`,
          )
        }
      }
    }
    if (node.type === 'prod') {
      for (let i = 0; i < node.factors.length; i++) {
        for (let j = 0; j < node.factors.length; j++) {
          if (i === j) continue
          assert.equal(
            absorbsInProduct(node.factors[i], node.factors[j]),
            false,
            `${label}: "${nodeText(node.factors[j])}" is absorbed by "${nodeText(node.factors[i])}"`,
          )
        }
      }
    }
  })
}

/** Asserts a solver result is a terminal, irredundant, equivalent form. */
function assertSimplifiedResult(expr, options, label) {
  const input = parseExpr(expr)
  const result = findSimplestForm(input, options)
  assert.ok(result.found, `${label}: the solver reported no terminal form`)
  assert.ok(isEquivalent(input, result.tree), `${label}: "${result.text}" is NOT equivalent to "${expr}"`)
  assert.equal(
    getLegalTransitions(result.tree, options).length,
    0,
    `${label}: "${result.text}" is not terminal — a law still applies`,
  )
  assertIrredundant(result.tree, label)
  return result
}

// ── the two unsoundness counterexamples ───────────────────────────────────

test('regression: the reported invalid Absorption step is no longer offered', () => {
  // The exact state the solver reached, and the step that corrupted it:
  //   B'(A'C'D + ACD) + A'B'CD + AB'C'D --Absorption--> B'(A'C'D + ACD) + AB'C'D
  // (the survivor was read as the bare literal B').
  const state = "B'(A'C'D + ACD) + A'B'CD + AB'C'D"
  const tree = parseExpr(state)

  for (const transition of getLegalTransitions(tree, SOLVER_OPTIONS)) {
    assert.ok(
      isEquivalent(tree, parseExpr(transition.to)),
      `${transition.law} turned "${transition.from}" into "${transition.to}" — not equivalent`,
    )
  }

  const absorptionHints = scanHints(tree, 'R', SOLVER_OPTIONS)
    .filter(hint => hint.law === 'absorption')
  assert.equal(
    absorptionHints.some(hint => hint.paths[0] === 'R.0'),
    false,
    `scanHints still suggests absorption at R.0: ${JSON.stringify(absorptionHints)}`,
  )
})

test('regression: POS Absorption no longer drops a clause the survivor does not imply', () => {
  // Literal-subset heuristic: getSumLits(B + A'C') = [B] ⊆ [B, C, D], so
  // (B + C + D) looked absorbed — but at B=0, A=1, C=0, D=0 the survivor is 1
  // and B + C + D is 0.
  const expr = "(B + A'C')(B + C + D)"
  const tree = parseExpr(expr)

  const offered = analyzeSelection(tree, [term('R.0'), term('R.1')])
  assert.equal(
    offered.some(law => law.id === 'absorption'),
    false,
    `absorption must not be offered for "${expr}"; got [${offered.map(l => l.name).join(', ')}]`,
  )
  assert.equal(
    scanHints(tree, 'R').some(hint => hint.law === 'absorption'),
    false,
    `scanHints must not suggest absorption for "${expr}"`,
  )

  // The counter-assignment: survivor 1, dropped clause 0.
  const assignment = { A: 0, B: 0, C: 0, D: 0 }
  assert.equal(evalWith(tree, assignment), 0)
  assert.equal(evalWith(parseExpr("B + A'C'"), assignment), 1)
})

/** Local truth-table evaluation for the single counter-assignment above. */
function evalWith(node, env) {
  if (node.type === 'const') return node.val
  if (node.type === 'lit') return node.n ? (env[node.v] ? 0 : 1) : env[node.v]
  if (node.type === 'not') return evalWith(node.child, env) ? 0 : 1
  if (node.type === 'prod') return node.factors.every(f => evalWith(f, env)) ? 1 : 0
  if (node.type === 'sum') return node.terms.some(t => evalWith(t, env)) ? 1 : 0
  return 0
}

// ── the four-variable reproduction ────────────────────────────────────────

test("regression: A'B'C'D + A'B'CD + AB'C'D + AB'CD simplifies to B'D", () => {
  const expr = "A'B'C'D + A'B'CD + AB'C'D + AB'CD"
  const result = assertSimplifiedResult(expr, SOLVER_OPTIONS, 'reproduction')
  assert.ok(isEquivalent(parseExpr(expr), parseExpr("B'D")), "B'D must be equivalent to the input")
  assert.equal(result.text, "B'D", `expected the minimal form B'D, got "${result.text}"`)
})

// ── the other four reported expressions ───────────────────────────────────

const CASES = [
  {
    expr: "A'BC'D + A'BCD + ABC'D + ABCD + A'B'CD",
    // Independently verified (group by D, then A'BC' + A'BC = A'B, ABC' + ABC = AB):
    //   D(B + A'B'C) ≡ D(B + A'C) ≡ A'CD + BD — the engine reaches a larger
    //   factored form because its law set has no general expansion step.
    knownEquivalentForm: "A'CD + BD",
  },
  {
    expr: "A'BC'D' + A'BC'D + ABC'D' + ABC'D + ABCD + AB'CD",
    // Independently verified by hand: BC'(A'D' + A'D + AD' + AD) = BC' and
    // ABCD + AB'CD = ACD, so F = BC' + ACD.
    knownEquivalentForm: "ACD + BC'",
  },
  {
    expr: "A'BC + ABC + B'C",
    minimal: 'C',
  },
  {
    expr: "AB + A'C + BC",
    // The consensus identity AB + A'C + BC = AB + A'C holds, but the engine
    // reaches the equivalent factored form B(A + C) + A'C instead — see the
    // documented reach limitation below.
    minimal: "AB + A'C",
    reached: false,
  },
]

for (const { expr, minimal, knownEquivalentForm, reached } of CASES) {
  test(`regression: ${expr} stays equivalent, terminal and irredundant`, () => {
    const result = assertSimplifiedResult(expr, SOLVER_OPTIONS, expr)
    const expected = minimal ?? knownEquivalentForm
    assert.ok(
      isEquivalent(parseExpr(expr), parseExpr(expected)),
      `the hand-verified form "${expected}" must be equivalent to "${expr}"`,
    )
    if (minimal && reached !== false) {
      assert.equal(result.text, minimal, `expected the minimal form "${minimal}", got "${result.text}"`)
    }
  })
}

test('documented reach limitation: the consensus form AB + A\'C is not reachable', () => {
  // Honest record of what the engine can and cannot do: AB + A'C IS the minimal
  // form (verified equivalent above), but reaching it needs a consensus /
  // un-factoring step the law set does not have, so findSimplestForm stops at the
  // equivalent B(A + C) + A'C. Update this test if such a law is added.
  const input = parseExpr("AB + A'C + BC")
  const minimal = parseExpr("AB + A'C")
  assert.ok(isEquivalent(input, minimal))

  const result = findSimplestForm(input, SOLVER_OPTIONS)
  assert.equal(result.text, "B(A + C) + A'C", 'the current terminal form for the consensus case changed')
  assert.equal(
    findOptimalPath(input, canonText(minimal), SOLVER_OPTIONS).found,
    false,
    'the minimal consensus form became reachable — update this test and the note above',
  )
})

// ── the law must keep its reach (valid absorptions still offered) ─────────

const REACH_CASES = [
  { expr: 'A + AB', selection: [term('R.0'), term('R.1')], to: 'A' },
  { expr: "A + AB'", selection: [term('R.0'), term('R.1')], to: 'A' },
  { expr: 'A + A(B + C)', selection: [term('R.0'), term('R.1')], to: 'A' },
  { expr: 'A(B + C) + AB', selection: [term('R.0'), term('R.1')], to: 'A(B + C)' },
  { expr: 'AB + AB(C + D)', selection: [term('R.0'), term('R.1')], to: 'AB' },
  { expr: 'A(A + B)', selection: [term('R.0'), term('R.1')], to: 'A' },
  { expr: "A(A + B')", selection: [term('R.0'), term('R.1')], to: 'A' },
  { expr: 'A(A + B + C)', selection: [term('R.0'), term('R.1')], to: 'A' },
  { expr: '(A + B)(A + B + C)', selection: [term('R.0'), term('R.1')], to: 'A + B' },
  { expr: 'AB(A + B + C)', selection: [term('R.0'), term('R.2')], to: 'AB' },
  { expr: "A' + A'B", selection: [term('R.0'), term('R.1')], to: "A'" },
]

for (const { expr, selection, to } of REACH_CASES) {
  test(`reach: ${expr} = ${to} is still offered by Absorption`, () => {
    const tree = parseExpr(expr)
    const law = analyzeSelection(tree, selection).find(candidate => candidate.id === 'absorption')
    assert.ok(law, `absorption is no longer offered for "${expr}"`)
    assert.ok(isEquivalent(tree, law.apply()), `"${expr}" -> "${nodeText(law.apply())}" is not equivalent`)
    assert.equal(nodeText(law.apply()), to)
    assert.ok(
      scanHints(tree, 'R', { allowExpand: true }).some(hint => hint.law === 'absorption'),
      `scanHints no longer reports the absorption in "${expr}"`,
    )
  })
}

test('reach: absorption hints agree with the offered laws (no invalid move is hinted)', () => {
  const expressions = [
    'A + AB',
    'A + A(B + C)',
    'AB + AB(C + D)',
    'A(A + B)',
    '(A + B)(A + B + C)',
    "B'(A'C'D + ACD) + A'B'CD + AB'C'D",
  ]
  for (const expr of expressions) {
    const tree = parseExpr(expr)
    for (const hint of scanHints(tree, 'R', { allowExpand: true })) {
      if (hint.law !== 'absorption') continue
      const isTermSel = true
      const laws = analyzeSelection(tree, hint.paths.map(path => ({ path, isTermSel })), { allowExpand: true })
        .filter(law => law.id === 'absorption')
      assert.ok(laws.length > 0, `hint ${JSON.stringify(hint)} on "${expr}" has no law behind it`)
      for (const law of laws) {
        assert.ok(isEquivalent(tree, law.apply()), `hint ${JSON.stringify(hint)} on "${expr}" is invalid`)
      }
    }
  }
})

test('reach: a literal selection that merely shares literals does not fire Absorption', () => {
  // Guard against the opposite failure: the semantic check must not start
  // offering absorption for selections that are not whole terms.
  const tree = parseExpr('AB + AC')
  const laws = analyzeSelection(tree, [literal('R.0.0'), literal('R.1.0')])
  assert.equal(laws.some(law => law.id === 'absorption'), false, 'absorption needs term selections')
  assert.ok(laws.some(law => law.id === 'distributive'), 'factoring must still be offered')
})
