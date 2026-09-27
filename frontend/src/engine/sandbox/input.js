/**
 * Sandbox free-text input: validation + puzzle construction.
 *
 * Feature 1, part 1 of 2 — pure JS, no DOM, no network.
 *
 * FROZEN API (two sibling modules code against this exact shape — do not rename):
 *   MAX_SANDBOX_VARS          : 6
 *   validateSandboxInput(raw) : { valid, error, errorCode }
 *   buildSandboxPuzzle(raw)   : { ok:true, puzzle, exprText, varCount } | { ok:false, errorCode, error }
 *   normalizeSandboxExpr(raw) : string  (canonical display text)
 *
 * Accepted notation (permissive symbols, strict structure):
 *   variables      single letters A-Z / a-z (case-sensitive: A and a differ)
 *   AND            ·  *  .  &  or implicit adjacency (AB, A(B+C))
 *   OR             +  |  ∨
 *   NOT            postfix '  , prefix !  , prefix ¬   (A' , !A , (A+B)' )
 *   constants      0 / 1
 *   parentheses    ( )
 *   whitespace     ignored
 *
 * Error codes (first failure wins, in this order):
 *   empty -> invalid-chars -> unbalanced -> too-many-vars
 *         -> double-operator -> missing-operand -> stray-not
 *   plus (buildSandboxPuzzle only): already-simplest, not-simplifiable
 *
 * Acceptance invariants enforced by buildSandboxPuzzle (a violation is refused
 * as `not-simplifiable` rather than handed to the workspace):
 *   1. an accepted input never loses a character during tokenisation,
 *   2. the shipped goal is equivalent to the start AND terminal under the very
 *      move set the workspace offers,
 *   3. every shipped derivation step is one of those workspace moves.
 *
 * The error strings are part of the product spec — they are acceptance-tested
 * verbatim, so keep them byte-identical.
 */
import { nodeText, canonText } from '../render.js'
import { extractVariables, isEquivalent } from '../equivalence.js'
import { parseExpr } from '../parser.js'
import { findSimplestForm, findOptimalPath, getLegalTransitions } from '../solver.js'

export const MAX_SANDBOX_VARS = 6

/** Option set the sandbox builder searches with; the default engine is graded. */
const SANDBOX_ENGINE = { allowExpand: true }

/* ── Exact spec messages ──────────────────────────────────────────────────── */

const MSG_EMPTY = 'Please enter a Boolean expression.'
const MSG_UNBALANCED = 'Unbalanced parentheses. Check your opening and closing brackets.'
const MSG_MISSING_OPERAND = 'Missing a variable or term.'
const MSG_STRAY_NOT = 'A NOT symbol must attach to a variable, constant, or parenthesized group.'
const MSG_ALREADY_SIMPLEST = 'This expression is already in its simplest form. Try a more complex one!'
const MSG_NOT_SIMPLIFIABLE = 'This expression is too complex for the sandbox engine. Try a simpler one.'

const msgInvalidChars = (chars) =>
  `Invalid character(s) found: ${chars}. Only letters, +, ·, *, ., &, |, ', !, ¬, (), 0, 1 are allowed.`
const msgDoubleOperator = (position) => `Two operators in a row. Check around position ${position}.`
const msgTooManyVars = (count) =>
  `Sandbox supports up to ${MAX_SANDBOX_VARS} variables. Your expression uses ${count}.`

/* ── Character classes ────────────────────────────────────────────────────── */

/* `~` is deliberately absent: the spec message lists the allowed alphabet and
   `~` is not in it, even though the internal parser tolerates it.
   `∨` is accepted as OR ("A∨B" is a required valid case) even though the
   message text above quotes the spec's shorter list verbatim.
   Digits 2-9 are deliberately absent too: the declared alphabet allows only the
   constants 0 and 1, and the engine's own tokenizer silently DROPS any other
   digit ("2" would be read as constant 0), so accepting them would hand the
   learner a silently wrong expression. */
const LETTER_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
const CONSTANT_CHARS = new Set(['0', '1'])
const OR_CHARS = new Set(['+', '|', '∨'])
const AND_CHARS = new Set(['*', '·', '.', '&'])
const PRE_NOT_CHARS = new Set(['!', '¬'])
const POST_NOT_CHAR = "'"
const GROUP_CHARS = new Set(['(', ')'])

