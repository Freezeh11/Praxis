/**
 * AuthProvider — subscribes to Supabase auth once and publishes
 * `{ data: { user, session } | null, isPending, error }` through AuthContext.
 *
 * Mounted once, above the router (see App.jsx). Everything else reads the session
 * with `useSession()`; nothing else talks to supabase.auth.
 */
import { useEffect, useState } from 'react'

import SessionExpiryDialog from '../components/auth/SessionExpiryDialog.jsx'
import useSessionLimit from '../hooks/useSessionLimit.js'
import { supabase } from '../services/supabaseClient.js'
import { AuthContext } from './authContext.js'

export function AuthProvider({ children }) {
  const [data, setData] = useState(null)
  const [isPending, setIsPending] = useState(true)
  const [error, setError] = useState(null)

  // The idle + absolute session clocks live beside the auth state they end: one
  // owner mounted above the router, so every route obeys them and the warning can
  // be rendered from here without any page having to know about session limits.
  const { warningOpen, secondsLeft, canExtend, staySignedIn, signOutNow } = useSessionLimit({
    userId: data?.user?.id ?? null,
  })

  useEffect(() => {
    let mounted = true

    async function getInitialSession() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (mounted) {
          if (error) throw error
          setData(session ? { user: session.user, session } : null)
        }
      } catch (err) {
        if (mounted) setError(err)
      } finally {
        if (mounted) setIsPending(false)
      }
    }

    getInitialSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setData(session ? { user: session.user, session } : null)
        setIsPending(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  return (
    <AuthContext.Provider value={{ data, isPending, error }}>
      {children}
      <SessionExpiryDialog
        open={warningOpen}
        secondsLeft={secondsLeft}
        canExtend={canExtend}
        onStay={staySignedIn}
        onSignOut={signOutNow}
      />
    </AuthContext.Provider>
  )
}
