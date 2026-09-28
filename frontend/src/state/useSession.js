/**
 * useSession — reads the session published by AuthProvider.
 * @returns {{ data: { user, session } | null, isPending: boolean, error: unknown }}
 */
import { useContext } from 'react'

import { AuthContext } from './authContext.js'

export const useSession = () => useContext(AuthContext)