/* Derived from the scanner's own classes, so a character can never be
   "allowed" without also being tokenisable — and an alphabet character the
   engine would drop can never be allowed. */
const ALLOWED_CHARS = new Set([
  ...LETTER_CHARS,
  ...CONSTANT_CHARS,
  ...OR_CHARS,
  ...AND_CHARS,
  ...PRE_NOT_CHARS,
  POST_NOT_CHAR,
  ...GROUP_CHARS,
])

const BINARY_TOKENS = new Set(['AND', 'OR'])
/* A NOT token is only legal when it has a complete operand on its own side. */
const OPERAND_END = new Set(['VAR', 'CONST', 'RPAREN', 'POST_NOT'])
const OPERAND_START = new Set(['VAR', 'CONST', 'LPAREN', 'PRE_NOT'])

const isWhitespace = (ch) => /\s/.test(ch)
const isLetter = (ch) => /[A-Za-z]/.test(ch)
const isConstant = (ch) => CONSTANT_CHARS.has(ch)

/**
 * Full-notation scanner used only by the validator (the engine's own tokenizer
 * silently drops unknown characters, which is exactly what validation must not
 * do). Whitespace is skipped but every token keeps its raw 0-based index so
 * error positions can be reported against the untrimmed input.
 */
function scanTokens(raw) {
  const tokens = []
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]
    if (isWhitespace(ch)) continue
    let type = 'UNKNOWN'
    if (isLetter(ch)) type = 'VAR'
    else if (isConstant(ch)) type = 'CONST'
    else if (OR_CHARS.has(ch)) type = 'OR'
    else if (AND_CHARS.has(ch)) type = 'AND'
    else if (ch === POST_NOT_CHAR) type = 'POST_NOT'
    else if (PRE_NOT_CHARS.has(ch)) type = 'PRE_NOT'
    else if (ch === '(') type = 'LPAREN'
    else if (ch === ')') type = 'RPAREN'
    tokens.push({ type, char: ch, index: i })
  }
  return tokens
}

/**
 * Re-serialises a token stream into canonical ASCII notation (`*` for AND, `+`
 * for OR, `!` for prefix NOT, `'` for postfix NOT). Every token contributes
 * exactly one character group, so a dropped character shows up as a length
 * mismatch. Returns null when a token could not be classified — i.e. exactly
 * the characters the engine's tokenizer would silently drop.
 *
 * @param {Array<{type: string, char: string}>} tokens
 * @returns {string|null}
 */
function canonicalTokenText(tokens) {
  let out = ''
  for (const t of tokens) {
    switch (t.type) {
      case 'VAR': out += t.char; break
      case 'CONST': out += t.char; break
      case 'OR': out += '+'; break
      case 'AND': out += '*'; break
      case 'POST_NOT': out += "'"; break
      case 'PRE_NOT': out += '!'; break
      case 'LPAREN': out += '('; break
      case 'RPAREN': out += ')'; break
      default: return null
    }
  }
  return out
}

const failure = (errorCode, error) => ({ valid: false, error, errorCode })
const puzzleFailure = (errorCode, error) => ({ ok: false, errorCode, error })

/* ── Workspace self-checks (same move set the UI is given) ────────────────── */

/** True when the workspace would offer no further move from `tree`. */
function isUiTerminal(tree) {
  return getLegalTransitions(tree, SANDBOX_ENGINE).length === 0
}

/**
 * True when every reported step is one of the moves the workspace itself will
 * offer from the matching state — this is what step-locking relies on.
 */
function replaysThroughUi(startTree, solutionPath) {
  let cursor = startTree
  for (const step of solutionPath) {
    if (nodeText(cursor) !== step.from) return false
    const next = getLegalTransitions(cursor, SANDBOX_ENGINE)
      .find(t => t.nextCanon === canonText(parseExpr(step.to)))
    if (!next) return false
    cursor = next.nextTree
  }
  return true
}

/**
 * True when the puzzle about to ship is exactly what the workspace can play:
 * the goal TEXT re-parses to a terminal form (the learner cannot simplify past
 * the target) and the derivation replays through the workspace move set. Never
 * throws — anything unreadable is simply not shippable.
 */
function shipsCleanly(uiStartTree, goalText, solutionPath) {
  try {
    return isUiTerminal(parseExpr(goalText)) && replaysThroughUi(uiStartTree, solutionPath)
  } catch {
    return false
  }
}

