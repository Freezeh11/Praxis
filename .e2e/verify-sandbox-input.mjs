/**
 * Sandbox free-text input verification (no browser, no backend).
 *
 * Covers the Feature 1 part 1 contract in frontend/src/lib/sandboxInput.js:
 *  1. frozen API surface + return shapes
 *  2. every errorCode with its EXACT spec message, in the spec's order
 *  3. every notation that must be accepted (· * . & | ∨ ' ! ¬, adjacency, 0/1)
 *  4. buildSandboxPuzzle: error passthrough, already-simplest, playable puzzles
 *     (goal is a real terminal form, equivalent, and replayable through the
 *     SAME move set the UI offers), plus the <3s budget
 *  5. normalizeSandboxExpr + the additive expr.js tokenizer mappings
 *  6. gating: the Distributive-Expand law only exists with allowExpand:true
 *
 * Run:  node .e2e/verify-sandbox-input.mjs
 * Exit code is non-zero when any check fails.
 */
import {
  MAX_SANDBOX_VARS, validateSandboxInput, buildSandboxPuzzle, normalizeSandboxExpr,
} from '../frontend/src/lib/sandboxInput.js'
import {
  parseExpr, nodeText, canonText, isEquivalent, extractVariables,
} from '../frontend/src/lib/expr.js'
import { getLegalTransitions, findSimplestForm } from '../frontend/src/lib/solver.js'
import { scanHints, analyzeSelection } from '../frontend/src/lib/laws.js'

/** Option set the sandbox builder uses; the default (no options) is graded levels. */
const SANDBOX_ENGINE = { allowExpand: true }
const GRADED_ENGINE = {}

/* ── Harness ──────────────────────────────────────────────────────────────── */
let passed = 0
let failed = 0
const pass = (name, detail = '') => { passed++; console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ''}`) }
const fail = (name, detail = '') => { failed++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`) }
const check = (ok, name, detail = '') => { ok ? pass(name, detail) : fail(name, detail) }
const section = (title) => console.log(`\n=== ${title} ===`)

/* The spec strings, transcribed independently of the implementation. */
const MSG = {
  empty: 'Please enter a Boolean expression.',
  invalidChars: (chars) => `Invalid character(s) found: ${chars}. Only letters, +, ·, *, ., &, |, ', !, ¬, (), 0, 1 are allowed.`,
  unbalanced: 'Unbalanced parentheses. Check your opening and closing brackets.',
  doubleOperator: (n) => `Two operators in a row. Check around position ${n}.`,
  missingOperand: 'Missing a variable or term.',
  strayNot: 'A NOT symbol must attach to a variable, constant, or parenthesized group.',
  tooManyVars: (n) => `Sandbox supports up to 6 variables. Your expression uses ${n}.`,
  alreadySimplest: 'This expression is already in its simplest form. Try a more complex one!',
  notSimplifiable: 'This expression is too complex for the sandbox engine. Try a simpler one.',
}

/* ── 1. Frozen API surface ────────────────────────────────────────────────── */
section('1. Frozen API surface')
check(MAX_SANDBOX_VARS === 6, 'MAX_SANDBOX_VARS === 6', `got ${MAX_SANDBOX_VARS}`)
check(typeof validateSandboxInput === 'function', 'validateSandboxInput is a function')
check(typeof buildSandboxPuzzle === 'function', 'buildSandboxPuzzle is a function')
check(typeof normalizeSandboxExpr === 'function', 'normalizeSandboxExpr is a function')

{
  const ok = validateSandboxInput('A + B')
  check(
    ok && ok.valid === true && ok.error === null && ok.errorCode === null,
    'valid result shape is { valid:true, error:null, errorCode:null }',
    JSON.stringify(ok),
  )
  const bad = validateSandboxInput('A++B')
  check(
    bad && bad.valid === false && typeof bad.error === 'string' && typeof bad.errorCode === 'string',
    'invalid result shape is { valid:false, error:string, errorCode:string }',
    JSON.stringify(bad),
  )
}

/* ── 2. Exact messages + validation order ─────────────────────────────────── */
section('2. Validation errors (exact message, spec order)')

const expectError = (raw, errorCode, error) => {
  const label = `validate(${JSON.stringify(raw)}) -> ${errorCode}`
  const res = validateSandboxInput(raw)
  if (res.valid !== false) return fail(label, `expected invalid, got ${JSON.stringify(res)}`)
  if (res.errorCode !== errorCode) return fail(label, `errorCode=${JSON.stringify(res.errorCode)}`)
  if (res.error !== error) {
    return fail(label, `message mismatch\n          expected: ${JSON.stringify(error)}\n          got:      ${JSON.stringify(res.error)}`)
  }
  pass(label, JSON.stringify(error))
}

