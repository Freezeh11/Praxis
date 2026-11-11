/**
 * soundEffects — the app's only audio code: synthesised Web Audio cues, no
 * assets, no network, offline-safe.
 *
 * Every cue is a small data description in config/gameRules SOUND — notes,
 * envelopes, an optional filtered-noise transient, an optional two-oscillator
 * stack. This module is the generic player for that data: it never names a cue,
 * a frequency or a duration, so adding a sound is one config line.
 *
 * Signal path: note -> per-note gain envelope -> shared bus -> gentle
 * compressor (used as a limiter) -> destination. The bus is built once per
 * AudioContext and keeps a cue that stacks a bass note under an arpeggio from
 * clipping. Notes are scheduled on the audio clock, never with timers, so a
 * frame hitch can delay a cue but never shift it out of tune.
 *
 * Audio is created lazily on the first user gesture (autoplay policy) and
 * no-op'ed when unavailable, muted, or storage is denied. Nothing here ever
 * throws or blocks the caller: a browser without Web Audio simply stays silent.
 *
 * The mixer is module state, not React state: gameplay code calls playSound()
 * imperatively from a state transition, never from a render. Gestures that can
 * repeat many times a second (a carousel index, a fast scroll) go through
 * playThrottledSound() instead, which enforces SOUND.throttleMs per cue.
 */
import { SOUND } from '../config/gameRules.js'
import { SOUND_ENABLED } from '../config/storageKeys.js'

const MIDI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const A4_HZ = 440
/** Gain of the second oscillator in a stacked voice, relative to the first. */
const STACK_MIX = 0.45
/** Seconds of white noise kept per context for every transient. */
const NOISE_SECONDS = 0.5

let enabled = false
let audioCtx = null
let pendingResume = null
/** { ctx, input } — the shared limiter stage, rebuilt whenever the context is. */
let master = null
/** One reusable noise buffer per context; transients just read from it. */
let noiseBuffer = null
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

