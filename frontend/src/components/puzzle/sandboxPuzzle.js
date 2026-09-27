/**
 * sandboxPuzzle — the whole sandbox contract of the puzzle workspace.
 *
 * /sandbox validates a typed expression and hands it to /sandbox/play as route
 * state `{ customPuzzle, exprText }`, while sessionStorage keeps the same
 * expression across a refresh; `{ random: true }` and a bare /sandbox/play both
 * mean "generated problem". This module owns that contract, the synthetic level
 * the workspace runs on and the stored slot — no React state, no rendering.
 */
import { useEffect } from 'react'

import { SANDBOX_DIFFICULTY } from '../../config/gameRules.js'
import { CUSTOM_SANDBOX_PUZZLE } from '../../config/storageKeys.js'
import { generatePuzzlePair } from '../../engine/index.js'

/** The sandbox has no level metadata to fetch, so this stub is all it needs. */
export const SANDBOX_LEVEL = { id: 'sandbox', name: 'Sandbox', desc: 'Free practice', varCount: 3, puzzles: [] }

/** The shared engine needs both the start expression and a target to be playable. */
function isPlayablePuzzle(candidate) {
  return Boolean(
    candidate
    && typeof candidate.expr === 'string' && candidate.expr.trim() !== ''
    && typeof candidate.goal === 'string' && candidate.goal.trim() !== '',
  )
}

/** Reads the persisted custom puzzle, tolerating a missing/corrupt slot. */
function readStoredCustomPuzzle() {
  try {
    const raw = sessionStorage.getItem(CUSTOM_SANDBOX_PUZZLE)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const puzzle = parsed && parsed.puzzle ? parsed.puzzle : parsed
    return isPlayablePuzzle(puzzle) ? puzzle : null
  } catch (err) {
    console.warn('Ignoring unreadable sandbox puzzle in sessionStorage:', err)
    return null
  }
}

/**
 * A typed sandbox expression survives a refresh; RANDOM mode clears the slot so
 * a later bare /sandbox/play never resurrects a stale expression.
 */
export function useStoredCustomPuzzleSlot(isSandbox, customPuzzle) {
  useEffect(() => {
    if (!isSandbox) return
    try {
      if (customPuzzle) sessionStorage.setItem(CUSTOM_SANDBOX_PUZZLE, JSON.stringify({ puzzle: customPuzzle }))
      else sessionStorage.removeItem(CUSTOM_SANDBOX_PUZZLE)
    } catch (err) {
      console.warn('Could not persist the sandbox puzzle:', err)
    }
  }, [isSandbox, customPuzzle])
}

/** Builds the synthetic "level" + generated puzzle pair used by sandbox mode. */
export function buildSandboxState(excludeExpr = null) {
  let puzzle
  try {
    puzzle = generatePuzzlePair(excludeExpr, SANDBOX_DIFFICULTY)
  } catch (err) {
    console.warn('Sandbox generator failed, keeping the current problem:', err)
    throw err
  }
  return {
    level: SANDBOX_LEVEL,
    stageNum: 0,
    puzzle,
  }
}

/**
 * Resolves which puzzle a /sandbox/play visit starts on: the typed expression
 * from route state, nothing for an explicit RANDOM visit, otherwise whatever a
 * previous visit stored. Graded routes never carry a custom puzzle.
 */
export function resolveCustomPuzzle(isSandbox, routeState) {
  if (!isSandbox) return null
  if (isPlayablePuzzle(routeState && routeState.customPuzzle)) return routeState.customPuzzle
  if (routeState && routeState.random === true) return null
  return readStoredCustomPuzzle()
}
