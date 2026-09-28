/**
 * The auth context object.
 *
 * Kept in its own module (no component, no hook) so that AuthProvider.jsx exports
 * only a component and useSession.js exports only a hook — React Fast Refresh
 * stops working when one file mixes them.
 */
import { createContext } from 'react'

export const AuthContext = createContext({
  data: null,
  isPending: true,
  error: null,
})
