/**
 * AuthProvider — subscribes to Supabase auth once and publishes
 * `{ data: { user, session } | null, isPending, error }` through AuthContext.
 *
 * Mounted once, above the router (see App.jsx). Everything else reads the session
 * with `useSession()`; nothing else talks to supabase.auth.
 */
import { useEffect, useState } from 'react'

import { supabase } from '../services/supabaseClient.js'
import { AuthContext } from './authContext.js'

export function AuthProvider({ children }) {
  const [data, setData] = useState(null)
  const [isPending, setIsPending] = useState(true)
  const [error, setError] = useState(null)

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
    </AuthContext.Provider>
  )
}
