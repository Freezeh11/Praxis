import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { m, useReducedMotion } from 'framer-motion'
import { toast } from 'sonner'
import AuthCard from '../components/ui/AuthCard.jsx'
import PasswordField from '../components/ui/PasswordField.jsx'
import PasswordChecklist from '../components/ui/PasswordChecklist.jsx'
import SubmitButton from '../components/ui/SubmitButton.jsx'
import ThemeToggle from '../components/ui/ThemeToggle.jsx'
import { passwordError } from '../services/passwordPolicy.js'
import { resetPassword } from '../services/authActions.js'
import { useSession } from '../state/useSession.js'

// Auth pages paint their own faint blueprint grid and never mount
// LogicCircuitBackdrop, so the page root is opaque and blur-free.
const pageClassName =
  'relative flex min-h-screen min-h-[100dvh] w-full flex-col overflow-x-hidden bg-slate-50 text-slate-900 bg-[linear-gradient(rgba(15,23,42,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.04)_1px,transparent_1px)] bg-[size:32px_32px] dark:bg-[#0B0F19] dark:text-slate-100 dark:bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)]'

const backLinkClassName =
  '-ml-2 inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-[13px] font-semibold text-slate-500 transition-colors duration-200 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:text-slate-400 dark:hover:text-slate-100 dark:focus-visible:ring-cyan-400/40'

const secondaryActionClassName =
  'flex min-h-11 w-full items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-center text-[14px] font-semibold text-indigo-700 transition-colors duration-200 hover:bg-indigo-100 dark:border-indigo-400/25 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20'

const inlineLinkClassName =
  'rounded-md font-semibold text-indigo-600 transition-colors duration-200 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:text-cyan-400 dark:hover:text-cyan-300 dark:focus-visible:ring-cyan-400/40'

function AuthShell({ children }) {
  return (
    <div className={pageClassName + ' praxis-page-x'}>
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 py-3 sm:py-4">
        <Link to="/login" className={backLinkClassName}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
            className="h-3.5 w-3.5"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back to sign in
        </Link>
        <ThemeToggle />
      </header>
      <main className="mx-auto flex w-full flex-1 items-center justify-center py-6 sm:py-10">
        <div className="w-full max-w-[440px]">{children}</div>
      </main>
    </div>
  )
}

const cardVariants = reduceMotion => ({
  hidden: { opacity: 0, y: reduceMotion ? 0 : 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
})

/**
 * Landing page for Supabase's recovery link.
 *
 * The link signs the visitor in with a short-lived recovery session, so the page
 * has three states: waiting for the session to resolve, no session (link invalid
 * or expired), and session present (choose a new password). Submitting signs that
 * recovery session out on purpose — the new password is what gets used next.
 */
export default function ResetPasswordPage() {
  const reduceMotion = useReducedMotion()
  const { isPending, data } = useSession()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [finished, setFinished] = useState(false)

  const hasSession = Boolean(data?.session)

  // Once the tokens have been consumed, drop them from the address bar so the
  // recovery URL never lingers in history or in a shared screenshot.
  useEffect(() => {
    if (hasSession && window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }
  }, [hasSession])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (passwordError(password)) {
      toast.error(passwordError(password))
      return
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      const result = await resetPassword(password)
      if (result.error) {
        toast.error(result.error.message || 'Could not update your password. Request a new link.')
      } else {
        setFinished(true)
        toast.success('Password updated. Sign in with your new password.')
      }
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const passwordsMatch = confirmPassword.length === 0 || password === confirmPassword

  return (
    <AuthShell>
      <m.div initial="hidden" animate="show" variants={cardVariants(reduceMotion)}>
        {finished ? (
          <AuthCard
            eyebrow="All set"
            title="Password updated"
            subtitle="Your new password is active. Sign in to pick up where you left off."
          >
            <Link to="/login" className={secondaryActionClassName}>
              Go to Sign In
            </Link>
          </AuthCard>
        ) : isPending && !hasSession ? (
          <AuthCard
            eyebrow="Account recovery"
            title="Checking your link"
            subtitle="One moment while we verify the reset link."
          >
            <div className="flex items-center gap-3 text-[13px] text-slate-600 dark:text-slate-300">
              <span
                aria-hidden="true"
                className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600 dark:border-slate-700 dark:border-t-cyan-400"
              />
              Verifying…
            </div>
          </AuthCard>
        ) : !hasSession ? (
          <AuthCard
            eyebrow="Link expired"
            title="This reset link is no longer valid"
            subtitle="Reset links work once and expire after about an hour. Request a fresh one and it will open here."
            footer={
              <div className="mt-6 border-t border-slate-200/90 pt-5 dark:border-white/10">
                <Link to="/forgot-password" className={secondaryActionClassName}>
                  Request a New Link
                </Link>
                <p className="mt-4 text-center text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                  Already know your password?{' '}
                  <Link to="/login" className={inlineLinkClassName}>
                    Sign in
                  </Link>
                  .
                </p>
              </div>
            }
          >
            <p className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
              Open the most recent reset email on this device. The link signs this browser in for the change.
            </p>
          </AuthCard>
        ) : (
          <AuthCard
            eyebrow="New password"
            title="Choose a new password"
            subtitle="Your reset link is valid. Set a password you haven't used here before."
            footer={
              <div className="mt-6 border-t border-slate-200/90 pt-5 dark:border-white/10">
                <Link to="/login" className={secondaryActionClassName}>
                  Back to Sign In
                </Link>
              </div>
            }
          >
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <PasswordField
                id="reset-password"
                label="New password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                required
                autoComplete="new-password"
                describedBy="reset-password-requirements"
              >
                <PasswordChecklist id="reset-password-requirements" password={password} />
              </PasswordField>

              <PasswordField
                id="reset-password-confirm"
                label="Confirm new password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="••••••••"
                required
                autoComplete="new-password"
                error={!passwordsMatch ? 'Passwords do not match.' : ''}
                hintLive
              />

              <SubmitButton
                loading={loading}
                disabled={!passwordsMatch || Boolean(passwordError(password))}
                busyLabel="Updating password..."
              >
                Update Password
              </SubmitButton>
            </form>
          </AuthCard>
        )}
      </m.div>
    </AuthShell>
  )
}
