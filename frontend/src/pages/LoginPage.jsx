import { useState, useEffect } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { signIn } from '../services/authActions.js'
import { useSession } from '../state/useSession.js'
import { motion, useReducedMotion } from 'framer-motion'
import { toast } from 'sonner'
import AuthCard from '../components/ui/AuthCard.jsx'
import ThemeToggle from '../components/ui/ThemeToggle.jsx'
import TermsDialog, { TERMS_LINK_CLASS } from '../components/ui/TermsDialog.jsx'
import AuthTextField from '../components/ui/AuthTextField.jsx'
import PasswordField from '../components/ui/PasswordField.jsx'
import SubmitButton from '../components/ui/SubmitButton.jsx'

// Auth pages paint their own faint blueprint grid and never mount
// LogicCircuitBackdrop, so the page root is opaque and blur-free.
const pageClassName =
  'relative flex min-h-screen min-h-[100dvh] w-full flex-col overflow-x-hidden bg-slate-50 text-slate-900 bg-[linear-gradient(rgba(15,23,42,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.04)_1px,transparent_1px)] bg-[size:32px_32px] dark:bg-[#0B0F19] dark:text-slate-100 dark:bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)]'

const backLinkClassName =
  '-ml-2 inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-[13px] font-semibold text-slate-500 transition-colors duration-200 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:text-slate-400 dark:hover:text-slate-100 dark:focus-visible:ring-cyan-400/40'

const secondaryActionClassName =
  'flex min-h-11 w-full items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-center text-[14px] font-semibold text-indigo-700 transition-colors duration-200 hover:bg-indigo-100 dark:border-indigo-400/25 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { data: session } = useSession()
  // Only same-origin paths are honoured; anything else falls back to the home page.
  const requested = location.state?.from
  const redirectTo = typeof requested === 'string' && requested.startsWith('/') && !requested.startsWith('//') ? requested : '/'
  const reduceMotion = useReducedMotion()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [termsOpen, setTermsOpen] = useState(false)

  // Wait for session state to update before navigating
  useEffect(() => {
    if (session) {
      navigate(redirectTo, { replace: true })
    }
  }, [session, navigate, redirectTo])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const result = await signIn.email({
        email,
        password,
      })

      if (result.error) {
        toast.error(result.error.message || 'Invalid email or password')
      } else {
        toast.success('Welcome back!')
        // useEffect will handle the navigation once the session state updates globally
      }
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Transform/opacity only, and no movement at all under prefers-reduced-motion.
  const containerVariants = {
    hidden: { opacity: 0, y: reduceMotion ? 0 : 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
  }

  return (
    <div className={pageClassName + ' praxis-page-x'}>
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 py-3 sm:py-4">
        <Link to="/" className={backLinkClassName}>
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
          Back to home
        </Link>
        <ThemeToggle />
      </header>

      <main className="mx-auto flex w-full flex-1 items-center justify-center py-6 sm:py-10">
        <motion.div
          initial="hidden"
          animate="show"
          variants={containerVariants}
          className="flex w-full justify-center"
        >
          <div className="w-full max-w-[440px]">
            <AuthCard
              eyebrow="Welcome back"
              title="Sign in to Praxis"
              subtitle="Sign in to keep your progress, levels and streaks."
              footer={
                <div className="mt-6 border-t border-slate-200/90 pt-5 dark:border-white/10">
                  <Link to="/register" className={secondaryActionClassName}>
                    Create an Account
                  </Link>
                  <p className="mt-4 text-center text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                    By continuing you agree to the{' '}
                    <button
                      type="button"
                      onClick={() => setTermsOpen(true)}
                      aria-haspopup="dialog"
                      className={TERMS_LINK_CLASS}
                    >
                      Terms and Conditions
                    </button>
                    .
                  </p>
                </div>
              }
            >
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <AuthTextField
                  id="login-email"
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  icon="mail"
                />

                <PasswordField
                  id="login-password"
                  label="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />

                <div className="-mt-1 flex justify-end">
                  <Link
                    to="/forgot-password"
                    className="rounded-md px-1 py-0.5 text-[13px] font-semibold text-indigo-600 transition-colors duration-200 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:text-cyan-400 dark:hover:text-cyan-300 dark:focus-visible:ring-cyan-400/40"
                  >
                    Forgot password?
                  </Link>
                </div>

                <SubmitButton loading={loading} busyLabel="Signing in...">
                  Sign In
                </SubmitButton>
              </form>
            </AuthCard>
          </div>
        </motion.div>
      </main>

      <TermsDialog open={termsOpen} onClose={() => setTermsOpen(false)} />
    </div>
  )
}
