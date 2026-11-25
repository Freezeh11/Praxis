/**
 * AuthProvider — subscribes to Supabase auth once and publishes
 * `{ data: { user, session } | null, isPending, error }` through AuthContext.
 *
 * Mounted once, above the router (see App.jsx). Everything else reads the session
 * with `useSession()`; nothing else talks to supabase.auth.
 *
 * Both the expiry dialog and the Supabase SDK are loaded on demand: the warning
 * only exists in the final minute of a session, and the SDK (`~51 kB gzip`) is
 * not needed to paint a signed-out landing page. Anonymous visits therefore
 * resolve immediately and warm the SDK during the first idle window; a visit that
 * carries a stored token or an OAuth/PKCE callback parameter connects up front.
 */
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'

import useSessionLimit from '../hooks/useSessionLimit.js'
import { getSupabase } from '../services/supabaseClient.js'
import { AuthContext } from './authContext.js'
import { AUTH_CHANGE_EVENT } from './authEvents.js'

const SessionExpiryDialog = lazy(() => import('../components/auth/SessionExpiryDialog.jsx'))

/** Supabase stores its session under `sb-<project-ref>-auth-token` (optionally chunked). */
const STORED_SESSION_KEY = /^sb-.*-auth-token(\.\d+)?$/
/** Implicit (`#access_token=`) and PKCE (`?code=`) callbacks both need the SDK now. */
const CALLBACK_PARAM = /(?:^|#|&|\?)(?:access_token|refresh_token|code)=/


function hasStoredAuth() {
  try {
    if (Object.keys(window.localStorage).some((key) => STORED_SESSION_KEY.test(key))) return true
  } catch {
    // Storage can be unavailable (private mode, disabled cookies); connect eagerly.
    return true
  }
  return CALLBACK_PARAM.test(window.location.search + window.location.hash)
}

export function AuthProvider({ children }) {
  const [data, setData] = useState(null)
  const needsRestore = hasStoredAuth()
  const [isPending, setIsPending] = useState(needsRestore)
  const [error, setError] = useState(null)

  // The idle + absolute session clocks live beside the auth state they end: one
  // owner mounted above the router, so every route obeys them and the warning can
  // be rendered from here without any page having to know about session limits.
  const { warningOpen, secondsLeft, canExtend, staySignedIn, signOutNow } = useSessionLimit({
    userId: data?.user?.id ?? null,
  })

  useEffect(() => {
    let mounted = true
    let connecting = false
    let subscription = null
    let cancelIdle = null

    function applySession(session) {
      setData(session ? { user: session.user, session } : null)
      setIsPending(false)
    }

    async function connect() {
      if (connecting) return
      connecting = true
      cancelIdle?.()
      cancelIdle = null
      try {
        const supabase = await getSupabase()
        if (!mounted) return

        const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange((_event, session) => {
          if (mounted) applySession(session)
        })
        subscription = authSubscription

        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        if (!mounted) return
        if (sessionError) throw sessionError
        applySession(session)
      } catch (err) {
        if (!mounted) return
        setError(err)
        setIsPending(false)
      }
    }

    if (needsRestore) {
      connect()
    } else {
      // Nothing to restore: the initial state already says "signed out", so no
      // setState is needed here. The first interaction — or a sign-in
      // completing in another module — connects, so a bouncing visitor never
      // pays for 51 kB of auth client.
      window.addEventListener(AUTH_CHANGE_EVENT, connect)
      window.addEventListener('pointerdown', connect, { once: true, passive: true })
      window.addEventListener('keydown', connect, { once: true })
      cancelIdle = () => {
        window.removeEventListener(AUTH_CHANGE_EVENT, connect)
        window.removeEventListener('pointerdown', connect)
        window.removeEventListener('keydown', connect)
      }
    }

    return () => {
      mounted = false
      subscription?.unsubscribe()
      cancelIdle?.()
    }
  }, [needsRestore])

  // A single stable context value: consumers must not re-render because the
  // provider happened to run again.
  const value = useMemo(() => ({ data, isPending, error }), [data, isPending, error])

  return (
    <AuthContext.Provider value={value}>
      {children}
      {warningOpen ? (
        <Suspense fallback={null}>
          <SessionExpiryDialog
            open
            secondsLeft={secondsLeft}
            canExtend={canExtend}
            onStay={staySignedIn}
            onSignOut={signOutNow}
          />
        </Suspense>
      ) : null}
    </AuthContext.Provider>
  )
}
