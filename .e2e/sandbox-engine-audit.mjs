/**
 * SANDBOX ENGINE AUDIT — input strictness + recommended-input playability.
 *
 * Two confirmed defects this file proves fixed:
 *   1. Every example chip on /sandbox must reach /sandbox/play. Two of the old
 *      four ("AB + A'C", "(x+y)(x'+z)") validated but were engine-terminal, so
 *      a learner tapping them was bounced with "already in its simplest form".
 *   2. The validator accepted digits 2-9 even though the declared alphabet only
 *      allows the constants 0 and 1; the engine's tokenizer silently DROPPED
 *      them ("2" parsed as constant 0). One misclassification in a 52-string
 *      corpus — this file pins the whole corpus plus a 200+ generated sample.
 *
 * Coverage:
 *   A. >= 40 must-accept and >= 25 must-reject strings, with the exact
 *      errorCode AND the exact byte-identical message. Includes "2", "2+2",
 *      "A1", "12", "A−B" (U+2212), "A++B", "(A+B", "A !", "ABCDEFG".
 *   B. Accepted-input property: nothing is silently dropped (independent
 *      tokenizer + canonical round-trip) and buildSandboxPuzzle always returns
 *      either a fully playable puzzle or an explicit already-simplest /
 *      not-simplifiable verdict — never a silent or syntax verdict.
 *   C. Every chip rendered by SandboxPage.jsx is playable end-to-end: read from
 *      the JSX source, validate -> build -> goal equivalent to the start ->
 *      optimalSteps >= 1 -> derivation replays through the real move set.
 *   D. >= 200 grammar-generated valid expressions with zero wrong verdicts.
 *
 * Run:
 *   node .e2e/sandbox-engine-audit.mjs              # pure engine audit
 *   node .e2e/sandbox-engine-audit.mjs --browser    # + real browser chip check
 *   node .e2e/sandbox-engine-audit.mjs --generated=400 --seed=7
 *
 * Exit code is non-zero when any check fails. No file outside .e2e/ is written.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  MAX_SANDBOX_VARS, validateSandboxInput, buildSandboxPuzzle, normalizeSandboxExpr,
} from '../frontend/src/engine/index.js'
import {
  parseExpr, nodeText, canonText, isEquivalent, extractVariables,
} from '../frontend/src/engine/index.js'
import { getLegalTransitions } from '../frontend/src/engine/index.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..')
const SANDBOX_PAGE = resolve(REPO, 'frontend/src/pages/SandboxPage.jsx')

/** Option set the sandbox builder uses; the default (no options) is graded. */
const SANDBOX_ENGINE = { allowExpand: true }

/* ── Harness ──────────────────────────────────────────────────────────────── */
let passed = 0
let failed = 0
const pass = (name, detail = '') => { passed++; console.log(`PASS | ${name}${detail ? ' | ' + detail : ''}`) }
const fail = (name, detail = '') => { failed++; console.log(`FAIL | ${name}${detail ? ' | ' + detail : ''}`) }
const check = (ok, name, detail = '') => { ok ? pass(name, detail) : fail(name, detail) }
const section = (title) => console.log(`\n──── ${title} ────`)

/* The spec messages, transcribed here independently of the implementation. */
const M = {
  empty: 'Please enter a Boolean expression.',
  invalidChars: (chars) => `Invalid character(s) found: ${chars}. Only letters, +, ·, *, ., &, |, ', !, ¬, (), 0, 1 are allowed.`,
  unbalanced: 'Unbalanced parentheses. Check your opening and closing brackets.',
  doubleOperator: (n) => `Two operators in a row. Check around position ${n}.`,
  missingOperand: 'Missing a variable or term.',
  strayNot: 'A NOT symbol must attach to a variable, constant, or parenthesized group.',
  tooManyVars: (n) => `Sandbox supports up to ${MAX_SANDBOX_VARS} variables. Your expression uses ${n}.`,
  alreadySimplest: 'This expression is already in its simplest form. Try a more complex one!',
  notSimplifiable: 'This expression is too complex for the sandbox engine. Try a simpler one.',
}

const SYNTAX_CODES = new Set([
  'empty', 'invalid-chars', 'unbalanced', 'too-many-vars',
  'double-operator', 'missing-operand', 'stray-not',
])
const EXPLICIT_VERDICTS = new Set(['already-simplest', 'not-simplifiable'])

