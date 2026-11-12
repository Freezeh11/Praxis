import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { signUp } from '../services/authActions.js'
import { passwordError } from '../services/passwordPolicy.js'
import { useSession } from '../state/useSession.js'
import { m, useReducedMotion } from 'framer-motion'
import { toast } from 'sonner'
import AuthCard from '../components/ui/AuthCard.jsx'
import ThemeToggle from '../components/ui/ThemeToggle.jsx'
import TermsDialog, { TERMS_LINK_CLASS } from '../components/ui/TermsDialog.jsx'
import AuthTextField from '../components/ui/AuthTextField.jsx'
import PasswordField from '../components/ui/PasswordField.jsx'
import SubmitButton from '../components/ui/SubmitButton.jsx'
import PasswordChecklist from '../components/ui/PasswordChecklist.jsx'

// Auth pages paint their own faint blueprint grid and never mount
// LogicCircuitBackdrop, so the page root is opaque and blur-free.
const pageClassName =
  'relative flex min-h-screen min-h-[100dvh] w-full flex-col overflow-x-hidden bg-slate-50 text-slate-900 bg-[linear-gradient(rgba(15,23,42,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.04)_1px,transparent_1px)] bg-[size:32px_32px] dark:bg-[#0B0F19] dark:text-slate-100 dark:bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)]'

const backLinkClassName =
  '-ml-2 inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-[13px] font-semibold text-slate-500 transition-colors duration-200 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:text-slate-400 dark:hover:text-slate-100 dark:focus-visible:ring-cyan-400/40'

const secondaryActionClassName =
  'flex min-h-11 w-full items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-center text-[14px] font-semibold text-indigo-700 transition-colors duration-200 hover:bg-indigo-100 dark:border-indigo-400/25 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20'

export default function RegisterPage() {
  const navigate = useNavigate()
  const { data: session } = useSession()
  const reduceMotion = useReducedMotion()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  // The password field only takes the danger border once it has been left, so the
  // checklist can guide an in-progress password instead of flagging every keystroke.
  const [passwordTouched, setPasswordTouched] = useState(false)
  const [termsOpen, setTermsOpen] = useState(false)
  const [errors, setErrors] = useState({})

  // Wait for session state to update before navigating
  useEffect(() => {
    if (session) {
      navigate('/levels', { replace: true })
    }
  }, [session, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Inline validation (the form is noValidate) so Enter-to-submit cannot fall
    // back to browser bubbles that vanish on the next keystroke.
    const next = {}
    if (!name.trim()) next.name = 'Enter your name.'
    if (!email.trim()) next.email = 'Enter your email address.'
    else if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = 'Enter a valid email address.'
    if (passwordError(password)) next.password = passwordError(password)
    if (password !== confirmPassword) next.confirm = 'Passwords do not match.'
    if (Object.keys(next).length > 0) {
      setErrors(next)
      const focusId = { name: 'register-name', email: 'register-email', password: 'register-password', confirm: 'register-confirm' }[Object.keys(next)[0]]
      document.getElementById(focusId)?.focus()
      return
    }
    setErrors({})

    setLoading(true)

    try {
      const result = await signUp.email({
        email,
        password,
        name,
      })

      if (result.error) {
        toast.error(result.error.message || 'Registration failed. Please try again.')
      } else {
        toast.success('Account created successfully! Welcome to Praxis.')
        // useEffect will handle the navigation once the session state updates globally
      }
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const passwordsMatch = confirmPassword.length === 0 || password === confirmPassword
  const passwordInvalid = passwordTouched && password.length > 0 && Boolean(passwordError(password))

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
        <m.div
          initial="hidden"
          animate="show"
          variants={containerVariants}
          className="flex w-full justify-center"
        >
          <div className="w-full max-w-[440px]">
            <AuthCard
              eyebrow="Create account"
              title="Start your Praxis account"
              subtitle="One account unlocks every level, stage and sandbox drill."
              footer={
                <div className="mt-6 border-t border-slate-200/90 pt-5 dark:border-white/10">
                  <Link to="/login" className={secondaryActionClassName}>
                    Sign In Instead
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
              <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
                <AuthTextField
                  id="register-name"
                  label="Full Name"
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }))
                  }}
                  placeholder="John Doe"
                  required
                  autoComplete="name"
                  icon="user"
                  error={errors.name}
                />

                <AuthTextField
                  id="register-email"
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }))
                  }}
                  onBlur={() => {
                    const value = email.trim()
                    if (value && !/^\S+@\S+\.\S+$/.test(value)) {
                      setErrors((prev) => ({ ...prev, email: 'Enter a valid email address.' }))
                    }
                  }}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  icon="mail"
                  error={errors.email}
                />

                <PasswordField
                  id="register-password"
                  label="Password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }))
                  }}
                  placeholder="At least 8 characters"
                  required
                  autoComplete="new-password"
                  onBlur={() => setPasswordTouched(true)}
                  invalid={passwordInvalid || Boolean(errors.password)}
                  error={errors.password}
                  describedBy={errors.password ? undefined : 'register-password-requirements'}
                >
                  <PasswordChecklist id="register-password-requirements" password={password} />
                </PasswordField>

                <PasswordField
                  id="register-confirm"
                  label="Confirm Password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value)
                    if (errors.confirm) setErrors((prev) => ({ ...prev, confirm: undefined }))
                  }}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                  error={errors.confirm || (!passwordsMatch ? 'Passwords do not match.' : '')}
                  hintLive
                />

                {/* Only a pending request disables the button: a disabled button
                    with no explanation is a dead end for keyboard and screen-reader
                    users, so validation reports through the fields instead. */}
                <SubmitButton loading={loading} disabled={loading} busyLabel="Creating account...">
                  Create Account
                </SubmitButton>
              </form>
            </AuthCard>
          </div>
        </m.div>
      </main>

      <TermsDialog open={termsOpen} onClose={() => setTermsOpen(false)} />
    </div>
  )
}
