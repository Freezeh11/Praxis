/**
 * useSessionLimit — owns the session's two clocks, the activity listeners and the
 * sign-out that ends an expired session.
 *
 * Idle expiry is a warning first: the last WARNING_WINDOW_MS are shown as a live
 * countdown, and "stay signed in" writes a fresh activity stamp. The absolute cap
 * has no extension — activity stamps cannot move it.
 *
 * The hook is mounted once, in AuthProvider, so every route obeys it and the
 * dialog can be rendered above the router.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import {
  ABSOLUTE_TIMEOUT_MS,
  ACTIVITY_THROTTLE_MS,
  CHECK_INTERVAL_MS,
  SESSION_EXPIRED_MESSAGE,
  WARNING_TICK_MS,
  WARNING_WINDOW_MS,
  clearSessionRecord,
  readSessionRecord,
  sessionActiveKey,
  sessionDeadlines,
  stampSessionActivity,
  startSessionRecord,
} from '../config/sessionRules.js'
import { signOut } from '../services/authActions.js'

export default function useSessionLimit({ userId }) {
  const [warning, setWarning] = useState(null)
  const [secondsLeft, setSecondsLeft] = useState(0)

  const userIdRef = useRef(userId)
  const activityRef = useRef(0)
  const lastStampRef = useRef(0)
  const expiringRef = useRef(false)
  const previousUserIdRef = useRef(null)

  useEffect(() => {
    userIdRef.current = userId
  }, [userId])

  /** The one sign-out path: expire -> sign out -> clear the clock -> tell the learner. */
  const expire = useCallback(async () => {
    const id = userIdRef.current
    if (!id || expiringRef.current) return
    expiringRef.current = true
    setWarning(null)
    setSecondsLeft(0)

    try {
      // Same helper the profile screen uses, so there is one sign-out implementation.
      await signOut()
    } catch (error) {
      // A failed network sign-out must not leave this tab looking signed in; the
      // local session is dropped either way and ProtectedRoute handles /login.
      void error
    }

    clearSessionRecord(id)
    toast(SESSION_EXPIRED_MESSAGE, { id: 'session-expired' })
  }, [])

  /** Compare both deadlines against the clock; expire, warn, or stay quiet. */
  const evaluate = useCallback(() => {
    const id = userIdRef.current
    if (!id || expiringRef.current) return

    const record = readSessionRecord(id)
    if (record.startedAt === null) return

    const now = Date.now()
    const lastActivityAt = Math.max(record.lastActivityAt ?? record.startedAt, activityRef.current)
    const { deadline, absoluteBound } = sessionDeadlines({
      startedAt: record.startedAt,
      lastActivityAt,
    })
    const remaining = deadline - now

    if (remaining <= 0) {
      void expire()
      return
    }

    if (remaining <= WARNING_WINDOW_MS) {
      // Keep the object identity stable while the deadline is unchanged, so the
      // warning ticker is not torn down and rebuilt every second.
      setWarning((previous) => (
        previous && previous.deadline === deadline && previous.absoluteBound === absoluteBound
          ? previous
          : { deadline, absoluteBound }
      ))
      setSecondsLeft(Math.ceil(remaining / 1000))
      return
    }

    setWarning(null)
    setSecondsLeft(0)
  }, [expire])

  // Boot: adopt the stored record, or create it on a fresh sign-in. A cap that has
  // already passed ends the session before the first protected screen can paint.
  useEffect(() => {
    if (!userId) return undefined

    // Switching accounts without an intermediate signed-out state must not let the
    // previous learner's clock (or a near-expired cap) follow the new one.
    const previousUserId = previousUserIdRef.current
    if (previousUserId && previousUserId !== userId) clearSessionRecord(previousUserId)
    previousUserIdRef.current = userId

    expiringRef.current = false
    const now = Date.now()
    const record = readSessionRecord(userId)

    if (record.startedAt === null) {
      startSessionRecord(userId, now)
      activityRef.current = now
      lastStampRef.current = now
      return undefined
    }

    activityRef.current = Math.max(activityRef.current, record.lastActivityAt ?? record.startedAt)
    lastStampRef.current = now

    if (now >= record.startedAt + ABSOLUTE_TIMEOUT_MS) void expire()

    return undefined
  }, [userId, expire])

  // Every sign-out (manual, expiry, revoked refresh token) starts the next sign-in
  // with a clean clock instead of inheriting the old account's start instant.
  useEffect(() => {
    if (userId) {
      previousUserIdRef.current = userId
      return
    }

    const previous = previousUserIdRef.current
    if (!previous) return

    previousUserIdRef.current = null
    clearSessionRecord(previous)
    setWarning(null)
    setSecondsLeft(0)
  }, [userId])

  // Activity sources. One stamp per ACTIVITY_THROTTLE_MS; the storage event adopts a
  // newer stamp from another tab without ever writing an older one back.
  useEffect(() => {
    if (!userId) return undefined

    const stamp = () => {
      if (expiringRef.current) return
      const now = Date.now()
      if (now - lastStampRef.current < ACTIVITY_THROTTLE_MS) return
      lastStampRef.current = now
      activityRef.current = Math.max(activityRef.current, now)
      stampSessionActivity(userId, now)
    }

    const onVisibilityChange = () => {
      // Returning to the tab counts as activity; staying hidden does not.
      if (document.visibilityState === 'visible') stamp()
    }

    const onStorage = (event) => {
      if (event.key !== sessionActiveKey(userId)) return
      const value = Number(event.newValue)
      if (Number.isFinite(value) && value > 0) {
        activityRef.current = Math.max(activityRef.current, value)
      }
    }

    window.addEventListener('pointerdown', stamp, { passive: true })
    window.addEventListener('keydown', stamp)
    window.addEventListener('wheel', stamp, { passive: true })
    window.addEventListener('touchstart', stamp, { passive: true })
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('storage', onStorage)

    return () => {
      window.removeEventListener('pointerdown', stamp)
      window.removeEventListener('keydown', stamp)
      window.removeEventListener('wheel', stamp)
      window.removeEventListener('touchstart', stamp)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('storage', onStorage)
    }
  }, [userId])

  // One controller: a 1 s tick only while the warning needs a countdown, 15 s
  // otherwise. Re-armed when the warning appears/disappears, cleared on unmount.
  const warningOpen = warning !== null
  useEffect(() => {
    if (!userId) return undefined

    evaluate()
    const interval = window.setInterval(evaluate, warningOpen ? WARNING_TICK_MS : CHECK_INTERVAL_MS)
    return () => window.clearInterval(interval)
  }, [userId, warningOpen, evaluate])

  /** "Stay signed in": extend the idle clock. The absolute cap cannot be extended. */
  const staySignedIn = useCallback(() => {
    const id = userIdRef.current
    if (!id) return

    const record = readSessionRecord(id)
    if (record.startedAt === null) return

    const now = Date.now()
    const { absoluteBound } = sessionDeadlines({
      startedAt: record.startedAt,
      lastActivityAt: Math.max(record.lastActivityAt ?? record.startedAt, activityRef.current),
    })
    if (absoluteBound) return

    lastStampRef.current = now
    activityRef.current = Math.max(activityRef.current, now)
    stampSessionActivity(id, now)
    setWarning(null)
    setSecondsLeft(0)
  }, [])

  /** "Sign out now": the same path as an expiry, deliberately. */
  const signOutNow = useCallback(() => {
    void expire()
  }, [expire])

  return {
    warningOpen,
    secondsLeft,
    canExtend: warning ? !warning.absoluteBound : false,
    staySignedIn,
    signOutNow,
  }
}