/* empty */
expectError('', 'empty', MSG.empty)
expectError('   ', 'empty', MSG.empty)
expectError('\n\t ', 'empty', MSG.empty)

/* invalid-chars — first-appearance order, de-duplicated */
expectError('A & B @ C', 'invalid-chars', MSG.invalidChars('@'))
expectError('A # B $', 'invalid-chars', MSG.invalidChars('#, $'))
expectError('x@y@z', 'invalid-chars', MSG.invalidChars('@'))
expectError('A~B', 'invalid-chars', MSG.invalidChars('~')) // ~ is deliberately NOT allowed
expectError('A?B', 'invalid-chars', MSG.invalidChars('?'))
expectError('A[…B', 'invalid-chars', MSG.invalidChars('[, …')) // first-appearance order

/* unbalanced */
expectError('(A+B', 'unbalanced', MSG.unbalanced)
expectError('A+B)', 'unbalanced', MSG.unbalanced)
expectError('(A+B))', 'unbalanced', MSG.unbalanced)
expectError('((A+B)', 'unbalanced', MSG.unbalanced)

/* too-many-vars */
expectError('ABCDEFG', 'too-many-vars', MSG.tooManyVars(7))
expectError('abcdefg', 'too-many-vars', MSG.tooManyVars(7))
expectError('AaBbCcD', 'too-many-vars', MSG.tooManyVars(7)) // case-sensitive: 7 distinct
check(validateSandboxInput('AaBbCc').valid, '6 distinct case-sensitive variables are accepted')
check(validateSandboxInput('AAAAAA').valid, 'repeated letters stay within the variable budget')

/* double-operator — N is the 1-based index of the SECOND operator in the RAW input */
expectError('A++B', 'double-operator', MSG.doubleOperator(3))
expectError('A+·B', 'double-operator', MSG.doubleOperator(3))
expectError('A + · B', 'double-operator', MSG.doubleOperator(5))
expectError(' AB ++ C', 'double-operator', MSG.doubleOperator(6))
expectError('A&|B', 'double-operator', MSG.doubleOperator(3))
expectError('A.|B', 'double-operator', MSG.doubleOperator(3))

/* missing-operand */
expectError('(+A)', 'missing-operand', MSG.missingOperand)
expectError('A+', 'missing-operand', MSG.missingOperand)
expectError('()', 'missing-operand', MSG.missingOperand)
expectError('(  )', 'missing-operand', MSG.missingOperand)
expectError('+A', 'missing-operand', MSG.missingOperand)
expectError('*A', 'missing-operand', MSG.missingOperand)
expectError('(A+)', 'missing-operand', MSG.missingOperand)
expectError('A()', 'missing-operand', MSG.missingOperand)

/* stray-not */
expectError('A !', 'stray-not', MSG.strayNot)
expectError("!'", 'stray-not', MSG.strayNot)
expectError('!', 'stray-not', MSG.strayNot)
expectError("'", 'stray-not', MSG.strayNot)
expectError('¬', 'stray-not', MSG.strayNot)
expectError('A + !', 'stray-not', MSG.strayNot)
expectError('!()', 'missing-operand', MSG.missingOperand) // empty group wins over the stray NOT

/* order: first failure wins */
expectError('ABCDEFG++', 'too-many-vars', MSG.tooManyVars(7))          // vars before double-op
expectError('(ABCDEFG', 'unbalanced', MSG.unbalanced)                   // parens before vars
expectError('A@B++C', 'invalid-chars', MSG.invalidChars('@'))           // chars before everything
expectError('A++B)', 'unbalanced', MSG.unbalanced)                      // parens before double-op
expectError('A@)', 'invalid-chars', MSG.invalidChars('@'))
expectError('A !', 'stray-not', MSG.strayNot)                           // stray NOT, not missing operand