/* ── Independent notation reader (deliberately NOT the module's scanner) ──── */

/**
 * Reads `raw` with the DECLARED alphabet only — letters, the constants 0/1,
 * + * · . & | ∨ ' ! ¬ ( ) and whitespace. Every non-whitespace character must
 * produce exactly one canonical character group, so a character can never be
 * lost silently. `canonical === null` means the character is outside the
 * declared alphabet.
 */
function readNotation(raw) {
  const tokens = []
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]
    if (/\s/.test(ch)) continue
    let canonical = null
    if (/[A-Za-z]/.test(ch)) canonical = ch
    else if (ch === '0' || ch === '1') canonical = ch
    else if (ch === '+' || ch === '|' || ch === '∨') canonical = '+'
    else if (ch === '*' || ch === '·' || ch === '.' || ch === '&') canonical = '*'
    else if (ch === "'") canonical = "'"
    else if (ch === '!' || ch === '¬') canonical = '!'
    else if (ch === '(' || ch === ')') canonical = ch
    tokens.push({ char: ch, canonical, index: i })
  }
  return tokens
}

/**
 * The no-silent-drop property. Returns a list of problems (empty = clean):
 *   - a non-whitespace character outside the declared alphabet,
 *   - a character count that the canonical re-serialisation does not account
 *     for one-to-one,
 *   - an engine parse of the raw text that differs from the engine parse of the
 *     independent canonical re-serialisation (i.e. the engine read something
 *     else than what the learner typed).
 */
function silentDropProblems(raw) {
  const problems = []
  const tokens = readNotation(raw)
  const nonSpace = raw.replace(/\s+/g, '')
  const outside = tokens.filter(t => t.canonical === null).map(t => t.char)
  if (outside.length > 0) problems.push(`characters outside the declared alphabet: ${JSON.stringify(outside.join(''))}`)
  if (tokens.length !== nonSpace.length) {
    problems.push(`reader kept ${tokens.length} of ${nonSpace.length} non-whitespace characters`)
  }
  if (outside.length === 0) {
    const canonical = tokens.map(t => t.canonical).join('')
    if (canonical.length !== nonSpace.length) {
      problems.push(`canonical re-serialisation lost characters (${canonical.length} vs ${nonSpace.length})`)
    }
    const rawCanon = canonText(parseExpr(raw))
    const tokenCanon = canonText(parseExpr(canonical))
    if (rawCanon !== tokenCanon) {
      problems.push(`engine read "${rawCanon}" but the typed characters canonicalise to "${tokenCanon}"`)
    }
  }
  return problems
}

/* ── Playability contract ─────────────────────────────────────────────────── */

/** Replays the reported derivation through the SAME moves the workspace offers. */
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
  return { ok: true }
}

/** Returns every violation of the playable-puzzle contract (empty = playable). */
function playableProblems(raw, r) {
  const problems = []
  const start = parseExpr(r.puzzle.expr)
  const goal = parseExpr(r.puzzle.goal)
  if (!(r.exprText === r.puzzle.expr && r.exprText === nodeText(parseExpr(raw)))) {
    problems.push(`exprText "${r.exprText}" !== puzzle.expr "${r.puzzle.expr}"`)
  }
  if (r.varCount !== extractVariables(start).length) problems.push(`varCount ${r.varCount} mismatch`)
  if (r.puzzle.difficulty !== 'custom' || !Array.isArray(r.puzzle.targetLaws) || !Array.isArray(r.puzzle.hints)) {
    problems.push('puzzle shape (difficulty/targetLaws/hints) broken')
  }
  if (r.puzzle.allowExpand !== true) problems.push('allowExpand is not true')
  if (!(r.puzzle.optimalSteps >= 1 && r.puzzle.optimalSteps === r.puzzle.solutionPath.length)) {
    problems.push(`optimalSteps ${r.puzzle.optimalSteps} vs path ${r.puzzle.solutionPath.length}`)
  }
  if (getLegalTransitions(goal, SANDBOX_ENGINE).length !== 0) problems.push(`goal "${r.puzzle.goal}" is not terminal`)
  if (!isEquivalent(start, goal)) problems.push('goal is not equivalent to the start')
  if (canonText(start) === canonText(goal)) problems.push('goal equals the start')
  if (getLegalTransitions(start, SANDBOX_ENGINE).length === 0) problems.push('start offers no legal move')
  const replay = replayThroughUiMoves(r.puzzle.expr, r.puzzle.solutionPath)
  if (!replay.ok) problems.push(`derivation does not replay: ${replay.reason}`)
  return problems
}