/* ── Validation ───────────────────────────────────────────────────────────── */

/**
 * Validates raw user input.
 *
 * @param {string} raw
 * @returns {{ valid: boolean, error: string|null, errorCode: string|null }}
 */
export function validateSandboxInput(raw) {
  /* 1. empty */
  if (typeof raw !== 'string' || raw.trim() === '') {
    return failure('empty', MSG_EMPTY)
  }

  /* 2. invalid characters (first-appearance order, raw untrimmed input).
        The scanner skips whitespace and keeps every other character, so a
        character is invalid when it is outside the declared alphabet OR when
        the scanner cannot classify it. Both kinds are reported by name. */
  const tokens = scanTokens(raw)
  const offenders = []
  for (const t of tokens) {
    if (t.type !== 'UNKNOWN' && ALLOWED_CHARS.has(t.char)) continue
    if (!offenders.includes(t.char)) offenders.push(t.char)
  }
  if (offenders.length > 0) {
    return failure('invalid-chars', msgInvalidChars(offenders.join(', ')))
  }

  /* 3. balanced parentheses */
  let depth = 0
  for (const ch of raw) {
    if (ch === '(') depth++
    else if (ch === ')') {
      depth--
      if (depth < 0) return failure('unbalanced', MSG_UNBALANCED)
    }
  }
  if (depth !== 0) return failure('unbalanced', MSG_UNBALANCED)

  /* 4. variable budget (distinct letters, case-sensitive) */
  const vars = []
  for (const ch of raw) {
    if (isLetter(ch) && !vars.includes(ch)) vars.push(ch)
  }
  if (vars.length > MAX_SANDBOX_VARS) {
    return failure('too-many-vars', msgTooManyVars(vars.length))
  }

  /* 5. two binary operators in a row */
  for (let i = 1; i < tokens.length; i++) {
    if (BINARY_TOKENS.has(tokens[i].type) && BINARY_TOKENS.has(tokens[i - 1].type)) {
      // 1-based position of the SECOND operator in the raw, untrimmed input.
      return failure('double-operator', msgDoubleOperator(tokens[i].index + 1))
    }
  }

  /* 6. missing operand */
  const first = tokens[0]
  const last = tokens[tokens.length - 1]
  if (!first || !last) return failure('missing-operand', MSG_MISSING_OPERAND)
  if (BINARY_TOKENS.has(first.type) || BINARY_TOKENS.has(last.type)) {
    return failure('missing-operand', MSG_MISSING_OPERAND)
  }
  for (let i = 0; i < tokens.length - 1; i++) {
    const a = tokens[i]
    const b = tokens[i + 1]
    if (a.type === 'LPAREN' && (b.type === 'RPAREN' || BINARY_TOKENS.has(b.type))) {
      return failure('missing-operand', MSG_MISSING_OPERAND)
    }
    if (BINARY_TOKENS.has(a.type) && b.type === 'RPAREN') {
      return failure('missing-operand', MSG_MISSING_OPERAND)
    }
  }

  /* 7. stray NOT */
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (t.type === 'POST_NOT' && !(i > 0 && OPERAND_END.has(tokens[i - 1].type))) {
      return failure('stray-not', MSG_STRAY_NOT)
    }
    if (t.type === 'PRE_NOT' && !(i + 1 < tokens.length && OPERAND_START.has(tokens[i + 1].type))) {
      return failure('stray-not', MSG_STRAY_NOT)
    }
  }

  return { valid: true, error: null, errorCode: null }
}

/**
 * Canonical display text for whatever the engine can read out of `raw`.
 * Best-effort: returns '' for empty / non-string input and never throws, so the
 * live input preview can render on every keystroke.
 *
 * @param {string} raw
 * @returns {string}
 */
export function normalizeSandboxExpr(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') return ''
  try {
    return nodeText(parseExpr(raw))
  } catch {
    return ''
  }
}

/* ── Puzzle construction ──────────────────────────────────────────────────── */

/**
 * Turns validated user input into a playable puzzle for the shared engine.
 *
 * Pipeline: validate -> parse -> round-trip guards -> findSimplestForm ->
 * findOptimalPath -> workspace self-check -> puzzle. Never reimplements BFS:
 * every search and every move comes from ./solver.js.
 *
 * @param {string} raw
 * @returns {{ ok: true, puzzle: object, exprText: string, varCount: number }
 *          | { ok: false, errorCode: string, error: string }}
 */