/* ── 3. Accepted notation ─────────────────────────────────────────────────── */
section('3. Accepted notation (all must validate)')
const VALID = [
  "A(B + A')", "AB + A'C", "!(A * B) + C'", "(x+y)(x'+z)",
  'AB', 'A.B', 'A·B', 'A&B', 'A|B', 'A∨B', '¬A', '!A', "A'", '0', '1', 'A(B+C)',
  'A.B&C|D', 'A + B + C + D + E + F', "AB'C + A'BC'", '(A+B)', '((A))',
  'A B', '!!!!A', "A''", '1 + A', 'A1', '  A  +  B  ',
]
for (const raw of VALID) {
  const res = validateSandboxInput(raw)
  check(res.valid === true, `validate(${JSON.stringify(raw)}) -> valid`, res.valid ? '' : `${res.errorCode}: ${res.error}`)
}

/* ── 4. buildSandboxPuzzle ────────────────────────────────────────────────── */
section('4. buildSandboxPuzzle')

/* 4a. validation errors are passed through unchanged */
for (const raw of ['', '   ', 'A++B', 'A & B @ C', '(A+B', 'A+', 'A !', 'ABCDEFG']) {
  const v = validateSandboxInput(raw)
  const r = buildSandboxPuzzle(raw)
  check(
    r.ok === false && r.errorCode === v.errorCode && r.error === v.error,
    `build(${JSON.stringify(raw)}) passes the validation error through unchanged`,
    `${r.errorCode}: ${JSON.stringify(r.error)}`,
  )
}

/* 4b. the spec's built-in rejection message for custom input */
for (const raw of ['A !', '(+A)']) {
  const r = buildSandboxPuzzle(raw)
  check(r.ok === false && r.error === MSG.strayNot || r.error === MSG.missingOperand,
    `build(${JSON.stringify(raw)}) is rejected with its exact spec message`)
}

/* 4c. "A" validates but is already its simplest form */
{
  const v = validateSandboxInput('A')
  const r = buildSandboxPuzzle('A')
  check(v.valid === true, '"A" validates as valid')
  check(r.ok === false && r.errorCode === 'already-simplest' && r.error === MSG.alreadySimplest,
    'build("A") -> already-simplest with the exact spec message', JSON.stringify(r))
}
{
  const r = buildSandboxPuzzle('1')
  check(r.ok === false && r.errorCode === 'already-simplest', 'build("1") -> already-simplest', JSON.stringify(r))
}

/* 4d. playable puzzles: the promise is (equiv start, terminal goal, legal path) */
const playable = []

/**
 * Replays the reported derivation by enumerating, at every state, exactly the
 * moves the workspace can offer (getLegalTransitions with the sandbox's
 * allowExpand option) and taking the one whose canon matches the next reported
 * step. This is what "step-locking" relies on.
 */
function replayThroughUiMoves(exprString, solutionPath) {
  let current = parseExpr(exprString)
  for (const step of solutionPath) {
    const before = nodeText(current)
    if (before !== step.from) return { ok: false, reason: `path desync at "${step.from}" (have "${before}")` }
    const transitions = getLegalTransitions(current, SANDBOX_ENGINE)
    const match = transitions.find(t => t.nextCanon === canonText(parseExpr(step.to)))
    if (!match) return { ok: false, reason: `no UI move reproduces "${step.from}" -> "${step.to}"` }
    current = match.nextTree
  }
  return { ok: true, steps: solutionPath.length }
}