/**
 * Property (B) for one accepted sample: nothing dropped, and the builder either
 * hands back a playable puzzle or an explicit terminal verdict.
 * Returns a short human-readable verdict for the log.
 */
function auditAccepted(raw, tag) {
  const drops = silentDropProblems(raw)
  check(drops.length === 0, `${tag} accepted without dropping characters`, drops.join('; ') || `"${raw}"`)

  const built = buildSandboxPuzzle(raw)
  if (!built.ok) {
    const explicit = EXPLICIT_VERDICTS.has(built.errorCode) && !SYNTAX_CODES.has(built.errorCode)
    const message = built.errorCode === 'already-simplest' ? M.alreadySimplest : M.notSimplifiable
    const ok = explicit && built.error === message
    check(ok, `${tag} rejected only with an explicit verdict`, `${built.errorCode}: ${JSON.stringify(built.error)}`)
    return built.errorCode
  }
  const problems = playableProblems(raw, built)
  check(problems.length === 0, `${tag} playable end-to-end`, problems.join('; ') || `goal=${built.puzzle.goal} steps=${built.puzzle.optimalSteps}`)
  return 'playable'
}

/* ── A1. Must-ACCEPT corpus (>= 40) ───────────────────────────────────────── */

section('A1. Strictness — inputs that MUST validate')
const VALID = [
  /* the four sandbox chips (A(B + A') is the acceptance expression) */
  "A(B + A')", 'A + AB', "!(A * B) + C'", "(A + B)(A + B')",
  /* verified-playable everyday inputs */
  "AB + AB'", 'A(A + B)', 'AB + AC', "A + A'", 'A + 0', "(AB)'", "(A + B)'", '(A + B)(C + D)',
  /* every accepted operator spelling */
  'AB', 'A.B', 'A·B', 'A&B', 'A|B', 'A∨B', '¬A', '!A', "A'", '0', '1', 'A(B+C)',
  'A.B&C|D', 'A * 1', 'A + 1', '0 + A', 'A + B + CD', 'A·B + C·D', 'A | B & C',
  /* constants are legal operands — "A1" is A·1 */
  'A1', '1A', 'A1B',
  /* structure / whitespace / case sensitivity */
  '(A+B)', '((A))', 'A B', '!!!!A', "A''", '1 + A', '  A  +  B  ', 'a + A',
  "AB'C + A'BC'", "x'y + xy'", "A'(B + C)", 'A(B(C))', '!(A + B)C', '¬(A + B)', "((A + B)' + C)",
  'A + B + C + D',
]
check(VALID.length >= 40, `the must-accept corpus has >= 40 strings`, `${VALID.length}`)
check(new Set(VALID).size === VALID.length, 'the must-accept corpus has no duplicates')

const validVerdicts = []
for (const raw of VALID) {
  const v = validateSandboxInput(raw)
  check(v.valid === true && v.error === null && v.errorCode === null,
    `validate(${JSON.stringify(raw)}) -> valid`, v.valid ? '' : `${v.errorCode}: ${v.error}`)
  if (v.valid) validVerdicts.push({ raw, verdict: auditAccepted(raw, `build(${JSON.stringify(raw)})`) })
}

/* "A1" means A·1: the engine must read it as the same formula as "A*1". */
{
  const a1 = parseExpr('A1')
  check(canonText(a1) === canonText(parseExpr('A * 1')) && canonText(a1) === canonText(parseExpr('1A')),
    'A1 is read as A·1 (same canonical form as A*1)', `canon(A1)=${canonText(a1)}`)
  const b = buildSandboxPuzzle('A1')
  check(b.ok === true && isEquivalent(parseExpr(b.puzzle.expr), a1),
    'A1 builds a puzzle whose start is A·1', b.ok ? `goal=${b.puzzle.goal}` : b.errorCode)
}

/* ── A2. Must-REJECT corpus (>= 25) with exact code + message ─────────────── */

