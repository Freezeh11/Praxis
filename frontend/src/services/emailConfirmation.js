/**
 * Pure decisions behind the email-confirmation flow.
 *
 * Kept free of React and Supabase so the pages stay declarative and the rules are
 * testable in plain Node. Nothing here reads `window` at import time: the caller
 * passes the URL it wants classified.
 */

/** Supabase error codes that describe a dead or unusable confirmation link. */
const LINK_ERROR_COPY = {
  otp_expired: 'That confirmation link has expired.',
  access_denied: 'That confirmation link is no longer valid.',
  expired_token: 'That confirmation link has expired.',
  invalid_token: 'That confirmation link is not valid.',
  server_error: 'The confirmation service could not handle that link. Try again in a moment.',
}

/**
 * True when signup succeeded but Supabase created no session.
 *
 * With "Confirm email" enabled, `signUp` returns the pending user and a null
 * session; the learner is not signed in until they open the emailed link.
 *
 * @param {{ data?: { user?: unknown, session?: unknown } | null, error?: unknown } | null} result
 * @returns {boolean}
 */
export function needsEmailConfirmation(result) {
  return Boolean(result?.data?.user) && result?.data?.session == null && !result?.error
}

/**
 * True when a sign-in failed only because the address has not been confirmed.
 *
 * Supabase returns `email_not_confirmed` (newer versions) or the plain message
 * "Email not confirmed"; both mean the password may well be right.
 *
 * @param {{ code?: string, message?: string } | string | null} error
 * @returns {boolean}
 */
export function isEmailNotConfirmedError(error) {
  const code = typeof error === 'object' && error ? error.code : ''
  if (code === 'email_not_confirmed') return true
  const message = typeof error === 'string' ? error : error?.message
  return Boolean(message) && /email[^.!?]*not[^.!?]*confirmed|not confirmed/i.test(message)
}

/** Merge query and hash parameters, letting the query win on duplicates. */
function readLinkParams(url) {
  const params = {}
  const take = (search) => {
    const parsed = new URLSearchParams(search || '')
    for (const [key, value] of parsed) {
      if (!(key in params)) params[key] = value
    }
  }
  take(url.search)
  take(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash)
  return params
}

/**
 * Turn a Supabase `error_code` / `error_description` pair into learner-facing copy.
 *
 * The description is never rendered verbatim: it arrives in the URL, so treating
 * it as display text would let any crafted link put arbitrary words on the page.
 * It is only used to classify the failure.
 *
 * @param {string} code
 * @param {string} description
 * @returns {string}
 */
export function describeAuthLinkError(code, description = '') {
  if (code && LINK_ERROR_COPY[code]) return LINK_ERROR_COPY[code]
  const text = `${code} ${description}`.toLowerCase()
  if (/expired/.test(text)) return 'That confirmation link has expired.'
  if (/invalid|not valid|malformed/.test(text)) return 'That confirmation link is not valid.'
  if (/denied|access/.test(text)) return 'That confirmation link is no longer valid.'
  return 'We could not confirm that link. Request a new one below.'
}

/**
 * Classify the URL Supabase redirected to.
 *
 * - `error`  — the link was rejected; `errorMessage` is safe display copy.
 * - `token`  — the URL carries an implicit `access_token` or a PKCE `code`, and
 *   supabase-js is expected to turn it into a session.
 * - `none`   — neither, so there is nothing to exchange (direct visit, or the
 *   parameters were already consumed).
 *
 * @param {string} href Absolute or relative URL of the current page.
 * @returns {{
 *   kind: 'error' | 'token' | 'none',
 *   hasError: boolean,
 *   errorCode: string,
 *   errorDescription: string,
 *   errorMessage: string | null,
 *   hasCode: boolean,
 *   hasAccessToken: boolean,
 *   linkType: string,
 * }}
 */
export function classifyAuthLink(href) {
  let url
  try {
    url = new URL(String(href || ''), 'http://localhost')
  } catch {
    return {
      kind: 'none',
      hasError: false,
      errorCode: '',
      errorDescription: '',
      errorMessage: null,
      hasCode: false,
      hasAccessToken: false,
      linkType: '',
    }
  }

  const params = readLinkParams(url)
  const errorCode = params.error_code || params.error || ''
  const errorDescription = params.error_description || ''
  const hasError = Boolean(errorCode || errorDescription)
  const hasCode = Boolean(params.code)
  const hasAccessToken = Boolean(params.access_token)

  return {
    kind: hasError ? 'error' : hasCode || hasAccessToken ? 'token' : 'none',
    hasError,
    errorCode,
    errorDescription,
    errorMessage: hasError ? describeAuthLinkError(errorCode, errorDescription) : null,
    hasCode,
    hasAccessToken,
    linkType: params.type || '',
  }
}
