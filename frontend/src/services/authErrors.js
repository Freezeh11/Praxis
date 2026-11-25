/**
 * Learner-facing copy for Supabase auth failures.
 *
 * Pure decisions (no React, no Supabase) so the wording rules are testable in
 * plain Node. Two different throttles exist and they need different advice:
 *
 * - a short cooldown — GoTrue answers "For security purposes, you can only
 *   request this after 60 seconds", so waiting a minute is enough;
 * - a spent hourly mail quota — signup answers HTTP 429 with
 *   `error_code: 'over_email_send_rate_limit'` and the message "email rate limit
 *   exceeded", which lasts until the hour rolls over.
 *
 * Measured on 2026-11-25 against this project: a signup refused this way creates
 * NO account — a password grant for the same address immediately afterwards
 * returns `invalid_credentials`, not `email_not_confirmed`. The copy therefore
 * says so, because "check your inbox" would send the learner looking for a mail
 * that was never sent.
 */

const HOURLY_LIMIT = /over_email_send_rate_limit|email rate limit exceeded|rate limit/i
const SHORT_COOLDOWN = /only request this after|seconds/i
const ALREADY_CONFIRMED = /already confirmed|already been confirmed/i
const ALREADY_REGISTERED = /already registered|already exists|user already/i

/**
 * True when the provider refused to send mail because the hourly quota is spent.
 *
 * @param {{ code?: unknown, error_code?: unknown, status?: unknown, message?: unknown, msg?: unknown } | string | null} error
 * @returns {boolean}
 */
export function isEmailRateLimitError(error) {
  if (!error) return false
  if (typeof error === 'string') return HOURLY_LIMIT.test(error) && !SHORT_COOLDOWN.test(error)
  const code = String(error.code ?? error.error_code ?? '')
  if (code === 'over_email_send_rate_limit') return true
  if (Number(error.status) === 429) return true
  const message = String(error.message ?? error.msg ?? '')
  return HOURLY_LIMIT.test(message) && !SHORT_COOLDOWN.test(message)
}

/**
 * True for the per-address "try again in N seconds" cooldown, which is not the
 * hourly quota and should not be described as one.
 *
 * @param {{ message?: unknown, msg?: unknown } | string | null} error
 * @returns {boolean}
 */
export function isShortCooldownError(error) {
  if (!error) return false
  const message = typeof error === 'string' ? error : String(error.message ?? error.msg ?? '')
  return SHORT_COOLDOWN.test(message)
}

export const SIGNUP_RATE_LIMITED =
  'Too many confirmation emails went out in the last hour, so your account was not created. Try again in about an hour.'

export const RESEND_RATE_LIMITED =
  'Too many confirmation emails went out in the last hour. Try again in about an hour.'

export const RESET_RATE_LIMITED =
  'Too many reset emails went out in the last hour. Try again in about an hour.'

export const SHORT_COOLDOWN_COPY = 'Wait a minute before requesting another email.'

/**
 * Normalise a signup failure into `{ message, code, rateLimited }`.
 *
 * @param {{ code?: unknown, message?: unknown, msg?: unknown, status?: unknown } | null} error
 * @returns {{ message: string, code: string | null, rateLimited: boolean }}
 */
export function describeSignupError(error) {
  const code = error && typeof error === 'object' && error.code != null ? String(error.code) : null
  if (isEmailRateLimitError(error)) {
    return { message: SIGNUP_RATE_LIMITED, code: code ?? 'over_email_send_rate_limit', rateLimited: true }
  }
  const raw = String((error && (error.message ?? error.msg)) || '').trim()
  if (ALREADY_REGISTERED.test(raw)) {
    return { message: 'An account already exists for that address. Sign in instead.', code, rateLimited: false }
  }
  if (isShortCooldownError(error)) {
    return { message: SHORT_COOLDOWN_COPY, code, rateLimited: false }
  }
  return { message: raw || 'Registration failed. Please try again.', code, rateLimited: false }
}

/**
 * Normalise a resend-link failure into `{ message, code, rateLimited }`.
 *
 * @param {{ code?: unknown, message?: unknown, msg?: unknown, status?: unknown } | null} error
 * @returns {{ message: string, code: string | null, rateLimited: boolean }}
 */
export function describeResendError(error) {
  const code = error && typeof error === 'object' && error.code != null ? String(error.code) : null
  if (isEmailRateLimitError(error)) {
    return { message: RESEND_RATE_LIMITED, code: code ?? 'over_email_send_rate_limit', rateLimited: true }
  }
  const raw = String((error && (error.message ?? error.msg)) || '').trim()
  if (ALREADY_CONFIRMED.test(raw)) {
    return { message: 'That address is already confirmed. Sign in instead.', code, rateLimited: false }
  }
  if (isShortCooldownError(error)) {
    return { message: SHORT_COOLDOWN_COPY, code, rateLimited: false }
  }
  return { message: raw || 'Could not send the confirmation email.', code, rateLimited: false }
}

/**
 * Normalise a password-reset failure. Account existence is never revealed here.
 *
 * @param {{ code?: unknown, message?: unknown, msg?: unknown, status?: unknown } | null} error
 * @returns {{ message: string, code: string | null, rateLimited: boolean }}
 */
export function describeResetError(error) {
  const code = error && typeof error === 'object' && error.code != null ? String(error.code) : null
  if (isEmailRateLimitError(error)) {
    return { message: RESET_RATE_LIMITED, code: code ?? 'over_email_send_rate_limit', rateLimited: true }
  }
  if (isShortCooldownError(error)) {
    return { message: SHORT_COOLDOWN_COPY, code, rateLimited: false }
  }
  return { message: String((error && (error.message ?? error.msg)) || 'Could not send the reset email.'), code, rateLimited: false }
}
