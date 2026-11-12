/**
 * Cross-module signal: a screen just signed the learner in.
 *
 * AuthProvider normally connects to Supabase during the first idle window so the
 * SDK stays off the first-paint path for signed-out visitors. Signing in must not
 * wait for that window, so the auth actions dispatch this event and the provider
 * connects immediately.
 */
export const AUTH_CHANGE_EVENT = 'praxis:auth-change'

export function notifyAuthChanged() {
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT))
}