section('A2. Strictness — inputs that MUST be rejected (exact code + message)')
const INVALID = [
  /* digits 2-9 are outside the declared alphabet (the reported hole) */
  ['2', 'invalid-chars', M.invalidChars('2')],
  ['2+2', 'invalid-chars', M.invalidChars('2')],
  ['12', 'invalid-chars', M.invalidChars('2')],
  ['A2B', 'invalid-chars', M.invalidChars('2')],
  ['A9', 'invalid-chars', M.invalidChars('9')],
  ['9', 'invalid-chars', M.invalidChars('9')],
  ['A2 + 3', 'invalid-chars', M.invalidChars('2, 3')],
  ['A0B2', 'invalid-chars', M.invalidChars('2')],
  /* unicode lookalikes and other symbols */
  ['A−B', 'invalid-chars', M.invalidChars('−')],   // U+2212 minus
  ['A×B', 'invalid-chars', M.invalidChars('×')],   // U+00D7 multiplication
  ['A∗B', 'invalid-chars', M.invalidChars('∗')],   // U+2217 asterisk operator
  ["A′B", 'invalid-chars', M.invalidChars('′')],   // U+2032 prime
  ['A—B', 'invalid-chars', M.invalidChars('—')],   // U+2014 em dash
  ['A~B', 'invalid-chars', M.invalidChars('~')],   // deliberately refused
  ['A@B', 'invalid-chars', M.invalidChars('@')],
  ['A?B', 'invalid-chars', M.invalidChars('?')],
  ['A # B $', 'invalid-chars', M.invalidChars('#, $')],
  ['A[…B', 'invalid-chars', M.invalidChars('[, …')],
  ['x@y@z', 'invalid-chars', M.invalidChars('@')],
  /* empty */
  ['', 'empty', M.empty],
  ['   ', 'empty', M.empty],
  ['\t\n', 'empty', M.empty],
  /* unbalanced */
  ['(A+B', 'unbalanced', M.unbalanced],
  ['A+B)', 'unbalanced', M.unbalanced],
  ['(A+B))', 'unbalanced', M.unbalanced],
  ['((A+B)', 'unbalanced', M.unbalanced],
  ['(ABCDEFG', 'unbalanced', M.unbalanced],
  ['A++B)', 'unbalanced', M.unbalanced],
  /* double operator — position is 1-based against the raw input */
  ['A++B', 'double-operator', M.doubleOperator(3)],
  ['A+·B', 'double-operator', M.doubleOperator(3)],
  ['A + · B', 'double-operator', M.doubleOperator(5)],
  [' A ++ C', 'double-operator', M.doubleOperator(5)],
  ['A&|B', 'double-operator', M.doubleOperator(3)],
  ['A.|B', 'double-operator', M.doubleOperator(3)],
  /* missing operand */
  ['(+A)', 'missing-operand', M.missingOperand],
  ['A+', 'missing-operand', M.missingOperand],
  ['()', 'missing-operand', M.missingOperand],
  ['(  )', 'missing-operand', M.missingOperand],
  ['+A', 'missing-operand', M.missingOperand],
  ['*A', 'missing-operand', M.missingOperand],
  ['(A+)', 'missing-operand', M.missingOperand],
  ['A()', 'missing-operand', M.missingOperand],
  ['!()', 'missing-operand', M.missingOperand],
  /* stray NOT */
  ['A !', 'stray-not', M.strayNot],
  ["!'", 'stray-not', M.strayNot],
  ['!', 'stray-not', M.strayNot],
  ["'", 'stray-not', M.strayNot],
  ['¬', 'stray-not', M.strayNot],
  ['A + !', 'stray-not', M.strayNot],
  /* variable budget */
  ['ABCDEFG', 'too-many-vars', M.tooManyVars(7)],
  ['abcdefg', 'too-many-vars', M.tooManyVars(7)],
  ['AaBbCcD', 'too-many-vars', M.tooManyVars(7)],
  ['ABCDEFG++', 'too-many-vars', M.tooManyVars(7)],
  /* order: first failure wins */
  ['A@B++C', 'invalid-chars', M.invalidChars('@')],
  ['A@)', 'invalid-chars', M.invalidChars('@')],
]
check(INVALID.length >= 25, `the must-reject corpus has >= 25 strings`, `${INVALID.length}`)

