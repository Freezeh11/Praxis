import { useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import Icon from '../components/ui/Icon.jsx'
import ThemeToggle from '../components/ui/ThemeToggle.jsx'
import { CONTACT_EMAIL } from '../config/appLinks.js'
import { describeLocation } from '../services/feedbackContext.js'
import {
  FEEDBACK_CATEGORIES,
  MAX_MESSAGE,
  MIN_MESSAGE,
  sendFeedback,
} from '../services/feedbackApi.js'
import { useSession } from '../state/useSession.js'

/** Local copy of the backend rule, so a typo is caught before a round trip. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Shown for every infrastructure failure (offline, timeout, storage down). The server's
 * own text names internals the learner cannot act on, and a storage outage is not the
 * reporter's fault, so the copy stays calm and says the text is still on screen.
 */
const TRANSPORT_FAILURE =
  'We could not deliver that just now. Please try again in a moment - your message is still here.'

// The contact page paints its own faint blueprint grid, like the auth pages, so
// the page root is opaque and needs no backdrop layer.
const pageClassName =
  'relative flex min-h-screen min-h-[100dvh] w-full flex-col overflow-x-hidden bg-slate-50 text-slate-900 bg-[linear-gradient(rgba(15,23,42,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.04)_1px,transparent_1px)] bg-[size:32px_32px] dark:bg-[#0B0F19] dark:text-slate-100 dark:bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)]'

const backLinkClassName =
  '-ml-2 inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-[13px] font-semibold text-slate-500 transition-colors duration-200 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:text-slate-400 dark:hover:text-slate-100 dark:focus-visible:ring-cyan-400/40'

const cardClassName =
  'w-full rounded-2xl border border-slate-200 bg-white/95 p-5 shadow-sm sm:p-6 dark:border-white/10 dark:bg-slate-900/70'

const labelClassName = 'block text-[13px] font-bold text-slate-900 dark:text-white'

const hintClassName = 'mt-1 text-[12px] leading-relaxed text-slate-500 dark:text-slate-400'

const fieldBaseClassName =
  'mt-1.5 w-full rounded-xl border bg-white px-3 py-2.5 text-[14px] text-slate-900 transition-colors duration-200 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:bg-slate-950/60 dark:text-white dark:placeholder:text-slate-500 dark:focus-visible:ring-cyan-400/40'

const primaryButtonClassName =
  'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-[14px] font-bold text-white transition-colors duration-200 hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400 dark:focus-visible:ring-cyan-400 dark:focus-visible:ring-offset-slate-900'

const secondaryButtonClassName =
  'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-[14px] font-bold text-slate-700 transition-colors duration-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:border-white/15 dark:bg-transparent dark:text-slate-200 dark:hover:bg-white/5 dark:focus-visible:ring-cyan-400/40'

const cx = (...parts) => parts.filter(Boolean).join(' ')

/** Page chrome shared by the form and the confirmation state. */
function Shell({ backTo, backLabel, children }) {
  return (
    <div className={pageClassName + ' praxis-page-x'}>
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 py-3 sm:py-4">
        <Link to={backTo} className={backLinkClassName}>
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
          {backLabel}
        </Link>
        <ThemeToggle />
      </header>
      <main className="mx-auto flex w-full flex-1 items-center justify-center py-6 sm:py-10">
        <div className="w-full max-w-[520px]">{children}</div>
      </main>
    </div>
  )
}

/**
 * Contact & feedback - the one place a learner can reach the maintainer.
 *
 * Public on purpose: someone locked out of their account is exactly who needs
 * to write in, so the page never sits behind ProtectedRoute. A signed-in
 * learner's address comes from the session (the backend stamps it) and the
 * typed field disappears; a signed-out reporter must type one, because a report
 * nobody can answer only makes the learner feel heard when they were not.
 */
export default function ContactPage() {
  const location = useLocation()
  const { data } = useSession()
  const accountEmail = data?.user?.email || ''
  const signedIn = Boolean(accountEmail)

  const [category, setCategory] = useState('bug')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle')
  const [transportError, setTransportError] = useState('')
  const [messageError, setMessageError] = useState('')
  const [emailError, setEmailError] = useState('')

  const messageRef = useRef(null)
  const emailRef = useRef(null)

  const diagnostics = useMemo(() => describeLocation(location.pathname), [location.pathname])

  const sending = status === 'sending'

  function resetForm() {
    setStatus('idle')
    setMessage('')
    setMessageError('')
    setEmailError('')
    setTransportError('')
  }

  function validate() {
    const trimmed = message.trim()
    let nextMessageError = ''
    if (trimmed.length < MIN_MESSAGE) {
      nextMessageError = 'Please write at least ' + MIN_MESSAGE + ' characters so we know what happened.'
    } else if (trimmed.length > MAX_MESSAGE) {
      nextMessageError = 'Please keep it under ' + MAX_MESSAGE + ' characters.'
    }
    const nextEmailError = !signedIn && !EMAIL_SHAPE.test(email.trim())
      ? 'Enter an email address so we can reply.'
      : ''

    setMessageError(nextMessageError)
    setEmailError(nextEmailError)

    if (nextMessageError) {
      messageRef.current?.focus()
      return false
    }
    if (nextEmailError) {
      emailRef.current?.focus()
      return false
    }
    return true
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (sending) return
    setTransportError('')
    if (!validate()) return

    setStatus('sending')
    try {
      await sendFeedback({
        category,
        message: message.trim(),
        email: signedIn ? '' : email,
        pathname: location.pathname,
      })
      setStatus('sent')
    } catch (error) {
      setStatus('idle')
      // Only a server-side validation refusal is actionable for the reporter, so only
      // that one is quoted; network, timeout and storage failures get the plain copy.
      const code = error?.code || ''
      const actionable = code === 'validation_error' || code === 'http_422'
      setTransportError(actionable && error?.message ? error.message : TRANSPORT_FAILURE)
    }
  }

  const backTo = signedIn ? '/levels' : '/'
  const backLabel = signedIn ? 'Back to levels' : 'Back to home'

  if (status === 'sent') {
    const replyAddress = signedIn ? accountEmail : email.trim()
    return (
      <Shell backTo={backTo} backLabel={backLabel}>
        <div className={cx(cardClassName, 'text-center')}>
          <span
            aria-hidden="true"
            className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-2xl text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-400"
          >
            <Icon name="check" />
          </span>
          <h1 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">Message sent</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
            Thanks for taking the time. We will reply to{' '}
            <span className="font-semibold break-all text-slate-900 dark:text-white">{replyAddress}</span>
            {diagnostics.context ? ', and the level and stage you came from came with it.' : '.'}
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Link to={backTo} className={primaryButtonClassName}>
              {backLabel}
            </Link>
            <button type="button" onClick={resetForm} className={secondaryButtonClassName}>
              Send another message
            </button>
          </div>
        </div>
      </Shell>
    )
  }

  return (
    <Shell backTo={backTo} backLabel={backLabel}>
      <div className={cardClassName}>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Contact &amp; feedback</h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
          Bugs, confusing puzzles and ideas all land in the same inbox, read by the person who
          builds Praxis.
        </p>

        {CONTACT_EMAIL ? (
          <a
            href={'mailto:' + CONTACT_EMAIL}
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px] font-semibold text-slate-700 transition-colors duration-200 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10 dark:focus-visible:ring-cyan-400/40"
          >
            <Icon name="mail" className="text-base" />
            <span className="break-all">Prefer email? {CONTACT_EMAIL}</span>
          </a>
        ) : null}

        <form noValidate onSubmit={handleSubmit} className="mt-4 space-y-4">
          <fieldset>
            <legend className={labelClassName}>What is this about?</legend>
            <div className="mt-2 space-y-1.5">
              {FEEDBACK_CATEGORIES.map(option => {
                const selected = category === option.id
                return (
                  <label
                    key={option.id}
                    className={cx(
                      'flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors duration-200 focus-within:ring-2 focus-within:ring-indigo-500/40 dark:focus-within:ring-cyan-400/40',
                      selected
                        ? 'border-indigo-400 bg-indigo-50/70 dark:border-cyan-400/45 dark:bg-cyan-400/10'
                        : 'border-slate-200 bg-white hover:border-slate-300 dark:border-white/10 dark:bg-slate-950/40 dark:hover:border-white/20',
                    )}
                  >
                    <input
                      type="radio"
                      name="feedback-category"
                      value={option.id}
                      checked={selected}
                      onChange={() => setCategory(option.id)}
                      className="sr-only"
                    />
                    <span
                      aria-hidden="true"
                      className={cx(
                        'mt-0.5 shrink-0 text-base',
                        selected ? 'text-indigo-600 dark:text-cyan-400' : 'text-slate-400 dark:text-slate-500',
                      )}
                    >
                      <Icon name={option.icon} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-bold text-slate-900 dark:text-white">
                        {option.label}
                      </span>
                      <span className="mt-0.5 block text-[12px] leading-snug text-slate-500 dark:text-slate-400">
                        {option.hint}
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className={cx(
                        'ml-auto mt-1 h-4 w-4 shrink-0 rounded-full border transition-colors duration-200',
                        selected
                          ? 'border-[5px] border-indigo-600 dark:border-cyan-400'
                          : 'border-slate-300 dark:border-white/25',
                      )}
                    />
                  </label>
                )
              })}
            </div>
          </fieldset>

          <div>
            <label htmlFor="feedback-message" className={labelClassName}>
              What happened?
            </label>
            <p id="feedback-message-hint" className={hintClassName}>
              The stage, what you expected, and what happened instead. Screenshots cannot be
              attached yet.
            </p>
            <textarea
              id="feedback-message"
              ref={messageRef}
              value={message}
              onChange={event => setMessage(event.target.value)}
              rows={4}
              maxLength={MAX_MESSAGE}
              aria-invalid={Boolean(messageError)}
              aria-describedby={cx('feedback-message-hint', messageError && 'feedback-message-error')}
              className={cx(
                fieldBaseClassName,
                messageError
                  ? 'border-rose-400 dark:border-rose-400/60'
                  : 'border-slate-300 dark:border-white/15',
              )}
              placeholder="On level 2, stage 3, pressing Validate dropped my expression"
            />
            <div className="mt-1 flex items-center justify-between gap-3">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {message.length} / {MAX_MESSAGE}
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">at least {MIN_MESSAGE} characters</p>
            </div>
            {messageError ? (
              <p
                id="feedback-message-error"
                role="alert"
                className="mt-1 text-[12px] font-semibold text-rose-600 dark:text-rose-400"
              >
                {messageError}
              </p>
            ) : null}
          </div>

          {signedIn ? (
            <div>
              <p className={labelClassName}>Reply to</p>
              <p className="mt-1.5 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] font-semibold text-slate-800 dark:border-white/10 dark:bg-white/5 dark:text-slate-100">
                <Icon name="mail" className="shrink-0 text-base text-slate-400 dark:text-slate-500" />
                <span className="break-all">{accountEmail}</span>
              </p>
              <p className={hintClassName}>We use the email on your account, so there is nothing to type.</p>
            </div>
          ) : (
            <div>
              <label htmlFor="feedback-email" className={labelClassName}>
                Your email
              </label>
              <p id="feedback-email-hint" className={hintClassName}>
                So we can reply. It is only used to answer this message.
              </p>
              <input
                id="feedback-email"
                ref={emailRef}
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                aria-invalid={Boolean(emailError)}
                aria-describedby={cx('feedback-email-hint', emailError && 'feedback-email-error')}
                className={cx(
                  fieldBaseClassName,
                  emailError
                    ? 'border-rose-400 dark:border-rose-400/60'
                    : 'border-slate-300 dark:border-white/15',
                )}
                placeholder="you@example.com"
              />
              {emailError ? (
                <p
                  id="feedback-email-error"
                  role="alert"
                  className="mt-1 text-[12px] font-semibold text-rose-600 dark:text-rose-400"
                >
                  {emailError}
                </p>
              ) : null}
            </div>
          )}

          <p className="rounded-xl bg-slate-50 px-3 py-2 text-[11px] leading-snug text-slate-500 dark:bg-white/5 dark:text-slate-400">
            Attached automatically: the page you came from
            {diagnostics.context ? ' (with its level and stage)' : ''} and the build you are on.
            Never your password, and never your progress.
          </p>

          {transportError ? (
            <p
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[12px] font-semibold text-rose-700 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-300"
            >
              {transportError}
            </p>
          ) : null}

          <button type="submit" disabled={sending} className={primaryButtonClassName}>
            <Icon name="send" className="text-base" />
            {sending ? 'Sending…' : 'Send message'}
          </button>
        </form>
      </div>
    </Shell>
  )
}