function assertPlayable(raw, name) {
  const r = buildSandboxPuzzle(raw)
  if (r.ok !== true) {
    fail(`build(${JSON.stringify(raw)}) -> ok (${name})`, `${r.errorCode}: ${r.error}`)
    return null
  }
  const start = parseExpr(r.puzzle.expr)
  const goal = parseExpr(r.puzzle.goal)

  check(r.exprText === r.puzzle.expr && r.exprText === nodeText(parseExpr(raw)),
    `build(${JSON.stringify(raw)}) exprText === puzzle.expr === nodeText(parseExpr(raw))`, r.exprText)
  check(r.varCount === extractVariables(start).length,
    `build(${JSON.stringify(raw)}) varCount === extractVariables(...)`, String(r.varCount))
  check(r.puzzle.difficulty === 'custom' && Array.isArray(r.puzzle.targetLaws) && Array.isArray(r.puzzle.hints),
    `build(${JSON.stringify(raw)}) carries difficulty/targetLaws/hints`, `${r.puzzle.difficulty} ${JSON.stringify(r.puzzle.targetLaws)} ${JSON.stringify(r.puzzle.hints)}`)
  check(r.puzzle.allowExpand === true,
    `build(${JSON.stringify(raw)}) sets puzzle.allowExpand = true (enables the gated law)`, String(r.puzzle.allowExpand))
  check(r.puzzle.optimalSteps >= 1 && r.puzzle.optimalSteps === r.puzzle.solutionPath.length,
    `build(${JSON.stringify(raw)}) optimalSteps >= 1 and equals solutionPath.length`, String(r.puzzle.optimalSteps))
  check(r.puzzle.optimalHint === `This one can be fully simplified in ${r.puzzle.optimalSteps} step${r.puzzle.optimalSteps === 1 ? '' : 's'}.`,
    `build(${JSON.stringify(raw)}) optimalHint matches the template`, r.puzzle.optimalHint)
  check(getLegalTransitions(goal, SANDBOX_ENGINE).length === 0,
    `build(${JSON.stringify(raw)}) goal "${r.puzzle.goal}" is a fully simplified terminal form`)
  check(isEquivalent(start, goal),
    `build(${JSON.stringify(raw)}) isEquivalent(start, goal)`)
  check(canonText(start) !== canonText(goal),
    `build(${JSON.stringify(raw)}) goal differs from the start`)
  check(getLegalTransitions(start, SANDBOX_ENGINE).length > 0,
    `build(${JSON.stringify(raw)}) start offers at least one legal move`)

  const replay = replayThroughUiMoves(r.puzzle.expr, r.puzzle.solutionPath)
  check(replay.ok, `build(${JSON.stringify(raw)}) derivation replays through the UI move set`,
    replay.ok ? `${replay.steps} step(s)` : replay.reason)
  playable.push({ raw, r })
  return r
}

/* ACCEPTANCE-CRITICAL case from the spec: with the gated expansion law the
   sandbox must reach goal "AB" in exactly 3 steps. */
for (const [label, expected] of [["A(B + A')", { goal: 'AB', steps: 3 }]]) {
  const r = assertPlayable(label, 'required case')
  if (r) {
    check(r.puzzle.goal === expected.goal,
      `build(${JSON.stringify(label)}) goal is exactly "${expected.goal}"`, r.puzzle.goal)
    check(r.puzzle.optimalSteps === expected.steps,
      `build(${JSON.stringify(label)}) optimalSteps is exactly ${expected.steps}`, String(r.puzzle.optimalSteps))
    check(r.puzzle.solutionPath.map(s => s.law).join(' -> ') === 'Distributive (Expand) -> Complement Law (Product) -> Identity Law',
      `build(${JSON.stringify(label)}) derivation is expand -> complement -> identity`,
      r.puzzle.solutionPath.map(s => s.law).join(' -> '))
  }
}

/* Further everyday inputs; each is asserted only through the playable contract. */
for (const raw of ["!(A * B) + C'", 'A(A + B)', 'A + AB', "AB + AA'"]) {
  assertPlayable(raw, 'everyday input')
}

/* Engine-terminal input must be reported as already-simplest, never as a
   playable puzzle with no legal move (that would dead-end the workspace). */
for (const raw of ['AB + A\'C', "AB + A'", 'A', '0']) {
  const r = buildSandboxPuzzle(raw)
  check(r.ok === false && (r.errorCode === 'already-simplest' || r.errorCode === 'not-simplifiable'),
    `build(${JSON.stringify(raw)}) terminal input -> ${r.errorCode}`, JSON.stringify(r))
}

/* No puzzle may ever be returned without a guaranteed forward path. */
{
  const samples = ["A(B + A')", "!(A * B) + C'", "AB + A'", 'A(A + B)', 'A + AB', "AB + AA'"]
  let violations = 0
  for (const raw of samples) {
    const r = buildSandboxPuzzle(raw)
    if (!r.ok) continue
    const pathOk = r.puzzle.solutionPath.length === r.puzzle.optimalSteps && r.puzzle.optimalSteps >= 1
    const moves = getLegalTransitions(parseExpr(r.puzzle.expr), SANDBOX_ENGINE).length > 0
    if (!pathOk || !moves) violations++
  }
  check(violations === 0, 'every ok result ships a >=1-step solutionPath and a start with legal moves', `violations=${violations}`)
}

/* 4e. performance budget for everyday inputs (<=4 variables) */
{
  const budgetCases = ['A(B + A\')', '!(A * B) + C\'', '(A+B)(C+D)', "AB'C + A'BC' + ABC", '(A+B)(A\'+C) + BD']
  let worst = 0
  let worstExpr = ''
  for (const raw of budgetCases) {
    const t0 = Date.now()
    const r = buildSandboxPuzzle(raw)
    const ms = Date.now() - t0
    if (ms > worst) { worst = ms; worstExpr = raw }
    check(ms < 3000, `build(${JSON.stringify(raw)}) under the 3s budget`, `${ms}ms (${r.ok ? 'ok' : r.errorCode})`)
  }
  console.log(`  slowest everyday input: "${worstExpr}" ${worst}ms`)
}