for (const [raw, code, message] of INVALID) {
  const v = validateSandboxInput(raw)
  const ok = v.valid === false && v.errorCode === code && v.error === message
  check(ok, `validate(${JSON.stringify(raw)}) -> ${code} with the exact message`,
    ok ? '' : `got ${v.valid ? 'VALID' : v.errorCode} ${JSON.stringify(v.error)}`)
  if (code === 'invalid-chars') {
    const named = [...new Set(raw.split('').filter(c => !/[\sA-Za-z01+*·.&|∨'!¬()]/.test(c)))]
    check(named.length > 0 && named.every(c => v.error.includes(c)),
      `invalid-chars for ${JSON.stringify(raw)} NAMES every offender`,
      named.length ? `named=${JSON.stringify(named.join(''))}` : 'no offender in this sample')
  }
  const built = buildSandboxPuzzle(raw)
  check(built.ok === false && built.errorCode === code && built.error === message,
    `build(${JSON.stringify(raw)}) -> ${code === 'empty' ? 'empty (validation passthrough)' : code}`,
    built.ok ? 'unexpected ok' : `${built.errorCode}`)
}

/* ── B. Accepted-input property: nothing dropped, never a silent verdict ──── */

section('B. Accepted input never loses a character and never gets a silent verdict')
{
  /* Control: the hazard is real at engine level — the engine's tokenizer drops
     "2" entirely (parse("2") === parse("")), which is why the validator must
     refuse it and the builder must never see it as an accepted input. */
  const engineDropsDigit = canonText(parseExpr('2')) === canonText(parseExpr(''))
  check(engineDropsDigit, 'control: the raw engine tokenizer DOES drop "2" (parse("2") === parse(""))',
    `canon("2")=${canonText(parseExpr('2'))}`)
  const v2 = validateSandboxInput('2')
  const b2 = buildSandboxPuzzle('2')
  check(v2.valid === false && v2.errorCode === 'invalid-chars' && v2.error.includes('2'),
    'control: validate("2") refuses it by name', `${v2.errorCode}: ${v2.error}`)
  check(b2.ok === false && b2.errorCode === 'invalid-chars' && b2.error.includes('2'),
    'control: build("2") refuses it by name', `${b2.errorCode}: ${b2.error}`)

  /* Injected-character property: appending/prepending an out-of-alphabet digit
     to an otherwise accepted expression must always be refused, at every
     position — so a dropped character can never reach an accepted puzzle. */
  const hosts = ["A(B + A')", 'A + AB', "!(A * B) + C'", "(A + B)(A + B')", 'A + B', "AB' + C"]
  const injected = []
  for (const host of hosts) {
    for (let i = 0; i <= host.length; i++) {
      const mutated = host.slice(0, i) + '2' + host.slice(i)
      const v = validateSandboxInput(mutated)
      const b = buildSandboxPuzzle(mutated)
      if (v.valid === false && v.errorCode === 'invalid-chars' && v.error.includes('2')
        && b.ok === false && b.errorCode === 'invalid-chars') {
        injected.push(mutated)
      } else {
        fail(`injected "2" into ${JSON.stringify(host)} at ${i} is refused by name`,
          `validate=${v.valid ? 'VALID' : v.errorCode} build=${b.ok ? 'ok' : b.errorCode}`)
      }
    }
  }
  check(injected.length === hosts.reduce((n, h) => n + h.length + 1, 0),
    `every one of ${injected.length} digit-injected mutations is refused by name`)

  /* Every accepted sample from the corpus, re-checked as one aggregate. */
  const dropped = VALID.filter(raw => validateSandboxInput(raw).valid && silentDropProblems(raw).length > 0)
  check(dropped.length === 0, `no accepted sample in the ${VALID.length}-string corpus drops a character`,
    dropped.join(' | '))
  const silent = validVerdicts.filter(v => !(v.verdict === 'playable' || EXPLICIT_VERDICTS.has(v.verdict)))
  check(silent.length === 0, 'every accepted sample is playable or carries an explicit terminal verdict',
    silent.map(v => `${v.raw}:${v.verdict}`).join(' | '))
  const playable = validVerdicts.filter(v => v.verdict === 'playable').length
  const terminal = validVerdicts.length - playable
  console.log(`     corpus verdicts: playable=${playable} explicit-terminal=${terminal}`)

  /* normalizeSandboxExpr still renders the accepted notation (display helper). */
  const displays = [['A.B', 'AB'], ['A·B', 'AB'], ['A&B', 'AB'], ['A|B', 'A + B'], ['A∨B', 'A + B'],
    ['¬A', "A'"], ['!A', "A'"], ["A'", "A'"], ['A(B+C)', 'A(B + C)'], ['  a  +  B  ', 'a + B'], ['0', '0']]
  for (const [raw, expected] of displays) {
    check(normalizeSandboxExpr(raw) === expected, `normalizeSandboxExpr(${JSON.stringify(raw)}) === ${JSON.stringify(expected)}`,
      JSON.stringify(normalizeSandboxExpr(raw)))
  }
  check(normalizeSandboxExpr('') === '' && normalizeSandboxExpr(null) === '' && normalizeSandboxExpr(undefined) === '',
    'normalizeSandboxExpr stays best-effort on empty / non-string input')
}

/* ── C. Every chip rendered by SandboxPage.jsx is playable ────────────────── */

section('C. Every example chip in SandboxPage.jsx is playable end-to-end')
let chipList = []
{
  const source = readFileSync(SANDBOX_PAGE, 'utf8')
  const block = /const EXAMPLES\s*=\s*\[([\s\S]*?)\]/.exec(source)
  check(Boolean(block), 'SandboxPage.jsx exposes a chip list (const EXAMPLES = [...])')
  if (block) {
    chipList = [...block[1].matchAll(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g)]
      .map(m => m[0].slice(1, -1))
  }
  check(chipList.length === 4, 'the sandbox input screen offers four example chips', JSON.stringify(chipList))
  check(chipList.includes("A(B + A')"), 'the acceptance expression "A(B + A\')" is still advertised')
  for (const deadEnd of ["AB + A'C", "(x+y)(x'+z)"]) {
    check(!chipList.includes(deadEnd), `the engine-terminal expression ${JSON.stringify(deadEnd)} is no longer advertised as a chip`)
  }

  for (const chip of chipList) {
    const v = validateSandboxInput(chip)
    check(v.valid === true, `chip ${JSON.stringify(chip)} validates`, v.valid ? '' : `${v.errorCode}: ${v.error}`)
    const built = buildSandboxPuzzle(chip)
    if (!built.ok) {
      fail(`chip ${JSON.stringify(chip)} resolves to a playable puzzle`, `${built.errorCode}: ${built.error}`)
      continue
    }
    const problems = playableProblems(chip, built)
    check(problems.length === 0, `chip ${JSON.stringify(chip)} is playable end-to-end`,
      problems.join('; ') || `goal=${built.puzzle.goal} steps=${built.puzzle.optimalSteps} laws=${built.puzzle.solutionPath.map(s => s.law).join(' -> ')}`)
    const drops = silentDropProblems(chip)
    check(drops.length === 0, `chip ${JSON.stringify(chip)} loses no character`, drops.join('; '))
  }

  /* Pedagogical variety, asserted structurally rather than by exact string. */
  const chipLaws = chipList.flatMap(c => {
    const b = buildSandboxPuzzle(c)
    return b.ok ? b.puzzle.solutionPath.map(s => s.law) : []
  })
  const chipRoots = chipList.map(c => parseExpr(c))
  check(new Set(chipLaws).size >= 3, 'the chips exercise at least three distinct laws', JSON.stringify([...new Set(chipLaws)]))
  check(chipLaws.some(l => /De Morgan/.test(l)), 'one chip demonstrates De Morgan', chipLaws.join(' | '))
  check(chipLaws.some(l => /Absorption|Distributive/.test(l)), 'one chip demonstrates absorption / factoring',
    chipLaws.join(' | '))
  check(chipRoots.some(t => t.type === 'sum'), 'one chip is a sum-of-products style expression (SOP)')
  check(chipRoots.some(t => t.type === 'prod' && t.factors.some(f => f.type === 'sum')),
    'one chip is a product-of-sums style expression (POS-dual)')

  /* C2. Legitimate terminal input keeps its "already in its simplest form"
     verdict: syntax-valid, explicitly refused by the builder, and simply not
     advertised as a recommended chip. */
  for (const raw of ["AB + A'C", "(x+y)(x'+z)", 'A(B + C)', 'A', 'AB', '0']) {
    const v = validateSandboxInput(raw)
    const b = buildSandboxPuzzle(raw)
    const ok = v.valid === true && b.ok === false && b.errorCode === 'already-simplest' && b.error === M.alreadySimplest
    check(ok, `terminal input ${JSON.stringify(raw)} validates then reports "already in its simplest form"`,
      ok ? '' : `valid=${v.valid} build=${b.ok ? 'ok' : b.errorCode} ${JSON.stringify(b.error)}`)
  }
}

/* ── D. Generated valid expressions: zero wrong verdicts ──────────────────── */

section('D. Grammar-generated valid expressions — zero wrong verdicts')

function mulberry32(seed) {
  let a = seed >>> 0
  return function next() {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const argvInt = (flag, fallback) => {
  const hit = process.argv.find(a => a.startsWith(`--${flag}=`))
  const n = hit ? Number(hit.split('=')[1]) : NaN
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback
}
const GENERATED_TARGET = argvInt('generated', 200)
const SEED = argvInt('seed', 20240517)

/**
 * Well-formed generator: only declared-alphabet characters, always balanced,
 * never two binary operators in a row, never a dangling NOT. Composition is
 * the grammar `sum -> term ('+' term)*`, `term -> factor factor*`,
 * `factor -> [!¬] atom ['']*`, `atom -> var | 0 | 1 | '(' sum ')'`.
 */
function makeGenerator(rng) {
  const pick = (arr) => arr[Math.floor(rng() * arr.length)]
  const vars = rng() < 0.25 ? ['x', 'y'] : ['A', 'B', 'C']
  const atom = (depth) => {
    const r = rng()
    if (r < 0.16) return pick(['0', '1'])
    if (r < 0.28 && depth > 0) return '(' + expr(depth - 1) + ')'
    return pick(vars)
  }
  const factor = (depth) => {
    let base = atom(depth)
    if (rng() < 0.22) base += "'".repeat(1 + Math.floor(rng() * 2))
    if (rng() < 0.15) base = pick(['!', '¬']) + base
    return base
  }
  const term = (depth) => {
    const n = 2 + Math.floor(rng() * 2)
    const parts = []
    for (let i = 0; i < n; i++) parts.push(factor(depth))
    return parts.join(pick(['', '', '*', '·', '.', '&']))
  }
  var expr = (depth) => {
    if (depth <= 0) return term(0)
    if (rng() < 0.45) {
      const n = 2 + Math.floor(rng() * 2)
      const terms = []
      for (let i = 0; i < n; i++) terms.push(term(depth - 1))
      return terms.join(pick([' + ', '+', ' | ', '∨']))
    }
    return term(depth - 1)
  }
  return () => expr(2 + Math.floor(rng() * 2))
}

{
  const rng = mulberry32(SEED)
  const generate = makeGenerator(rng)
  const samples = new Set()
  for (let guard = 0; samples.size < GENERATED_TARGET && guard < GENERATED_TARGET * 40; guard++) {
    samples.add(generate())
  }
  const list = [...samples]
  check(list.length >= 200, `generated >= 200 distinct valid expressions`, `${list.length} (seed=${SEED})`)

  let generatedPassed = 0
  let generatedPlayable = 0
  let generatedTerminal = 0
  const exampleLines = []
  for (const raw of list) {
    const problems = []
    const v = validateSandboxInput(raw)
    if (v.valid !== true) problems.push(`validate -> ${v.errorCode}: ${v.error}`)
    const drops = silentDropProblems(raw)
    if (drops.length > 0) problems.push(`dropped: ${drops.join('; ')}`)
    const built = buildSandboxPuzzle(raw)
    if (built.ok) {
      const play = playableProblems(raw, built)
      if (play.length > 0) problems.push(`contract: ${play.join('; ')}`)
      else generatedPlayable++
    } else if (EXPLICIT_VERDICTS.has(built.errorCode)) {
      generatedTerminal++
    } else {
      problems.push(`build -> ${built.errorCode}: ${built.error}`)
    }
    if (problems.length === 0) {
      generatedPassed++
      if (exampleLines.length < 3) exampleLines.push(`${raw} -> ${built.ok ? `playable(${built.puzzle.optimalSteps})` : built.errorCode}`)
    } else {
      fail(`generated expression ${JSON.stringify(raw)} has exactly one correct verdict`, problems.join('; '))
    }
  }
  check(generatedPassed === list.length, `all ${list.length} generated expressions get a correct verdict (no crash, no drop, goal equivalent + terminal)`,
    `${generatedPassed}/${list.length} clean | playable=${generatedPlayable} explicit-terminal=${generatedTerminal}`)
  exampleLines.forEach(l => console.log(`     e.g. ${l}`))
  check(list.length >= 200 && list.length >= GENERATED_TARGET, `the generated corpus is at least the required 200 expressions`, `${list.length}`)
}

/* ── E. Optional browser check ───────────────────────────────────────────── */

const wantsBrowser = process.argv.includes('--browser')
if (wantsBrowser) {
  section('E. Browser: every /sandbox chip reaches /sandbox/play (--browser)')
  const { launch, seededState, device, nav, shot } = await import('./_harness.mjs')
  const browser = await launch()
  const state = await seededState(browser)
  const { ctx, page, errors } = await device(browser, {
    name: 'sandbox-chip-audit-desktop', viewport: { width: 1440, height: 900 },
  }, state)
  try {
    await nav(page, '/sandbox')
    const domChips = await page.locator('button[data-example]').allInnerTexts()
    const norm = (s) => s.replace(/\s+/g, ' ').trim()
    check(domChips.length === chipList.length && domChips.map(norm).join('|') === chipList.map(norm).join('|'),
      'the rendered chips match SandboxPage.jsx EXAMPLES', domChips.map(norm).join(' | '))

    for (const chip of chipList) {
      await nav(page, '/sandbox')
      const btn = page.locator(`button[data-example="${chip.replace(/"/g, '\\"')}"]`).first()
      if (await btn.count() === 0) { fail(`chip ${JSON.stringify(chip)} is clickable`, 'button not found'); continue }
      await btn.click()
      await page.waitForTimeout(700)
      const value = await page.locator('[data-testid="sandbox-input"]').first().inputValue()
      const feedback = (await page.locator('#sandbox-feedback').first().innerText().catch(() => '')).replace(/\s+/g, ' ').trim()
      const play = page.locator('[data-testid="sandbox-validate-btn"]').first()
      const enabled = !(await play.isDisabled())
      if (!(value === chip && feedback.includes('Valid expression') && enabled)) {
        fail(`chip ${JSON.stringify(chip)} fills the input and validates`, `value="${value}" enabled=${enabled} feedback="${feedback.slice(0, 60)}"`)
        continue
      }
      await play.click()
      await page.waitForSelector('[data-tutorial="canvas"]', { timeout: 12000 }).catch(() => {})
      await page.waitForTimeout(400)
      const landed = page.url().includes('/sandbox/play')
      const canvas = landed ? await page.locator('[data-tutorial="canvas"]').first().innerText().catch(() => '') : ''
      check(landed && canvas.includes('F ='), `chip ${JSON.stringify(chip)} reaches /sandbox/play with a puzzle`,
        landed ? `canvas="${canvas.replace(/\s+/g, ' ').slice(0, 60)}"` : `url=${page.url()}`)
    }

    /* The reported hole, in the real UI: typing "2" must be refused by name. */
    await nav(page, '/sandbox')
    await page.locator('[data-testid="sandbox-input"]').first().fill('2')
    await page.waitForTimeout(700)
    const badFeedback = (await page.locator('#sandbox-feedback').first().innerText().catch(() => '')).replace(/\s+/g, ' ').trim()
    const badDisabled = await page.locator('[data-testid="sandbox-validate-btn"]').first().isDisabled()
    check(badFeedback.includes('Invalid character(s) found') && badFeedback.includes('2') && badDisabled,
      'typing "2" is refused in the UI and the character is named', `feedback="${badFeedback.slice(0, 80)}" disabled=${badDisabled}`)

    await shot(page, 'sandbox-engine-audit')
    check(errors.length === 0, 'no uncaught page errors during the browser check', errors.slice(0, 3).join(' | '))
  } finally {
    await ctx.close()
    await browser.close()
  }
} else {
  section('E. Browser check skipped (pass --browser to run it)')
  console.log('     node .e2e/sandbox-engine-audit.mjs --browser')
}

/* ── Summary ─────────────────────────────────────────────────────────────── */

console.log('\n=== SUMMARY ===')
console.log(`checks passed: ${passed}`)
console.log(`checks failed: ${failed}`)
console.log(failed === 0 ? 'AUDIT: PASS' : 'AUDIT: FAIL')
process.exit(failed > 0 ? 1 : 0)
