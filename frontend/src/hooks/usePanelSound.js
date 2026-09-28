/**
 * usePanelSound — one soft open/close cue per panel visibility transition.
 *
 * The cue follows the panel's `visible` value rather than each control, so
 * every path that opens or closes it (trigger button, backdrop click, the ✕,
 * Escape, a tier change that hides it) is covered by one line, and it fires
 * from a state transition with a guard — never from a render and never twice
 * for one change.
 *
 * The ref holds the last value that was already cued. That keeps the first
 * render silent (React StrictMode re-runs mount effects in development) and an
 * unchanged re-render silent, while a real transition cues exactly once.
 *
 * The cue itself is only audible if the AudioContext is unlocked, so the
 * gesture that OPENS the panel calls primeAudio() — see services/soundEffects.js
 * for the `unlocked` semantics. Closing needs no priming: nothing can close a
 * panel it never opened.
 */
import { useEffect, useRef } from 'react'
import { playSound } from '../services/soundEffects.js'

export default function usePanelSound(visible) {
  const cuedRef = useRef(visible)

  useEffect(() => {
    if (cuedRef.current === visible) return
    cuedRef.current = visible
    if (visible) {
      playSound('panelOpen')
    } else {
      playSound('panelClose')
    }
  }, [visible])
}
