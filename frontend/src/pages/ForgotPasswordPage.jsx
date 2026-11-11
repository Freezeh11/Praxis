import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { toast } from 'sonner'
import AuthCard from '../components/ui/AuthCard.jsx'
import AuthTextField from '../components/ui/AuthTextField.jsx'
import SubmitButton from '../components/ui/SubmitButton.jsx'
import ThemeToggle from '../components/ui/ThemeToggle.jsx'
import { requestPasswordReset } from '../services/authActions.js'

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

export default function ForgotPasswordPage() {
  const reduceMotion = useReducedMotion()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sentTo, setSentTo] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    try {
      const result = await requestPasswordReset(email)
      if (result.error) {
        toast.error(result.error.message || 'Could not send the reset email. Try again.')
      } else {
        setSentTo(email.trim())
        toast.success('Reset link sent. Check your inbox.')
      }
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell>
      <motion.div initial="hidden" animate="show" variants={cardVariants(reduceMotion)}>
        {sentTo ? (
          <AuthCard
            eyebrow="Check your inbox"
            title="Reset link sent"
            subtitle={`If an account exists for ${sentTo}, a link to choose a new password is on its way. It expires in about an hour.`}
            footer={
              <div className="mt-6 border-t border-slate-200/90 pt-5 dark:border-white/10">
                <button type="button" onClick={() => setSentTo('')} className={secondaryActionClassName}>
                  Use a different email
                </button>
                <p className="mt-4 text-center text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                  Nothing arrived? Check spam, or{' '}
                  <button type="button" onClick={handleSubmit} disabled={loading} className={inlineLinkClassName}>
                    send it again
                  </button>
                  .
                </p>
              </div>
            }
          >
            <p className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
              The link opens Praxis in this browser, so finish resetting there. If it has expired, request a fresh one.
            </p>
          </AuthCard>
        ) : (
          <AuthCard
            eyebrow="Account recovery"
            title="Reset your password"
            subtitle="Enter the email on your account and we'll send you a link to choose a new password."
            footer={
              <div className="mt-6 border-t border-slate-200/90 pt-5 dark:border-white/10">
                <Link to="/login" className={secondaryActionClassName}>
                  Back to Sign In
                </Link>
                <p className="mt-4 text-center text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                  No account yet?{' '}
                  <Link to="/register" className={inlineLinkClassName}>
                    Create one
                  </Link>
                  .
                </p>
              </div>
            }
          >
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <AuthTextField
                id="forgot-email"
                label="Email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                icon="mail"
              />
              <SubmitButton loading={loading} busyLabel="Sending link...">
                Send Reset Link
              </SubmitButton>
            </form>
          </AuthCard>
        )}
      </motion.div>
    </AuthShell>
  )
}
