import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { LAST_UPDATED, TERMS_SECTIONS } from '../../content/termsContent.js'
import Icon from './Icon.jsx'

/**
 * Inline link styling for the "Praxis learning terms" trigger on the auth pages
 * (and any prose link inside the dialog). Exported so the trigger and the dialog
 * can never drift apart.
 */
export const TERMS_LINK_CLASS =
  'rounded-sm text-indigo-700 underline decoration-indigo-300 underline-offset-2 hover:text-indigo-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:text-cyan-300 dark:decoration-cyan-400/40 dark:hover:text-cyan-200 dark:focus-visible:ring-cyan-400/40'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

const CLOSE_ICON_BUTTON_CLASS =
  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:border-white/10 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white dark:focus-visible:ring-cyan-400/40'

const SECONDARY_BUTTON_CLASS =
  'inline-flex min-h-10 items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 px-5 py-2 text-[13px] font-semibold text-indigo-700 transition-colors duration-200 hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:border-indigo-400/25 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20 dark:focus-visible:ring-cyan-400/40'

/**
 * Accessible terms modal for the auth pages.
 *
 * Behaviour: role=dialog + aria-modal, labelled by its heading; Escape and a
 * backdrop click close it; focus moves to the close button on open, is trapped
 * inside the panel while it is open and returns to the trigger on close; body
 * scroll is locked and the panel body scrolls on its own (max-h-[70vh]).
 * Rendered in a portal so the card's animated wrapper cannot become the
 * containing block for the fixed overlay.
 */
export default function TermsDialog({ open, onClose }) {
  const panelRef = useRef(null)
  const closeButtonRef = useRef(null)
  const returnFocusRef = useRef(null)
  const onCloseRef = useRef(onClose)
  const titleId = useId()
  const reduceMotion = useReducedMotion()

  // Keep the latest handler without re-running the open/close effect.
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return undefined

    const previousOverflow = document.body.style.overflow
    const previousPaddingRight = document.body.style.paddingRight
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth

    returnFocusRef.current = document.activeElement
    document.body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) document.body.style.paddingRight = scrollbarWidth + 'px'

    const focusTimer = window.setTimeout(() => {
      if (closeButtonRef.current) closeButtonRef.current.focus()
    }, 0)

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onCloseRef.current?.()
        return
      }
      if (event.key !== 'Tab') return

      const panel = panelRef.current
      if (!panel) return
      const focusable = Array.from(panel.querySelectorAll(FOCUSABLE_SELECTOR))

      if (focusable.length === 0) {
        event.preventDefault()
        panel.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      const inside = panel.contains(active)

      if (event.shiftKey) {
        if (!inside || active === first) {
          event.preventDefault()
          last.focus()
        }
      } else if (!inside || active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)

    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', handleKeyDown, true)
      document.body.style.overflow = previousOverflow
      document.body.style.paddingRight = previousPaddingRight
      const returnTarget = returnFocusRef.current
      if (returnTarget && typeof returnTarget.focus === 'function' && document.contains(returnTarget)) {
        returnTarget.focus()
      }
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/40 p-3 backdrop-blur-sm sm:p-6 dark:bg-black/60"
      onClick={() => onCloseRef.current?.()}
    >
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 shadow-[0_24px_60px_rgba(15,23,42,0.18)] backdrop-blur-sm outline-none dark:border-white/10 dark:bg-slate-900/95 dark:shadow-[0_24px_60px_rgba(0,0,0,0.6)] sm:max-h-[calc(100dvh-3rem)]"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200/90 px-5 py-4 dark:border-white/10 sm:px-6">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-600 dark:text-cyan-400">
              Praxis
            </p>
            <h2
              id={titleId}
              className="mt-1 text-[19px] font-extrabold tracking-tight text-slate-900 dark:text-white"
            >
              Terms and Conditions
            </h2>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Last updated {LAST_UPDATED}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={() => onCloseRef.current?.()}
            aria-label="Close terms and conditions"
            className={CLOSE_ICON_BUTTON_CLASS}
          >
            <Icon name="close" className="text-[15px]" />
          </button>
        </div>

        <div className="min-h-0 max-h-[70vh] flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6">
          <p className="text-[13px] leading-6 text-slate-600 dark:text-slate-300">
            These terms cover what you can expect from Praxis and what Praxis expects from you.
            They apply to every account and every level.
          </p>

          <div className="mt-5 flex flex-col gap-5">
            {TERMS_SECTIONS.map((section) => (
              <section key={section.id} aria-labelledby={titleId + '-' + section.id}>
                <h3
                  id={titleId + '-' + section.id}
                  className="text-[14px] font-bold tracking-tight text-slate-900 dark:text-white"
                >
                  {section.title}
                </h3>
                {section.paragraphs.map((paragraph) => (
                  <p
                    key={paragraph}
                    className="mt-2 text-[13px] leading-6 text-slate-600 dark:text-slate-300"
                  >
                    {paragraph}
                  </p>
                ))}
                {section.bullets ? (
                  <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-[13px] leading-6 text-slate-600 marker:text-slate-400 dark:text-slate-300 dark:marker:text-slate-500">
                    {section.bullets.map((bullet) => (
                      <li key={bullet} className="pl-0.5">
                        {bullet}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-200/90 px-5 py-3.5 dark:border-white/10 sm:px-6">
          <button
            type="button"
            onClick={() => onCloseRef.current?.()}
            className={SECONDARY_BUTTON_CLASS}
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>,
    document.body,
  )
}
