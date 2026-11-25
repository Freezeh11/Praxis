/**
 * The contact form's one network call.
 *
 * Components never call fetch: this module owns the body shape the backend
 * validates, so the form and the API cannot drift apart silently.
 */
import { apiRequest } from './apiClient.js'
import { APP_VERSION, describeLocation } from './feedbackContext.js'

/** Mirrors backend/api/schemas/feedback.py. */
export const MIN_MESSAGE = 10
export const MAX_MESSAGE = 2000

export const FEEDBACK_CATEGORIES = [
  {
    id: 'bug',
    icon: 'warning',
    label: 'Report a problem',
    hint: 'Something broke, froze, or behaved unexpectedly.',
  },
  {
    id: 'idea',
    icon: 'bulb',
    label: 'Suggest an improvement',
    hint: 'A puzzle, a hint, or a screen that could be clearer.',
  },
  {
    id: 'other',
    icon: 'info',
    label: 'Something else',
    hint: 'Account help, a question, or anything that does not fit.',
  },
]

/**
 * Send one report.
 * @param {{ category: string, message: string, email?: string, pathname: string }} report
 * @returns {Promise<{ status: string }>}
 */
export async function sendFeedback({ category, message, email, pathname }) {
  const { page, context } = describeLocation(pathname)
  return apiRequest('/api/feedback', {
    method: 'POST',
    body: {
      category,
      message,
      email: email ? email.trim() : undefined,
      page,
      appVersion: APP_VERSION,
      context: context || undefined,
    },
  })
}
