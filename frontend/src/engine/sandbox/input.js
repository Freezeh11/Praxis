/**
 * Sandbox free-text input -> playable puzzle.
 *
 * Feature 1, part 1 of 2 — pure JS, no DOM, no network. Notation, validation
 * and the canonical display text live in ./validate.js; this module turns an
 * accepted expression into a puzzle the shared workspace can play.
 *
 * FROZEN API (two sibling modules code against this exact shape — do not
 * rename; ./validate.js is re-exported here so the path stays stable):
 *   MAX_SANDBOX_VARS          : 4  (= config SANDBOX.maxVariables)
 *   validateSandboxInput(raw, options?) : { valid, error, errorCode }
 *   buildSandboxPuzzle(raw, options?)   : { ok:true, puzzle, exprText, varCount }
 *                                       | { ok:false, errorCode, error }
 *   normalizeSandboxExpr(raw) : string  (canonical display text)
 *
 * Options are explicit so the engine stays pure and testable; both entry points
 * default to the configured sandbox settings:
 *   { maxVariables }  variable ceiling for this call   (default SANDBOX.maxVariables)
 *   { budget }        { simplestForm, optimalPath } BFS budgets
 *                      (default SANDBOX.budget — see config/gameRules.js; the
 *                      worst measured four-variable input needs 26.8k states)
 * Raising the sandbox ceiling from 4 to 6 variables is a one-line edit in
 * config/gameRules.js: `SANDBOX.maxVariables`.
 *
 * Acceptance invariants enforced by buildSandboxPuzzle (a violation is refused
 * as `not-simplifiable` rather than handed to the workspace):
 *   1. an accepted input never loses a character during tokenisation,
 *   2. the shipped goal is equivalent to the start AND terminal under the very
 *      move set the workspace offers,
 *   3. every shipped derivation step is one of those workspace moves.
 */
import { nodeText, canonText } from '../render.js'
import { extractVariables, isEquivalent } from '../equivalence.js'
import { parseExpr } from '../parser.js'
import { findSimplestForm, findOptimalPath, getLegalTransitions } from '../solver.js'
import { SANDBOX } from '../../config/gameRules.js'
import {
  canonicalTokenText,
  normalizeSandboxExpr,
  resolveMaxVariables,
  scanTokens,
  validateSandboxInput,
} from './validate.js'

export { normalizeSandboxExpr, validateSandboxInput }

/** The configured variable ceiling, re-exported for callers that only need it. */
export const MAX_SANDBOX_VARS = SANDBOX.maxVariables

/** Option set the sandbox builder searches with; the default engine is graded. */
const SANDBOX_ENGINE = { allowExpand: true }

const MSG_ALREADY_SIMPLEST = 'This expression is already in its simplest form. Try a more complex one!'
const MSG_NOT_SIMPLIFIABLE = 'This expression is too complex for the sandbox engine. Try a simpler one.'

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

/* ── Puzzle construction ──────────────────────────────────────────────────── */

/**
 * Turns validated user input into a playable puzzle for the shared engine.
 *
 * Pipeline: validate -> parse -> round-trip guards -> findSimplestForm ->
 * findOptimalPath -> workspace self-check -> puzzle. Never reimplements BFS:
 * every search and every move comes from ./solver.js.
 *
 * @param {string} raw
 * @param {{ maxVariables?: number, budget?: { simplestForm: object, optimalPath: object } }} [options]
 * @returns {{ ok: true, puzzle: object, exprText: string, varCount: number }
 *          | { ok: false, errorCode: string, error: string }}
 */
export function buildSandboxPuzzle(raw, options = {}) {
  const budget = options?.budget ?? SANDBOX.budget

  /* 1. validation — its error message is passed through unchanged */
  const validation = validateSandboxInput(raw, { maxVariables: resolveMaxVariables(options) })
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
  const simplest = findSimplestForm(parsed, { ...budget.simplestForm, allowExpand: true })
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
  const solution = findOptimalPath(parsed, simplest.canon, { ...budget.optimalPath, allowExpand: true })
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
