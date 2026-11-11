/**
 * Score submission.
 *
 * The backend is authoritative for scoring; this module only carries the
 * derivation to it. Failures are silent by design: a learner who solved a puzzle
 * offline still sees their local breakdown, they just do not get the server
 * figure persisted.
 */
import { apiRequest } from './apiClient.js'

/**
 * @param {object} submission
 * @param {number} submission.levelId
 * @param {number} submission.stageIdx
 * @param {number} submission.stepsUsed
 * @param {string[]} submission.lawsUsed law ids applied, in step order
 * @param {number} submission.hintsUsed
 * @param {number} [submission.guidesUsed]
 * @param {number} submission.optimalSteps
 * @returns {Promise<object|null>} the score response, or null when unavailable
 */
export function submitScore({
  levelId,
  stageIdx,
  stepsUsed,
  lawsUsed,
  hintsUsed,
  guidesUsed = 0,
  optimalSteps,
}) {
  return apiRequest('/api/score', {
    method: 'POST',
    body: { levelId, stageIdx, stepsUsed, lawsUsed, hintsUsed, guidesUsed, optimalSteps },
    silent: true,
  })
}
