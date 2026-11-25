import test from 'node:test'
import assert from 'node:assert/strict'

import {
  SHORT_COOLDOWN_COPY,
  SIGNUP_RATE_LIMITED,
  RESEND_RATE_LIMITED,
  RESET_RATE_LIMITED,
  describeResetError,
  describeResendError,
  describeSignupError,
  isEmailRateLimitError,
  isShortCooldownError,
} from '../../services/authErrors.js'

// Shape measured from the live project on 2026-11-25 when the hourly mail quota
// is spent: HTTP 429, { code: 429, error_code: 'over_email_send_rate_limit',
// msg: 'email rate limit exceeded' }.
const measuredRateLimit = { code: 429, error_code: 'over_email_send_rate_limit', msg: 'email rate limit exceeded', status: 429 }

test('recognises the measured hourly rate-limit answer', () => {
  assert.equal(isEmailRateLimitError(measuredRateLimit), true)
  assert.equal(isEmailRateLimitError({ message: 'email rate limit exceeded' }), true)
  assert.equal(isEmailRateLimitError({ status: 429 }), true)
})

test('does not mistake the per-address cooldown for the hourly quota', () => {
  const cooldown = { message: 'For security purposes, you can only request this after 42 seconds.' }
  assert.equal(isShortCooldownError(cooldown), true)
  assert.equal(isEmailRateLimitError(cooldown), false)
})

test('ignores unrelated failures', () => {
  assert.equal(isEmailRateLimitError(null), false)
  assert.equal(isEmailRateLimitError({ message: 'Invalid login credentials' }), false)
  assert.equal(isShortCooldownError({ message: 'network down' }), false)
})

test('a rate-limited signup says the account was not created', () => {
  const failure = describeSignupError(measuredRateLimit)
  assert.equal(failure.rateLimited, true)
  assert.equal(failure.message, SIGNUP_RATE_LIMITED)
  assert.match(failure.message, /not created/)
  assert.match(failure.message, /hour/)
  assert.doesNotMatch(failure.message, /inbox/i, 'must not send the learner looking for a mail that was never sent')
})

test('a duplicate address points at sign-in instead of the raw provider text', () => {
  const failure = describeSignupError({ message: 'User already registered', code: 'user_already_exists' })
  assert.equal(failure.rateLimited, false)
  assert.match(failure.message, /sign in instead/i)
  assert.equal(failure.code, 'user_already_exists')
})

test('an unexplained signup failure keeps the provider message and the code', () => {
  const failure = describeSignupError({ message: 'Signups not allowed for this instance', code: 'signup_disabled' })
  assert.equal(failure.message, 'Signups not allowed for this instance')
  assert.equal(failure.code, 'signup_disabled')
  assert.equal(failure.rateLimited, false)
})

test('a blank signup failure still yields usable copy', () => {
  assert.equal(describeSignupError(null).message, 'Registration failed. Please try again.')
  assert.equal(describeSignupError({}).message, 'Registration failed. Please try again.')
})

test('resend failures separate the hourly quota, the cooldown and already-confirmed', () => {
  assert.equal(describeResendError(measuredRateLimit).message, RESEND_RATE_LIMITED)
  assert.equal(describeResendError({ message: 'Email already confirmed' }).message, 'That address is already confirmed. Sign in instead.')
  assert.equal(
    describeResendError({ message: 'For security purposes, you can only request this after 30 seconds.' }).message,
    SHORT_COOLDOWN_COPY,
  )
})

test('reset failures use the same rules without revealing whether an address exists', () => {
  assert.equal(describeResetError(measuredRateLimit).message, RESET_RATE_LIMITED)
  const unknown = describeResetError({ message: 'User not found' })
  assert.equal(unknown.message, 'User not found')
  assert.equal(unknown.rateLimited, false)
})
