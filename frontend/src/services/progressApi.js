/**
 * Server-side progress sync for the signed-in learner.
 *
 * localStorage remains the fast path (see state/progressStore.js); these calls
 * are the durable one. Both are silent on failure so a network problem can never
 * block gameplay.
 */
import { apiRequest } from './apiClient.js'

/** @returns {Promise<object|null>} progress snapshot, or null when unavailable */
export function loadProgress() {
  return apiRequest('/api/progress', { silent: true })
}

/**
 * @param {object} progress full progress snapshot
 * @returns {Promise<object|null>}
 */
export function saveProgress(progress) {
  return apiRequest('/api/progress/save', {
    method: 'POST',
    body: { progress },
    silent: true,
  })
}
