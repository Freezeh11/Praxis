/**
 * Session rules — the two clocks that bound a signed-in session, plus the
 * localStorage record that lets a reload or a second tab continue the same session.
 *
 *   idle      no user activity for IDLE_TIMEOUT_MS                 -> sign out
 *   absolute  ABSOLUTE_TIMEOUT_MS since sign-in, activity ignored  -> sign out
 *
 * The record is keyed per user id, so signing into another account can never
 * inherit the previous account's clock. The keys live here rather than at the call
 * sites for the same reason storageKeys.js exists: a key is only useful when every
 * writer agrees on it.
 */

/** No user activity for this long ends the session. */
export const IDLE_TIMEOUT_MS = 20 * 60 * 1000

/** How long before expiry the warning dialog appears. */
export const WARNING_WINDOW_MS = 60 * 1000

/** Hard cap measured from sign-in. Activity never moves this deadline. */
export const ABSOLUTE_TIMEOUT_MS = 12 * 60 * 60 * 1000

/** At most one activity stamp per tab in this window. */
export const ACTIVITY_THROTTLE_MS = 5 * 1000

/** Controller cadence while no warning is visible. */
export const CHECK_INTERVAL_MS = 15 * 1000

/** Controller cadence while the warning (and its live countdown) is visible. */
export const WARNING_TICK_MS = 1000

/** Toast copy shown once the session has been ended. */
export const SESSION_EXPIRED_MESSAGE = 'Your session expired. Please sign in again.'

/** Storage key: the sign-in instant for a user. */
export const sessionStartedKey = (userId) => `praxis_session_started_${userId}`

/** Storage key: the most recent activity stamp for a user. */
export const sessionActiveKey = (userId) => `praxis_session_active_${userId}`

/** Read a millisecond timestamp; null when absent or unreadable. */
function readTimestamp(key) {
  try {
    const value = Number(window.localStorage.getItem(key))
    return Number.isFinite(value) && value > 0 ? value : null
  } catch {
    // Storage can be unavailable (private mode, blocked cookies).
    return null
  }
}

/** Write a millisecond timestamp; false when storage refused it. */
function writeTimestamp(key, value) {
  try {
    window.localStorage.setItem(key, String(value))
    return true
  } catch {
    // Losing the shared clock must not break sign-in; the in-memory ref still works.
    return false
  }
}

/** The stored clocks for a user. Either half may be null. */
export function readSessionRecord(userId) {
  return {
    startedAt: readTimestamp(sessionStartedKey(userId)),
    lastActivityAt: readTimestamp(sessionActiveKey(userId)),
  }
}

/** Begin a session: this instant is both the sign-in time and the first activity. */
export function startSessionRecord(userId, now) {
  writeTimestamp(sessionStartedKey(userId), now)
  writeTimestamp(sessionActiveKey(userId), now)
}

/**
 * Stamp activity, newest wins. A second tab holding an older stamp must not drag
 * the shared clock backwards, so the write only lands when it moves time forward.
 * @returns the timestamp the shared record ended up holding.
 */
export function stampSessionActivity(userId, now) {
  const stored = readTimestamp(sessionActiveKey(userId))
  if (stored !== null && stored >= now) return stored
  writeTimestamp(sessionActiveKey(userId), now)
  return now
}

/** Forget a user's clocks (sign-out, manual or expiry-driven). */
export function clearSessionRecord(userId) {
  try {
    window.localStorage.removeItem(sessionStartedKey(userId))
    window.localStorage.removeItem(sessionActiveKey(userId))
  } catch {
    // Nothing to clean up when storage is unreachable.
  }
}

/**
 * Both deadlines for a record, plus which one binds.
 * @returns {{ idle: number, absolute: number, deadline: number, absoluteBound: boolean }}
 */
export function sessionDeadlines({ startedAt, lastActivityAt }) {
  const absolute = startedAt + ABSOLUTE_TIMEOUT_MS
  const idle = (lastActivityAt ?? startedAt) + IDLE_TIMEOUT_MS
  return {
    idle,
    absolute,
    deadline: Math.min(absolute, idle),
    // True when the hard cap ends the session before idleness would.
    absoluteBound: absolute <= idle,
  }
}

/** "m:ss" for the countdown; never negative, never "-1:59". */
export function formatCountdown(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
