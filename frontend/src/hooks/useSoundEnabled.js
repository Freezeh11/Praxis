/**
 * useSoundEnabled — the preference half of the sound feature: reads the stored
 * value, flips it, and primes the AudioContext on the click that turns sound on.
 *
 * The toggle itself is presentational; every side effect (storage, audio
 * unlock) lives here.
 */
import { useCallback, useState } from 'react'
import { isSoundEnabled, primeAudio, playSound, setSoundEnabled } from '../services/soundEffects.js'

export default function useSoundEnabled() {
  const [enabled, setEnabled] = useState(isSoundEnabled)

  const toggle = useCallback(() => {
    const next = !isSoundEnabled()
    setSoundEnabled(next)
    // This click IS the user gesture the autoplay policy wants: unlock audio
    // before the next cue needs it.
    primeAudio()
    if (next) playSound('step')
    setEnabled(next)
  }, [])

  return { enabled, toggle }
}