export function buildSandboxPuzzle(raw) {
  /* 1. validation — its error message is passed through unchanged */
  const validation = validateSandboxInput(raw)
  if (!validation.valid) {
    return puzzleFailure(validation.errorCode, validation.error)
  }

  /* 2. parse + round-trip guards */
  let parsed
  try {
    parsed = parseExpr(raw)
  } catch {
    return puzzleFailure('not-simplifiable', MSG_NOT_SIMPLIFIABLE)
  }
  const parsedCanon = canonText(parsed)
  /* (a) the engine must read its own rendering back as the same formula. */
  if (canonText(parseExpr(nodeText(parsed))) !== parsedCanon) {
    return puzzleFailure('not-simplifiable', MSG_NOT_SIMPLIFIABLE)
  }
  /* (b) an ACCEPTED input must never lose a character during tokenisation.
         Re-serialise the validator's own token stream — one canonical character
         group per accepted character, so nothing can disappear — and require
         the engine to read back exactly the same formula. If the engine silently
         dropped or misread a character (e.g. the old digit hole where "2"
         became the constant 0), the two canonical forms differ and the input is
         refused instead of producing a silently wrong puzzle. */
  const tokenText = canonicalTokenText(scanTokens(raw))
  let tokenRoundTrip = null
  if (tokenText !== null) {
    try {
      tokenRoundTrip = canonText(parseExpr(tokenText))
    } catch {
      tokenRoundTrip = null
    }
  }
  if (tokenText === null || tokenText.length !== raw.replace(/\s+/g, '').length
      || tokenRoundTrip !== parsedCanon) {
    return puzzleFailure('not-simplifiable', MSG_NOT_SIMPLIFIABLE)
  }

  /* 3. fully simplified terminal form — the sandbox opts into the gated
        Distributive-Expand law, which graded levels never enable */
  const simplest = findSimplestForm(parsed, { maxDepth: 14, maxStates: 20000, allowExpand: true })
  if (!simplest.found) {
    return puzzleFailure('not-simplifiable', MSG_NOT_SIMPLIFIABLE)
  }
  if (simplest.optimalSteps === 0) {
    return puzzleFailure('already-simplest', MSG_ALREADY_SIMPLEST)
  }
  // Extra guard: never hand the UI a goal that is not equivalent to its start.
  if (!isEquivalent(parsed, simplest.tree)) {
    return puzzleFailure('not-simplifiable', MSG_NOT_SIMPLIFIABLE)
  }

  /* 4. guaranteed legal forward path (the step-locking rule needs one) */
  const solution = findOptimalPath(parsed, simplest.canon, { maxDepth: 14, maxStates: 24000, allowExpand: true })
  if (!solution.found) {
    return puzzleFailure('not-simplifiable', MSG_NOT_SIMPLIFIABLE)
  }

  /* 5. self-check against the move set the workspace actually offers.
        The UI receives TEXT and parses it again, so both promises are checked
        on re-parsed trees: the shipped goal must be terminal (no further legal
        move, or the learner can simplify past the target) and every shipped
        step must be one of the moves the UI itself will offer. The engine can
        otherwise return a "simplest form" whose text still has moves, or a path
        the UI cannot replay — refusing such input explicitly beats handing over
        a puzzle that dead-ends or lies about its optimal path. */
  const uiStart = parseExpr(nodeText(parsed))
  if (!shipsCleanly(uiStart, simplest.text, solution.path)) {
    return puzzleFailure('not-simplifiable', MSG_NOT_SIMPLIFIABLE)
  }

  /* 6. puzzle object */
  const exprText = nodeText(parsed)
  const steps = solution.optimalSteps
  const puzzle = {
    expr: exprText,
    goal: simplest.text,
    targetLaws: [],
    hints: [],
    optimalSteps: steps,
    optimalHint: `This one can be fully simplified in ${steps} step${steps === 1 ? '' : 's'}.`,
    difficulty: 'custom',
    solutionPath: solution.path,
    // Enables the gated Distributive-Expand law in the workspace (useGameState).
    allowExpand: true,
  }

  return {
    ok: true,
    puzzle,
    exprText,
    varCount: extractVariables(parsed).length,
  }
}