/* ── 5. normalizeSandboxExpr + tokenizer notation ─────────────────────────── */
section('5. normalizeSandboxExpr + tokenizer notation')
{
  const cases = [
    ['A.B', 'AB'],
    ['A·B', 'AB'],
    ['A&B', 'AB'],
    ['A|B', 'A + B'],
    ['A∨B', 'A + B'],
    ['¬A', "A'"],
    ['!A', "A'"],
    ["A'", "A'"],
    ['A(B+C)', 'A(B + C)'],
    ['  a  +  B  ', 'a + B'],
    ['0', '0'],
  ]
  for (const [raw, expected] of cases) {
    const got = normalizeSandboxExpr(raw)
    check(got === expected, `normalizeSandboxExpr(${JSON.stringify(raw)}) === ${JSON.stringify(expected)}`, JSON.stringify(got))
  }
  check(normalizeSandboxExpr('') === '', 'normalizeSandboxExpr("") === ""')
  check(normalizeSandboxExpr(null) === '', 'normalizeSandboxExpr(null) === ""')
  check(normalizeSandboxExpr(undefined) === '' , 'normalizeSandboxExpr(undefined) === ""')
}

{
  /* The additive tokenizer mappings must round-trip through the engine. */
  const pairs = [
    ['.', 'A.B', 'A*B'],
    ['∨', 'A∨B', 'A|B'],
    ['¬', '¬A', '!A'],
  ]
  for (const [sym, input, reference] of pairs) {
    check(canonText(parseExpr(input)) === canonText(parseExpr(reference)),
      `tokenizer maps ${JSON.stringify(sym)} to the same operator as ${JSON.stringify(reference)}`,
      `"${input}" canon=${canonText(parseExpr(input))} vs "${reference}" canon=${canonText(parseExpr(reference))}`)
  }
  /* Existing mappings must be untouched. */
  const legacy = [['A*B', 'AB'], ['A·B', 'AB'], ['A&B', 'AB'], ['A+B', 'A + B'], ['A|B', 'A + B'], ["A'", "A'"], ['!A', "A'"], ['~A', "A'"], ['(A+B)(A+C)', '(A + B)(A + C)']]
  for (const [input, expected] of legacy) {
    check(nodeText(parseExpr(input)) === expected, `legacy notation ${JSON.stringify(input)} still renders ${JSON.stringify(expected)}`, nodeText(parseExpr(input)))
  }
  /* Unknown characters stay silently skipped by the engine tokenizer. */
  check(nodeText(parseExpr('A@B')) === 'AB', 'engine tokenizer still silently skips unknown characters')
}

