/**
 * The single HTTP entry point for the FastAPI backend.
 *
 * Every call to /api/* goes through `apiRequest`, so request headers, the auth
 * token, JSON handling and error shape are decided in exactly one place.
 * Components must never call fetch directly — they go through services/*Api.js.
 *
 * The backend answers `{ success, data, error }`; this client unwraps it and
 * returns `data`, throwing an `ApiError` otherwise. The pre-envelope plain-JSON
 * shape is still tolerated so the frontend and backend can be deployed
 * independently during the transition.
 */
import { getSupabase } from './supabaseClient.js'

/** Upper bound for one API round trip, headers and body included. */
const DEFAULT_TIMEOUT_MS = 15000

/** A failed API call. `message` is safe to show; `detail` is for developers. */
export class ApiError extends Error {
  constructor(message, { status = 0, code = 'api_error', detail = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.detail = detail
  }
}

/** Attaches the Supabase access token when the learner is signed in. */
async function authHeaders(baseHeaders = {}) {
  const supabase = await getSupabase()
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token
  return token ? { ...baseHeaders, Authorization: `Bearer ${token}` } : baseHeaders
}

function unwrap(body) {
  // Envelope shape: { success, data, error }
  if (body && typeof body === 'object' && 'success' in body) {
    if (body.success) return body.data
    const error = body.error || {}
    throw new ApiError(error.message || 'Request failed', {
      code: error.code || 'api_error',
      detail: error.detail || null,
    })
  }
  // Legacy plain-JSON shape
  return body
}

/**
 * @param {string} path  API path, e.g. '/api/levels/1'
 * @param {object} [options]
 * @param {'GET'|'POST'|'PUT'|'DELETE'} [options.method]
 * @param {object} [options.body] JSON body
 * @param {boolean} [options.auth] attach the access token (default: true)
 * @param {boolean} [options.silent] return null instead of throwing on failure
 * @returns {Promise<any>} the unwrapped `data`
 */
export async function apiRequest(
  path,
  { method = 'GET', body, auth = true, silent = false, timeoutMs = DEFAULT_TIMEOUT_MS } = {}
) {
  const headers = auth
    ? await authHeaders(body ? { 'Content-Type': 'application/json' } : {})
    : (body ? { 'Content-Type': 'application/json' } : {})

  // A request that never settles used to leave the caller waiting forever — the
  // tutorial gate then showed its spinner for good. The timeout covers the body
  // read as well as the headers, so a stalled stream cannot hang either.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  const abortError = () => new ApiError('The Praxis server took too long to respond.', {
    code: 'timeout',
  })

  try {
    let response
    try {
      response = await fetch(path, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })
    } catch (networkError) {
      if (silent) return null
      if (networkError?.name === 'AbortError') throw abortError()
      throw new ApiError('Could not reach the Praxis server.', {
        code: 'network_error',
        detail: networkError?.message || String(networkError),
      })
    }

    if (!response.ok) {
      if (silent) return null
      let detail = null
      try {
        detail = await response.json()
      } catch {
        // A failed request whose body is not JSON — status code is all we have.
      }
      throw new ApiError(detail?.error?.message || detail?.detail || `Request failed (${response.status})`, {
        status: response.status,
        code: detail?.error?.code || `http_${response.status}`,
        detail,
      })
    }

    if (response.status === 204) return null
    try {
      return unwrap(await response.json())
    } catch (parseError) {
      if (parseError instanceof ApiError) {
        if (silent) return null
        throw parseError
      }
      if (silent) return null
      if (parseError?.name === 'AbortError') throw abortError()
      throw new ApiError('The server returned an unreadable response.', {
        status: response.status,
        code: 'invalid_response',
        detail: parseError?.message || String(parseError),
      })
    }
  } finally {
    clearTimeout(timer)
  }
}
