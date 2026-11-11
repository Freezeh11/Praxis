/**
 * Sandbox notation: the accepted alphabet, a full-notation scanner, raw-input
 * validation and the canonical display text.
 *
 * Pure JS, no DOM, no network. The error strings are product spec — they are
 * acceptance-tested verbatim, so keep them byte-identical. The variable budget
 * is an explicit option (default: config `SANDBOX.maxVariables`), so a caller
 * can raise or lower the ceiling without touching this module.
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
 */

import { nodeText } from '../render.js'
import { parseExpr } from '../parser.js'
import { SANDBOX } from '../../config/gameRules.js'

/* ── Exact spec messages ──────────────────────────────────────────────────── */

const MSG_EMPTY = 'Please enter a Boolean expression.'
const MSG_UNBALANCED = 'Unbalanced parentheses. Check your opening and closing brackets.'
const MSG_MISSING_OPERAND = 'Missing a variable or term.'
const MSG_STRAY_NOT = 'A NOT symbol must attach to a variable, constant, or parenthesized group.'

const msgInvalidChars = (chars) =>
  `Invalid character(s) found: ${chars}. Only letters, +, ·, *, ., &, |, ', !, ¬, (), 0, 1 are allowed.`
const msgDoubleOperator = (position) => `Two operators in a row. Check around position ${position}.`
const msgTooManyVars = (count, limit) =>
  `Sandbox supports up to ${limit} variables. Your expression uses ${count}.`

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
 * The variable ceiling a call runs under: the explicit positive-integer option
 * when given, otherwise the one configured for the sandbox (see
 * config/gameRules.js SANDBOX.maxVariables).
 *
 * @param {{ maxVariables?: number }} [options]
 * @returns {number}
 */
export function resolveMaxVariables(options = {}) {
  const requested = options?.maxVariables
  return Number.isInteger(requested) && requested > 0 ? requested : SANDBOX.maxVariables
}

/**
 * Full-notation scanner used only by the validator (the engine's own tokenizer
 * silently drops unknown characters, which is exactly what validation must not
 * do). Whitespace is skipped but every token keeps its raw 0-based index so
 * error positions can be reported against the untrimmed input.
 */
export function scanTokens(raw) {
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
 */
export function canonicalTokenText(tokens) {
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

/* ── Validation ───────────────────────────────────────────────────────────── */

/**
 * Validates raw user input.
 *
 * @param {string} raw
 * @param {{ maxVariables?: number }} [options] - variable ceiling for this call
 * @returns {{ valid: boolean, error: string|null, errorCode: string|null }}
 */
export function validateSandboxInput(raw, options = {}) {
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
  const maxVariables = resolveMaxVariables(options)
  const vars = []
  for (const ch of raw) {
    if (isLetter(ch) && !vars.includes(ch)) vars.push(ch)
  }
  if (vars.length > maxVariables) {
    return failure('too-many-vars', msgTooManyVars(vars.length, maxVariables))
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
