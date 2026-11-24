import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { m, useReducedMotion } from 'framer-motion'
import AuthCard from '../components/ui/AuthCard.jsx'
import ThemeToggle from '../components/ui/ThemeToggle.jsx'
import ResendVerificationForm from '../components/auth/ResendVerificationForm.jsx'
import { classifyAuthLink } from '../services/emailConfirmation.js'
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

/** Footer shared by the two states that ask for a new link. */
function SignInFooter() {
  return (
    <div className="mt-6 border-t border-slate-200/90 pt-5 dark:border-white/10">
      <Link to="/login" className={secondaryActionClassName}>
        Back to Sign In
      </Link>
      <p className="mt-4 text-center text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
        Already confirmed?{' '}
        <Link to="/login" className={inlineLinkClassName}>
          Sign in
        </Link>{' '}
        with your password.
      </p>
    </div>
  )
}

/**
 * Landing page for Supabase's signup confirmation link.
 *
 * Supabase redirects here with one of three shapes: an implicit
 * `#access_token=…` hash, a PKCE `?code=…` query (both exchanged by supabase-js
 * into a session automatically), or an `error_code`/`error_description` pair for
 * an expired or already-used link. The page therefore has four states: reading the
 * link, confirmed (session present), rejected (error parameters), and "nothing to
 * confirm" (no session and no parameters) — the last is recoverable with a resend
 * rather than a dead end.
 */
export default function ConfirmEmailPage() {
  const reduceMotion = useReducedMotion()
  const { isPending, data } = useSession()
  const hasSession = Boolean(data?.session)

  // Read once during the first render, before supabase-js's effects get a chance
  // to consume and rewrite the callback parameters.
  const link = useMemo(() => classifyAuthLink(window.location.href), [])

  const failed = link.hasError
  const confirmed = hasSession && !failed
  const checking = !failed && !confirmed && isPending
  const recoverable = !failed && !confirmed && !checking

  // The tokens have been consumed: drop them from the address bar so a refresh
  // cannot replay a dead link and the URL never lingers in history.
  useEffect(() => {
    if (!hasSession) return
    const url = new URL(window.location.href)
    let changed = false
    for (const key of ['code', 'access_token', 'refresh_token', 'token_hash', 'type']) {
      if (url.searchParams.has(key)) {
        url.searchParams.delete(key)
        changed = true
      }
    }
    if (url.hash) {
      url.hash = ''
      changed = true
    }
    if (changed) window.history.replaceState(null, '', url.pathname + url.search)
  }, [hasSession])

  // Move focus to whatever the learner can act on, so the outcome is not only
  // announced (see the live region) but immediately reachable from the keyboard.
  useEffect(() => {
    if (confirmed) document.getElementById('confirm-continue')?.focus()
  }, [confirmed])

  useEffect(() => {
    if (failed || recoverable) document.getElementById('confirm-resend-email')?.focus()
  }, [failed, recoverable])

  const liveMessage = confirmed
    ? 'Email confirmed. You can continue to Levels.'
    : failed
      ? 'We could not confirm that email link.'
      : checking
        ? 'Checking your confirmation link.'
        : 'This page has no active confirmation link.'

  return (
    <AuthShell>
      <p className="sr-only" role="status" aria-live="polite">
        {liveMessage}
      </p>
      <m.div initial="hidden" animate="show" variants={cardVariants(reduceMotion)}>
        {confirmed ? (
          <AuthCard
            eyebrow="Email confirmed"
            title="Your email is confirmed"
            subtitle="That link was valid. Your Praxis account is active and ready."
            footer={
              <div className="mt-6 border-t border-slate-200/90 pt-5 dark:border-white/10">
                <p className="text-center text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                  You are signed in on this device. Prefer the home page?{' '}
                  <Link to="/" className={inlineLinkClassName}>
                    Go home
                  </Link>
                  .
                </p>
              </div>
            }
          >
            <div className="flex flex-col gap-4">
              <p className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
                {data?.user?.email
                  ? `${data.user.email} is verified. Pick up at your levels whenever you're ready.`
                  : 'Your address is verified. Pick up at your levels whenever you are ready.'}
              </p>
              <Link id="confirm-continue" to="/levels" className={secondaryActionClassName}>
                Continue to Levels
              </Link>
            </div>
          </AuthCard>
        ) : failed ? (
          <AuthCard
            eyebrow="Link problem"
            title="We couldn't confirm that link"
            subtitle={link.errorMessage}
            footer={<SignInFooter />}
          >
            <div className="flex flex-col gap-4">
              <p className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
                Confirmation links work once and expire after about an hour. Request a fresh one and open it on this
                device; if it still fails, check that the address below is the one you signed up with.
              </p>
              <ResendVerificationForm idPrefix="confirm-resend" />
            </div>
          </AuthCard>
        ) : checking ? (
          <AuthCard
            eyebrow="One moment"
            title="Confirming your email"
            subtitle="We're checking the link and signing you in."
          >
            <div className="flex items-center gap-3 text-[13px] text-slate-600 dark:text-slate-300">
              <span
                aria-hidden="true"
                className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600 motion-reduce:animate-none dark:border-slate-700 dark:border-t-cyan-400"
              />
              Verifying…
            </div>
          </AuthCard>
        ) : (
          <AuthCard
            eyebrow="One more step"
            title="Open the link from your email"
            subtitle="This page confirms your address, but it has no active confirmation link right now."
            footer={<SignInFooter />}
          >
            <div className="flex flex-col gap-4">
              <p className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
                Open the newest confirmation email on this device and click its link, or send yourself a fresh one.
                Links opened on a different device cannot finish the sign-in here.
              </p>
              <ResendVerificationForm idPrefix="confirm-resend" />
            </div>
          </AuthCard>
        )}
      </m.div>
    </AuthShell>
  )
}
