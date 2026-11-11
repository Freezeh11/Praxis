/**
 * SessionExpiryDialog — the warning shown in the last minute of a session.
 *
 * Presentational only: the clock, the countdown and the sign-out live in
 * useSessionLimit. Escape (and the backdrop) mean "stay signed in"; when the
 * absolute cap binds, staying is not offered and the primary button is disabled.
 */
import { useEffect, useRef } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

import { formatCountdown } from '../../config/sessionRules.js'

export default function SessionExpiryDialog({ open, secondsLeft, canExtend, onStay, onSignOut }) {
  const reduceMotion = useReducedMotion()
  const stayButtonRef = useRef(null)
  const signOutButtonRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    // Focus the primary action on open; when the cap disables it, the action that
    // is actually available takes focus instead.
    if (canExtend) stayButtonRef.current?.focus()
    else signOutButtonRef.current?.focus()

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onStay()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, canExtend, onStay])

  const countdown = formatCountdown(secondsLeft * 1000)
  const transition = reduceMotion ? { duration: 0 } : { duration: 0.18, ease: 'easeOut' }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="session-expiry"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
          transition={transition}
          className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/30 p-3 backdrop-blur-[2px] dark:bg-black/65"
          onClick={onStay}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="session-expiry-title"
            aria-describedby="session-expiry-description"
            initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduceMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.97 }}
            transition={transition}
            className="praxis-modal-panel flex w-full max-w-[380px] cursor-default flex-col rounded-2xl border border-slate-200/90 bg-white/95 p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900/95"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-lg font-bold text-amber-700 dark:bg-amber-400/10 dark:text-amber-300"
              >
                ⏳
              </div>
              <div>
                <h2 id="session-expiry-title" className="text-[16px] font-bold text-slate-900 dark:text-white">
                  Still there?
                </h2>
                <p id="session-expiry-description" className="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  {canExtend
                    ? 'For your security we sign you out after a period of inactivity.'
                    : 'For your security every session ends 12 hours after you sign in.'}
                </p>
              </div>
            </div>

            <p className="mt-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
              Signing out in{' '}
              <span aria-live="polite" className="tabular-nums text-slate-900 dark:text-white">
                {countdown}
              </span>
            </p>

            {!canExtend && (
              <p id="session-expiry-cap" className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                This 12-hour limit can&apos;t be extended. Sign in again to keep working.
              </p>
            )}

            <div className="praxis-modal-actions mt-5 flex w-full items-center gap-3">
              <button
                ref={signOutButtonRef}
                type="button"
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white"
                onClick={onSignOut}
              >
                Sign out now
              </button>
              <button
                ref={stayButtonRef}
                type="button"
                disabled={!canExtend}
                aria-describedby={canExtend ? undefined : 'session-expiry-cap'}
                className="flex-1 rounded-xl bg-indigo-600 bg-gradient-to-r from-indigo-600 to-cyan-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-500/20 transition-colors hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:brightness-100 dark:from-indigo-500 dark:to-cyan-500"
                onClick={onStay}
              >
                Stay signed in
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
