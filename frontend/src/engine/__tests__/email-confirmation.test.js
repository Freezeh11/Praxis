import test from 'node:test'
import assert from 'node:assert/strict'

import {
  classifyAuthLink,
  describeAuthLinkError,
  isEmailNotConfirmedError,
  needsEmailConfirmation,
} from '../../services/emailConfirmation.js'

// The live GoTrue endpoint answers a confirmation-pending signup with the pending
// user at the top level of the body, which supabase-js reduces to this shape.
const sdkNulledPending = { data: { user: null, session: null }, error: null }

test('a signup with no session is treated as pending confirmation', () => {
  assert.equal(needsEmailConfirmation(sdkNulledPending), true)
})

test('a signup that still carries the pending user is treated as pending confirmation', () => {
  const result = { data: { user: { id: 'abc', email: 'a@b.co' }, session: null }, error: null }
  assert.equal(needsEmailConfirmation(result), true)
})

test('a signup that already has a session is not pending confirmation', () => {
  const result = { data: { user: { id: 'abc' }, session: { access_token: 'token' } }, error: null }
  assert.equal(needsEmailConfirmation(result), false)
})

test('a rejected signup is not pending confirmation', () => {
  const result = { data: { user: null, session: null }, error: { message: 'User already registered' } }
  assert.equal(needsEmailConfirmation(result), false)
})

test('a missing result is not pending confirmation', () => {
  assert.equal(needsEmailConfirmation(null), false)
  assert.equal(needsEmailConfirmation(undefined), false)
  assert.equal(needsEmailConfirmation({ data: null, error: null }), false)
})

test('an unconfirmed sign-in is recognised by code or by message', () => {
  assert.equal(isEmailNotConfirmedError({ code: 'email_not_confirmed', message: 'Email not confirmed' }), true)
  assert.equal(isEmailNotConfirmedError({ code: null, message: 'Email not confirmed' }), true)
  assert.equal(isEmailNotConfirmedError({ message: 'Your email address has not been confirmed' }), true)
  assert.equal(isEmailNotConfirmedError({ code: 'invalid_credentials', message: 'Invalid login credentials' }), false)
  assert.equal(isEmailNotConfirmedError(null), false)
})

test('a confirmation URL is classified from the hash or the query', () => {
  const fromHash = classifyAuthLink('http://x/auth/confirm#access_token=abc&refresh_token=def&type=signup')
  assert.equal(fromHash.kind, 'token')
  assert.equal(fromHash.hasAccessToken, true)
  assert.equal(fromHash.linkType, 'signup')

  const fromQuery = classifyAuthLink('http://x/auth/confirm?code=abc123&type=recovery')
  assert.equal(fromQuery.kind, 'token')
  assert.equal(fromQuery.hasCode, true)

  assert.equal(classifyAuthLink('http://x/auth/confirm').kind, 'none')
})

test('a rejected link exposes code, copy and no raw description', () => {
  const link = classifyAuthLink(
    'http://x/auth/confirm#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid',
  )
  assert.equal(link.kind, 'error')
  assert.equal(link.hasError, true)
  assert.equal(link.errorCode, 'otp_expired')
  assert.equal(link.errorMessage, 'That confirmation link has expired.')
  assert.doesNotMatch(link.errorMessage, /Email link is invalid/)
})

test('link copy never echoes the description', () => {
  const copy = describeAuthLinkError('unknown_code', 'https://evil.example/phish')
  assert.doesNotMatch(copy, /evil\.example/)
  assert.equal(describeAuthLinkError('otp_expired'), 'That confirmation link has expired.') 
})

test('an unparsable href degrades to the empty classification', () => {
  assert.equal(classifyAuthLink('').kind, 'none')
  assert.equal(classifyAuthLink(undefined).hasError, false)
})