/** Lazily create the context. Only ever called after a gesture unlocked audio. */
function getContext() {
  if (!unlocked) return null
  const Ctor = AudioContextCtor()
  if (!Ctor) return null
  try {
    // A closed context never makes sound again: drop it (and its bus) so the
    // next gesture starts a fresh one instead of going permanently silent.
    if (audioCtx && audioCtx.state === 'closed') audioCtx = null
    if (!audioCtx) {
      audioCtx = new Ctor()
      master = null
      noiseBuffer = null
    }
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

/** A finite number, or the fallback. Config data is trusted but never assumed. */
function numberOr(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/** 'C#5' / 'Eb4' -> Hz. Equal temperament, A4 = 440. 0 when unparseable. */
function noteToHz(note) {
  const match = /^([A-G])([#b]?)(-?\d)$/.exec(String(note).trim())
  if (!match) return 0
  const [, letter, accidental, octave] = match
  const semitone = MIDI[letter] + (accidental === '#' ? 1 : accidental === 'b' ? -1 : 0)
  return A4_HZ * Math.pow(2, (semitone - 9) / 12 + (Number(octave) - 4))
}

/**
 * Pitch-bend target for a note: a number means semitones off its own pitch, a
 * string is the note to end on. 0 means "no bend".
 */
function glideTarget(glide, hz) {
  if (typeof glide === 'number' && Number.isFinite(glide) && glide !== 0) {
    return hz * Math.pow(2, glide / 12)
  }
  if (typeof glide === 'string') {
    const target = noteToHz(glide)
    if (target > 0) return target
  }
  return 0
}

/**
 * The shared output stage: every note lands on one gain feeding a gentle
 * compressor. Built once per context and kept for the session.
 */
function getMaster(ctx) {
  if (master && master.ctx === ctx) return master
  const input = ctx.createGain()
  input.gain.value = 1
  try {
    const limiter = ctx.createDynamicsCompressor()
    limiter.threshold.value = -16
    limiter.knee.value = 20
    limiter.ratio.value = 8
    limiter.attack.value = 0.003
    limiter.release.value = 0.2
    input.connect(limiter)
    limiter.connect(ctx.destination)
  } catch {
    // No compressor in this implementation: plain summing still works, it just
    // cannot guarantee headroom.
    input.connect(ctx.destination)
  }
  master = { ctx, input }
  return master
}

/** One short noise buffer per context, reused by every transient. */
function noiseBufferFor(ctx) {
  if (noiseBuffer) return noiseBuffer
  try {
    const length = Math.max(1, Math.floor(ctx.sampleRate * NOISE_SECONDS))
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1
    noiseBuffer = buffer
    return buffer
  } catch {
    return null
  }
}

/**
 * One oscillator voice: linear attack (anti-click), optional hold, exponential
 * decay to near-silence by the end of the note, with an optional pitch bend.
 */
function scheduleOsc(ctx, out, voice) {
  const durationMs = Math.max(20, voice.durationMs)
  const seconds = durationMs / 1000
  const attackMs = Math.min(Math.max(voice.attackMs, 1), durationMs * 0.45)
  const holdMs = Math.min(Math.max(voice.holdMs, 0), Math.max(durationMs - attackMs - 5, 0))
  const peak = Math.max(voice.peak, 0.0002)

  const osc = ctx.createOscillator()
  const amp = ctx.createGain()

  osc.type = voice.wave
  osc.frequency.setValueAtTime(voice.hz, voice.at)
  if (voice.glideTo > 0) osc.frequency.exponentialRampToValueAtTime(voice.glideTo, voice.at + seconds)
  if (voice.detuneCents) osc.detune.setValueAtTime(voice.detuneCents, voice.at)

  amp.gain.setValueAtTime(0.0001, voice.at)
  amp.gain.linearRampToValueAtTime(peak, voice.at + attackMs / 1000)
  if (holdMs > 0) amp.gain.setValueAtTime(peak, voice.at + (attackMs + holdMs) / 1000)
  amp.gain.exponentialRampToValueAtTime(0.0001, voice.at + seconds)

  osc.connect(amp)
  amp.connect(out)
  osc.start(voice.at)
  osc.stop(voice.at + seconds + 0.02)
}

/**
 * A filtered noise burst: the wood/click attack of a tick, or the air of a
 * panel and a reset. A sweep of the filter frequency reads as movement; a
 * static one reads as a knock.
 */
function scheduleNoise(ctx, out, at, burst) {
  const buffer = noiseBufferFor(ctx)
  if (!buffer) return

  const seconds = Math.max(numberOr(burst.ms, 20), 4) / 1000
  const freq = Math.max(numberOr(burst.freq, 2000), 30)
  const freqTo = numberOr(burst.freqTo, 0)
  const peak = Math.max(numberOr(burst.gain, 0.2), 0.0002)

  const src = ctx.createBufferSource()
  const filter = ctx.createBiquadFilter()
  const amp = ctx.createGain()

  src.buffer = buffer
  filter.type = burst.type || 'bandpass'
  filter.frequency.setValueAtTime(freq, at)
  if (freqTo > 0) filter.frequency.exponentialRampToValueAtTime(Math.max(freqTo, 30), at + seconds)
  filter.Q.setValueAtTime(numberOr(burst.q, 0.8), at)

  amp.gain.setValueAtTime(0.0001, at)
  amp.gain.linearRampToValueAtTime(peak, at + Math.min(0.006, seconds * 0.4))
  amp.gain.exponentialRampToValueAtTime(0.0001, at + seconds)

  src.connect(filter)
  filter.connect(amp)
  amp.connect(out)
  src.start(at)
  src.stop(at + seconds + 0.02)
}

/**
 * Resolve one cue note against the cue's defaults. A note is a bare name
 * ('C5') or an object with any of: note, at, gain, glide, detune, duration,
 * wave, attack, hold, stack, noise. Returns null for an unparseable note, which
 * is skipped rather than thrown.
 */
function planNote(entry, spec, cursor) {
  const raw = typeof entry === 'string' ? { note: entry } : entry
  if (!raw || typeof raw !== 'object') return null
  const hz = noteToHz(raw.note)
  if (!(hz > 0)) return null
  return {
    hz,
    startMs: Number.isFinite(raw.at) ? Math.max(raw.at, 0) : cursor,
    durationMs: Math.max(20, numberOr(raw.duration, numberOr(spec.noteMs, 120))),
    wave: raw.wave || spec.wave || spec.type || 'sine',
    glideTo: glideTarget(raw.glide, hz),
    detune: numberOr(raw.detune, 0),
    stack: numberOr(raw.stack, numberOr(spec.stack, 0)),
    attackMs: numberOr(raw.attack, numberOr(spec.attackMs, SOUND.attackMs)),
    holdMs: numberOr(raw.hold, 0),
    gain: numberOr(raw.gain, 1),
    noise: raw.noise || null,
  }
}

/**
 * Schedule a whole cue at a context time. Cue-level gain scales every note and
 * transient; a note without an explicit start offset begins where the previous
 * one ended, so simple cues stay a plain list of notes and layered ones opt in
 * with an offset.
 */
function scheduleCue(ctx, out, spec, at) {
  const base = SOUND.volume * numberOr(spec.gain, 1)
  const gapMs = numberOr(spec.gapMs, 0)
  let cursor = 0

  // A cue-level burst is the attack of the cue itself: mallet, click, air.
  if (spec.noise) {
    scheduleNoise(ctx, out, at, { ...spec.noise, gain: numberOr(spec.noise.gain, 0.2) * base })
  }

  for (const entry of spec.notes || []) {
    const note = planNote(entry, spec, cursor)
    if (!note) continue
    cursor = note.startMs + note.durationMs + gapMs

    const start = at + note.startMs / 1000
    const peak = base * note.gain
    // Two detuned oscillators make one warm voice; a single one is enough for a
    // tick, where the beating would smear the attack.
    const detunes = note.stack
      ? [note.detune - note.stack / 2, note.detune + note.stack / 2]
      : [note.detune]
    detunes.forEach((detuneCents, index) => {
      scheduleOsc(ctx, out, {
        wave: note.wave,
        hz: note.hz,
        at: start,
        durationMs: note.durationMs,
        attackMs: note.attackMs,
        holdMs: note.holdMs,
        peak: index === 0 ? peak : peak * STACK_MIX,
        detuneCents,
        glideTo: note.glideTo,
      })
    })

    if (note.noise) {
      scheduleNoise(ctx, out, start, { ...note.noise, gain: numberOr(note.noise.gain, 0.2) * peak })
    }
  }
}

/**
 * How long a cue sounds, in ms — the same arithmetic scheduleCue plays from, so
 * callers can sequence two cues without hardcoding a duration.
 */
export function cueLengthMs(cue) {
  const spec = SOUND.cues[cue]
  if (!spec) return 0
  const gapMs = numberOr(spec.gapMs, 0)
  let cursor = 0
  let end = spec.noise ? numberOr(spec.noise.ms, 20) : 0
  for (const entry of spec.notes || []) {
    const note = planNote(entry, spec, cursor)
    if (!note) continue
    cursor = note.startMs + note.durationMs + gapMs
    end = Math.max(end, cursor - gapMs)
  }
  return end
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
    scheduleCue(ctx, getMaster(ctx).input, spec, ctx.currentTime)
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
