import { Navigate } from 'react-router-dom'
import { useSession } from '../lib/auth-client'

export default function ProtectedRoute({ children }) {
  const { data: session, isPending } = useSession()

  // Loading state — show a minimal spinner
  if (isPending) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-6 w-6 text-accent" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm text-text-3 font-medium">Loading...</span>
        </div>
      </div>
    )
  }

  // Not authenticated — redirect to login
  if (!session) {
    return <Navigate to="/login" replace />
  }

  // Authenticated — render children
  return children
}
