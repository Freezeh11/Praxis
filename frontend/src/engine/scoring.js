/**
 * Score estimation — the ONE client-side implementation of the scoring rules.
 *
 * The backend is authoritative: it returns the score that gets persisted. This
 * module exists only so the UI can render the breakdown instantly (and keep
 * working if the score endpoint is unreachable), and it must stay in lockstep
 * with `backend/services/scoring_service.py` — same weights, same rounding.
 *
 * Weights and penalties come from config/game-rules.js, so the two sides cannot
 * drift on the numbers themselves.
 *
 * Pure module: no React/DOM/network.
 */
import {
  SCORE_BONUS_MAX_POINTS,
  SCORE_PENALTY,
  SCORE_WEIGHTS,
} from '../config/game-rules.js'
import { LAW_NAME_TO_ID } from './laws/definitions.js'

/** Round to one decimal, the precision the API uses. */
const round1 = (value) => Math.round(value * 10) / 10

/** Maps a law display name (as recorded in a derivation step) to its law id. */
export function lawIdOf(lawName) {
  if (!lawName) return 'unknown'
  return LAW_NAME_TO_ID[lawName] || String(lawName).toLowerCase()
}

/** Law ids used by a derivation, in step order. */
export function lawsUsedFromSteps(steps) {
  return (steps || []).map((step) => lawIdOf(step?.law))
}

/**
 * The number of steps a perfect solution needs: the solver's answer when it
 * found one, otherwise the puzzle's authored figure, otherwise what was used.
 */
export function effectiveOptimalSteps({ optimalSteps, puzzleOptimalSteps, stepsUsed }) {
  if (optimalSteps && optimalSteps > 0) return optimalSteps
  return puzzleOptimalSteps || stepsUsed
}

/**
 * @param {object} input
 * @param {number} input.stepsUsed
 * @param {number} input.optimalSteps
 * @param {string[]} input.targetLaws      laws the puzzle wants the learner to use
 * @param {string[]} input.lawsUsed        law ids applied
 * @param {number} input.hintsUsed
 * @param {number} input.guidesUsed
 * @returns {{ efficiency:number, targetLaw:number, hintIndependence:number, total:number, earnedPoints:number, breakdown:object }}
 */
export function estimateScore({
  stepsUsed = 0,
  optimalSteps = 0,
  targetLaws = [],
  lawsUsed = [],
  hintsUsed = 0,
  guidesUsed = 0,
}) {
  const required = new Set(targetLaws)
  const used = new Set(lawsUsed)
  const matched = Array.from(required).filter((law) => used.has(law)).length

  const efficiency = stepsUsed <= optimalSteps
    ? SCORE_WEIGHTS.efficiency
    : Math.max(0, SCORE_WEIGHTS.efficiency - (stepsUsed - optimalSteps) * SCORE_PENALTY.stepOverOptimal)

  const targetLaw = required.size === 0
    ? SCORE_WEIGHTS.targetLaw
    : round1((matched / required.size) * SCORE_WEIGHTS.targetLaw)

  const totalAssistance = (hintsUsed || 0) + (guidesUsed || 0)
  const hintIndependence = totalAssistance === 0
    ? SCORE_WEIGHTS.hintIndependence
    : Math.max(0, SCORE_WEIGHTS.hintIndependence - totalAssistance * SCORE_PENALTY.assistance)

  const total = round1(efficiency + targetLaw + hintIndependence)
  const earnedPoints = Math.round((total / 100) * SCORE_BONUS_MAX_POINTS)

  return {
    efficiency,
    targetLaw,
    hintIndependence,
    total,
    earnedPoints,
    breakdown: {
      stepsUsed,
      optimalSteps,
      targetLawsRequired: Array.from(required),
      targetLawsUsed: Array.from(used).filter((law) => required.has(law)),
      hintsUsed: hintsUsed || 0,
      guidesUsed: guidesUsed || 0,
      totalAssistance,
    },
  }
}