/* ── 6. Gating: the expand law exists only when allowExpand is requested ──── */
section('6. Distributive-Expand gating (graded levels must be untouched)')
{
  const expr = "A(B + A')"
  const tree = parseExpr(expr)

  const gradedTransitions = getLegalTransitions(tree, GRADED_ENGINE)
  const sandboxTransitions = getLegalTransitions(tree, SANDBOX_ENGINE)
  check(gradedTransitions.length === 0,
    `default engine still offers no move from ${JSON.stringify(expr)}`, `${gradedTransitions.length} transition(s)`)
  check(sandboxTransitions.length === 1 && sandboxTransitions[0].lawId === 'distributive-expand',
    `allowExpand offers exactly the expand law for ${JSON.stringify(expr)}`,
    sandboxTransitions.map(t => `${t.lawId}: ${t.from} => ${t.to}`).join(' | ') || 'none')
  check(sandboxTransitions[0]?.law === 'Distributive (Expand)' && sandboxTransitions[0]?.to === "AB + AA'",
    'the expand transition is A(B + A\') => AB + AA\'', JSON.stringify(sandboxTransitions[0]?.to))

  /* pure apply(): the law must not mutate the tree it was derived from */
  const law = analyzeSelection(tree, [
    { path: 'R.0', isTermSel: true },
    { path: 'R.1', isTermSel: true },
  ], SANDBOX_ENGINE).find(l => l.id === 'distributive-expand')
  check(Boolean(law), 'analyzeSelection(..., { allowExpand: true }) returns the law for a term-level selection')
  check(analyzeSelection(tree, [
    { path: 'R.0', isTermSel: true },
    { path: 'R.1', isTermSel: true },
  ], GRADED_ENGINE).length === 0, 'the same selection offers nothing on the default engine')
  if (law) {
    const before = canonText(tree)
    const out1 = law.apply()
    const out2 = law.apply()
    check(canonText(tree) === before, 'law.apply() does not mutate the source tree')
    check(canonText(out1) === canonText(out2) && nodeText(out1) === "AB + AA'",
      'law.apply() is repeatable and yields AB + AA\'', nodeText(out1))
    check(law.animPaths.length === 0 && law.measurePaths === undefined && law.factoredVar === undefined,
      'the law carries empty animPaths and no factoring-only fields',
      `animPaths=${JSON.stringify(law.animPaths)} measurePaths=${law.measurePaths} factoredVar=${law.factoredVar}`)
  }

  /* hints: Hint/Guide must be able to see it, and only in sandbox mode */
  check(scanHints(tree, 'R', GRADED_ENGINE).length === 0, 'default scanHints reports no hint for A(B + A\')')
  const sandboxHints = scanHints(tree, 'R', SANDBOX_ENGINE)
  check(sandboxHints.length === 1 && sandboxHints[0].law === 'distributive-expand'
    && sandboxHints[0].paths.join(',') === 'R.0,R.1',
    'allowExpand scanHints reports distributive-expand with the literal + clause paths',
    JSON.stringify(sandboxHints))

  /* the goal search itself is gated */
  const gradedSimplest = findSimplestForm(tree, { maxDepth: 14, maxStates: 20000, ...GRADED_ENGINE })
  const sandboxSimplest = findSimplestForm(tree, { maxDepth: 14, maxStates: 20000, ...SANDBOX_ENGINE })
  check(gradedSimplest.found && gradedSimplest.optimalSteps === 0 && gradedSimplest.text === expr,
    'default findSimplestForm still reports A(B + A\') as already terminal',
    `found=${gradedSimplest.found} steps=${gradedSimplest.optimalSteps} text="${gradedSimplest.text}"`)
  check(sandboxSimplest.found && sandboxSimplest.optimalSteps === 3 && sandboxSimplest.text === 'AB',
    'allowExpand findSimplestForm reaches AB in 3 steps',
    `found=${sandboxSimplest.found} steps=${sandboxSimplest.optimalSteps} text="${sandboxSimplest.text}"`)

  /* complement-guarded: no complement pair -> still no expand law anywhere */
  for (const raw of ['A(B + C)', 'A(B + C + D)', "A(B' + C)"]) {
    const t = parseExpr(raw)
    const laws = getLegalTransitions(t, SANDBOX_ENGINE).filter(l => l.lawId === 'distributive-expand')
    check(laws.length === 0, `allowExpand still refuses ${JSON.stringify(raw)} (no complement pair)`)
    const r = buildSandboxPuzzle(raw)
    check(r.ok === false && r.errorCode === 'already-simplest',
      `build(${JSON.stringify(raw)}) stays already-simplest`, r.ok ? 'ok' : r.errorCode)
  }

  /* the graded puzzle shape x(x' + y)(x + y) keeps its default behaviour */
  const graded = parseExpr("x(x' + y)(x + y)")
  const gradedIds = getLegalTransitions(graded, GRADED_ENGINE).map(t => t.lawId)
  check(!gradedIds.includes('distributive-expand'), "graded level expression x(x' + y)(x + y) has no expand law by default",
    gradedIds.join(',') || 'none')
  const expandIds = getLegalTransitions(graded, SANDBOX_ENGINE).map(t => t.lawId)
  check(expandIds.includes('distributive-expand'), "the same expression does get it with allowExpand (sandbox opt-in)",
    expandIds.join(','))
}

/* ── Summary ──────────────────────────────────────────────────────────────── */
console.log('\n=== SUMMARY ===')
console.log(`checks passed: ${passed}`)
console.log(`checks failed: ${failed}`)
if (failed > 0) {
  console.log('\nNOTE: buildSandboxPuzzle searches with { allowExpand: true }; the gated')
  console.log('Distributive-Expand law must exist in laws.js/solver.js for A(B + A\') to be playable.')
  console.log('Run `node .e2e/lead-engine-fingerprint.mjs` to prove the default engine is unchanged.')
}
process.exit(failed > 0 ? 1 : 0)
