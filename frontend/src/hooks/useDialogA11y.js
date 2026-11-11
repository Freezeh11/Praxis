import { useEffect, useRef } from 'react'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Dialog semantics for the small confirm modals: Escape closes, focus moves into
 * the panel on open, Tab wraps inside it, and focus returns to the trigger on
 * close. Attach the returned ref to the panel and spread the returned props.
 *
 * The latest onClose is kept in a ref so an inline callback prop does not re-run
 * the effect (and steal focus) on every parent render.
 */
export default function useDialogA11y(show, onClose) {
  const panelRef = useRef(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!show) return undefined
    const previouslyFocused = document.activeElement
    const panel = panelRef.current
    const focusables = () => Array.from(panel ? panel.querySelectorAll(FOCUSABLE) : [])

    // Prefer an explicit [data-autofocus] target (the primary action), then the
    // first control, and finally the panel itself when it holds only text.
    const preferred = panel?.querySelector('[data-autofocus]')
    const first = preferred || focusables()[0] || panel
    first?.focus?.({ preventScroll: true })

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeRef.current?.()
        return
      }
      if (event.key !== 'Tab' || !panel) return
      const list = focusables()
      if (list.length === 0) {
        event.preventDefault()
        return
      }
      const firstEl = list[0]
      const lastEl = list[list.length - 1]
      if (event.shiftKey && document.activeElement === firstEl) {
        event.preventDefault()
        lastEl.focus()
      } else if (!event.shiftKey && document.activeElement === lastEl) {
        event.preventDefault()
        firstEl.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      if (previouslyFocused instanceof HTMLElement && document.contains(previouslyFocused)) {
        previouslyFocused.focus({ preventScroll: true })
      }
    }
  }, [show])

  return panelRef
}
