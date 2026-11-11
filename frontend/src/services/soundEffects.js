/**
 * soundEffects — the app's only audio code: synthesised Web Audio cues, no
 * assets, no network, offline-safe.
 *
 * Every cue is an oscillator + gain envelope built from config/gameRules SOUND,
 * created lazily on the first user gesture (autoplay policy) and no-op'ed when
 * audio is unavailable, muted, or storage is denied. Nothing here ever throws
 * or blocks the caller: a browser without Web Audio simply stays silent.
 *
 * The mixer is module state, not React state: gameplay code calls playSound()
 * imperatively from a state transition, never from a render. Gestures that can
 * repeat many times a second (a carousel index, a fast scroll) go through
 * playThrottledSound() instead, which enforces SOUND.throttleMs per cue.
 */
import { SOUND } from '../config/gameRules.js'
import { SOUND_ENABLED } from '../config/storageKeys.js'

const MIDI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

let enabled = false
let audioCtx = null
let pendingResume = null
/**
 * When each cue last sounded, for playThrottledSound. Keyed by cue name so a
 * burst of navigation ticks can never swallow a different cue.
 */
const lastPlayedAt = new Map()
/**
 * False until a user gesture has called primeAudio(). Nothing may CREATE an
 * AudioContext before that: a cue fired by a state transition is not a gesture,
 * and constructing one only to leave it suspended is exactly what the autoplay
 * policy asks us not to do.
 */
let unlocked = false

/* ---- preference ---- */

/** Defaults to SOUND.enabled until a stored preference says otherwise. */
function readPreference() {
  try {
    const raw = window.localStorage.getItem(SOUND_ENABLED)
    return raw === null ? SOUND.enabled : raw === 'true'
  } catch {
    return SOUND.enabled
  }
}

enabled = typeof window === 'undefined' ? SOUND.enabled : readPreference()

export function isSoundEnabled() {
  return enabled
}

export function setSoundEnabled(next) {
  enabled = Boolean(next)
  try {
    window.localStorage.setItem(SOUND_ENABLED, enabled ? 'true' : 'false')
  } catch {
    /* private mode / storage full: the in-memory preference still applies */
  }
}

/* ---- the synth ---- */

function AudioContextCtor() {
  if (typeof window === 'undefined') return null
  return window.AudioContext || window.webkitAudioContext || null
}

/** Lazily create the context. Only ever called from a user gesture. */
function getContext() {
  if (!unlocked) return null
  const Ctor = AudioContextCtor()
  if (!Ctor) return null
  try {
    if (!audioCtx) audioCtx = new Ctor()
    return audioCtx
  } catch {
    return null
  }
}

/**
 * Wake the audio hardware. Safe to call on every gesture: the first click that
 * counts wins and the rest return the in-flight resume.
 */
export function primeAudio() {
  try {
    unlocked = true
    const ctx = getContext()
    if (!ctx) return null
    if (ctx.state === 'running') return Promise.resolve()
    if (!pendingResume) {
      pendingResume = Promise.resolve(ctx.resume()).catch(() => {}).finally(() => { pendingResume = null })
    }
    return pendingResume
  } catch {
    return null
  }
}

/** 'C#5' / 'Eb4' -> Hz. Equal temperament, A4 = 440. */
function noteToHz(note) {
  const match = /^([A-G])([#b]?)(-?\d)$/.exec(String(note).trim())
  if (!match) return 0
  const [, letter, accidental, octave] = match
  const semitone = MIDI[letter] + (accidental === '#' ? 1 : accidental === 'b' ? -1 : 0)
  return 440 * Math.pow(2, (semitone - 9) / 12 + (Number(octave) - 4))
}

/**
 * Schedule one note: a gain envelope that fades in over `attackMs` and decays
 * to silence by the end of the note. Returns the oscillator, or null.
 */
function scheduleNote(ctx, type, hz, at, noteMs, gain) {
  const osc = ctx.createOscillator()
  const amp = ctx.createGain()
  const attack = Math.min(SOUND.attackMs, noteMs / 2) / 1000
  const duration = noteMs / 1000

  osc.type = type
  osc.frequency.setValueAtTime(hz, at)
  amp.gain.setValueAtTime(0.0001, at)
  amp.gain.linearRampToValueAtTime(gain, at + attack)
  amp.gain.exponentialRampToValueAtTime(0.0001, at + duration)

  osc.connect(amp)
  amp.connect(ctx.destination)
  osc.start(at)
  osc.stop(at + duration + 0.02)
  return osc
}

/**
 * Play one cue. Unknown cues, muted audio and unavailable Web Audio are all
 * silent no-ops — this is called from state transitions, so it must never
 * throw and never wait.
 */
export function playSound(cue) {
  const spec = SOUND.cues[cue]
  if (!spec || !enabled) return false
  // No gesture yet: the context is not even created, so this is a silent no-op.
  const ctx = getContext()
  if (!ctx || ctx.state === 'closed') return false

  try {
    // A suspended context (cue fired before the first gesture, or the tab was
    // backgrounded) gets its resume kicked off; the notes below are scheduled
    // from its frozen clock, so they simply start once it is running.
    if (ctx.state !== 'running') primeAudio()
    const gain = SOUND.volume * (spec.gain ?? 1)
    let at = ctx.currentTime
    for (const note of spec.notes) {
      const hz = noteToHz(note)
      if (hz > 0) scheduleNote(ctx, spec.type, hz, at, spec.noteMs, gain)
      at += (spec.noteMs + (spec.gapMs || 0)) / 1000
    }
    return true
  } catch {
    return false
  }
}

/**
 * Play one cue at most once per SOUND.throttleMs. This is the scroll-like path:
 * a carousel index can change several times inside one fast swipe, and a tick
 * per change is unbearable, so the leading change of a burst sounds and the
 * rest inside the window are dropped. Everything else uses playSound directly.
 *
 * Returns true when the cue actually played, false when it was throttled (or
 * when playSound itself no-op'ed — muted, or no Web Audio).
 */
export function playThrottledSound(cue) {
  const now = Date.now()
  if (now - (lastPlayedAt.get(cue) ?? 0) < SOUND.throttleMs) return false
  lastPlayedAt.set(cue, now)
  return playSound(cue)
}
