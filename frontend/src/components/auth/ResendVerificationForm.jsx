import { useEffect, useState } from 'react'
import AuthTextField from '../ui/AuthTextField.jsx'
import SubmitButton from '../ui/SubmitButton.jsx'
import { resendVerificationEmail } from '../../services/authActions.js'

/** Seconds the button stays disabled after a successful send. */
const COOLDOWN_SECONDS = 30

// Matches the secondary action treatment used across the auth pages.
const secondaryButtonClassName =
  'flex min-h-11 w-full items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-center text-[14px] font-semibold text-indigo-700 transition-colors duration-200 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-indigo-50 dark:border-indigo-400/25 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20 dark:disabled:hover:bg-indigo-500/10'

const statusClassName = (tone) =>
  `rounded-lg px-3 py-2 text-[12px] leading-relaxed ${tone === 'error'
    ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
    : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'}`

/**
 * "Send it again" form shared by every screen that can hit an unconfirmed address:
 * the register panel, the sign-in unconfirmed notice, and the confirmation landing
 * page. Owns the address it sends to, the in-flight state, and a 30s cooldown so a
 * double click cannot burn Supabase's own resend quota.
 *
 * `lockEmail` hides the address field when the screen already shows it (the register
 * panel, the sign-in notice); the confirmation page leaves it editable so a learner
 * who opened a link on another device can request one here.
 */
export default function ResendVerificationForm({
  idPrefix = 'resend',
  initialEmail = '',
  lockEmail = false,
  variant = 'primary',
  submitLabel = 'Resend confirmation link',
}) {
  const [email, setEmail] = useState(initialEmail)
  const [sending, setSending] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [emailError, setEmailError] = useState('')
  const [status, setStatus] = useState(null)

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const timer = window.setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [cooldown])

  const address = (lockEmail ? initialEmail : email).trim()
  const disabled = sending || cooldown > 0

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (disabled) return
    if (!address) {
      setEmailError('Enter your email address.')
      document.getElementById(`${idPrefix}-email`)?.focus()
      return
    }
    if (!/^\S+@\S+\.\S+$/.test(address)) {
      setEmailError('Enter a valid email address.')
      document.getElementById(`${idPrefix}-email`)?.focus()
      return
    }
    setEmailError('')
    setStatus(null)
    setSending(true)
    try {
      const result = await resendVerificationEmail(address)
      if (result.error) {
        const message = result.error.message || 'Could not send the confirmation email.'
        setStatus({ tone: 'error', text: message })
        // A rate-limit answer already means "wait": mirror it in the UI instead
        // of letting the learner retry immediately.
        if (/too many|rate limit/i.test(message)) setCooldown(COOLDOWN_SECONDS)
      } else {
        setStatus({
          tone: 'success',
          text: `Confirmation link sent to ${address}. Check your inbox and spam folder.`,
        })
        setCooldown(COOLDOWN_SECONDS)
      }
    } catch {
      setStatus({ tone: 'error', text: 'Something went wrong. Please try again.' })
    } finally {
      setSending(false)
    }
  }

  const buttonLabel = cooldown > 0 ? `Resend in ${cooldown}s` : submitLabel

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
      {lockEmail ? null : (
        <AuthTextField
          id={`${idPrefix}-email`}
          label="Email"
          type="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value)
            if (emailError) setEmailError('')
            if (status) setStatus(null)
          }}
          placeholder="you@example.com"
          required
          autoComplete="email"
          icon="mail"
          error={emailError}
        />
      )}

      {variant === 'secondary' ? (
        <button type="submit" disabled={disabled} className={secondaryButtonClassName}>
          {sending ? 'Sending link…' : buttonLabel}
        </button>
      ) : (
        <SubmitButton loading={sending} disabled={disabled} busyLabel="Sending link...">
          {buttonLabel}
        </SubmitButton>
      )}

      {status ? (
        <p
          role={status.tone === 'error' ? 'alert' : 'status'}
          className={statusClassName(status.tone)}
        >
          {status.text}
        </p>
      ) : null}
    </form>
  )
}
