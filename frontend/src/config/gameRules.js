/**
 * Game rules — every tunable number in ONE place.
 *
 * Before this module the same figures were repeated across the scoring endpoint,
 * the puzzle screen, the progress store and the level screens (40/30/30 in two
 * files, 90/75 in two, 80% in three, 10/20/5 points in four). Change a rule here
 * and every consumer follows.
 *
 * Convention: values are plain numbers/strings so they can be imported by the
 * engine (unit-tested, framework-free) as well as by React components.
 */

/** Weights of the three scoring components. They must sum to 100. */
export const SCORE_WEIGHTS = {
  efficiency: 40,
  targetLaw: 30,
  hintIndependence: 30,
}

/** Penalties applied inside the scoring bands. */
export const SCORE_PENALTY = {
  /** Per step beyond the optimal derivation, off the efficiency band. */
  stepOverOptimal: 10,
  /** Per hint or guide consumed, off the hint-independence band. */
  assistance: 10,
}

/** A perfect score pays this many bonus points on top of STAGE_COMPLETION_XP. */
export const SCORE_BONUS_MAX_POINTS = 5

/** Fixed XP awarded for completing a stage, before the score bonus. */
export const STAGE_COMPLETION_XP = 10

/** Points a Guide costs (sandbox guides are free). */
export const GUIDE_COST_POINTS = 20

/** Star thresholds: a stage score at or above the value earns the stars. */
export const STAR_THRESHOLDS = {
  three: 90,
  two: 75,
  /** Any completion earns at least one star. */
  one: 1,
}

/** Maximum stars a single stage can earn. */
export const MAX_STARS_PER_STAGE = 3

/** A level unlocks when every stage is done AND the average score reaches this. */
export const UNLOCK_AVERAGE_SCORE = 80

/** Score-ramp colours for progress bars (percent thresholds). */
export const SCORE_RAMP = {
  good: 80,
  fair: 50,
}

/** Animation and interaction timing, in milliseconds. */
export const TIMING = {
  /** Law animation duration before the AST actually updates. */
  lawAnimationMs: 1350,
  /** Tutorial pause that highlights what is about to happen. */
  preLawHighlightMs: 1500,
  /** Delay before the success modal auto-opens, letting canvas transition settle. */
  successModalDelayMs: 320,
  /** How long a hint bubble stays on screen. */
  hintAutoDismissMs: 6000,
  /** Debounce before progress is pushed to the server. */
  progressSaveDebounceMs: 500,
  /** Debounce before sandbox input is validated as the learner types. */
  sandboxValidationDebounceMs: 300,
  /** Paint delay while the sandbox builds a puzzle. */
  sandboxBusyPaintMs: 30,
  /** Pause after sign-out before routing away, so auth state clears first. */
  signOutRedirectMs: 100,
  /** Poll interval that keeps the tutorial card anchored while the layout reflows. */
  coachCardReflowMs: 320,
  /** Poll interval that keeps the spotlight on a moving target. */
  spotlightRectPollMs: 200,
}

/** Tutorial identity. The tutorial is a real level, so these must match content. */
export const TUTORIAL = {
  levelId: 0,
  stageIndexes: [0, 1, 2, 3],
}

/** Zero-based Level 1 stage groups; later levels expose every supported law.
 * Identity joins factoring/complement: their intermediate 1 and 0 constants
 * must be removable in both the SOP and POS puzzles from stage index 2. */
export function paletteLawIds(levelId, stageIdx) {
  if (Number(levelId) !== 1) return null
  const ids = ['absorption']
  if (stageIdx >= 2) ids.push('idempotent', 'distributive', 'complement', 'identity')
  if (stageIdx >= 4) ids.push('demorgan')
  if (stageIdx >= 6) ids.push('annulment')
  return ids
}

/** Drag-and-drop interaction tunables for term/factor reordering. */
export const DRAG = {
  /** Movement (CSS px) that turns a press into a drag. */
  thresholdPx: 6,
  /** How far past a capsule's edge a release still counts as targeting it (the "+" gap). */
  nearCapsuleTolerancePx: 28,
  /** How long a stray click stays swallowed after a drag (covers delayed touch clicks). */
  clickSuppressMs: 400,
}

/**
 * Sandbox settings — learner-authored expressions and generated practice.
 *
 * ONE number owns the variable ceiling: `maxVariables` is the DEFAULT of the
 * `maxVariables` option on validateSandboxInput / buildSandboxPuzzle, and the
 * sandbox screen renders its help text from it, so widening the sandbox from
 * 4 to 6 variables is this one line (the engine itself has no limit — every
 * entry point takes the budget per call).
 *
 * 4 is the ceiling the proposal documents: Level 1 = 2 variables, Level 2 = 3,
 * Level 3 (the boss tier) = 4, and its scope section fixes the hardest
 * expressions at four variables.
 */
export const SANDBOX = {
  /** Distinct variables one learner expression may use. */
  maxVariables: 4,
  /** Default difficulty for generated sandbox problems. */
  difficulty: 'medium',
  /**
   * Search budgets for learner-authored expressions. Four-variable input is an
   * order of magnitude larger than a graded 3-variable puzzle, so these are
   * bigger than SOLVER_BUDGET.generator; the numbers below are measured, not
   * guessed.
   */
  budget: {
    // Measured on the six reference four-variable expressions: the worst case
    // ("A'BC'D' + A'BC'D + ABC'D' + ABC'D + ABCD + AB'CD") explores 26.8k
    // states over 8 moves before it reaches an equivalent terminal form, so
    // the old 20k cap sat BELOW the real requirement (24.6k states were needed
    // while the law engine's absorption predicate was still being fixed).
    // 40k/16 is ~1.5x headroom on states.
    simplestForm: { maxDepth: 16, maxStates: 40000 },
    // Measured worst case for replaying the optimal derivation: 16.7k states
    // over 8 moves — the previous 24k/14 already covers it with headroom.
    optimalPath: { maxDepth: 16, maxStates: 24000 },
  },
}

/** Default difficulty for generated sandbox problems (alias of SANDBOX.difficulty). */
export const SANDBOX_DIFFICULTY = SANDBOX.difficulty

/**
 * Sound design — every number services/soundEffects.js turns into audio.
 *
 * The palette is built from three materials, so unrelated actions never sound
 * alike:
 *   WOOD  — short filtered ticks with a mallet transient: pointing, selecting,
 *           applying a law.
 *   GLASS — sine bells and shimmers, detuned in pairs: hints, rewards, stars.
 *   AIR   — band-passed noise sweeps: movement through the app (panels, reset,
 *           arriving at a level).
 *
 * A cue is pure data; the engine owns every waveform, envelope and filter.
 * Shape:
 *
 *   {
 *     wave,     default oscillator waveform for its notes ('sine' | 'triangle' | …)
 *     gain,     cue gain, multiplied with SOUND.volume
 *     noteMs,   default note length in ms
 *     gapMs,    silence between sequential notes
 *     attackMs, default fade-in (a note's own attack overrides it)
 *     stack,    cents between the two oscillators of a voice (0 = single)
 *     noise,    attack transient for the whole cue (mallet, click, air)
 *     notes: [ 'E5' | { note, at, gain, glide, detune, duration, wave,
 *                        attack, hold, stack, noise } ]
 *   }
 *
 * A note with an explicit start offset (at) is placed absolutely in ms from the
 * cue start and may overlap the others — that is how the completion fanfare
 * stacks a bass note under its arpeggio. Without it a note begins where the
 * previous one ended. glide bends the pitch over the note (a number of
 * semitones, or a target note name); detune offsets one voice in cents; stack
 * adds the second oscillator that warms a bell or a pluck; hold keeps a pluck
 * at full level before it decays.
 *
 * A noise burst is a short filtered burst of white noise. Without a sweep it is
 * a knock or a click; with freqTo it sweeps its filter and reads as air.
 *
 * Length budget: every cue stays under ~700 ms except complete, the one
 * fanfare, at ~1.05 s. Cues are summed through a shared limiter, so overlapping
 * material ducks instead of clipping.
 *
 * enabled is the FIRST-RUN default only — the learner's choice lives in
 * localStorage under SOUND_ENABLED_KEY.
 *
 * Cue naming: a cue is what the learner just DID (select, deselect, levelNav,
 * enter, panelOpen, panelClose), not where it was played from, so one cue can
 * serve several screens.
 */
export const SOUND = {
  enabled: true,
  /** Master gain every cue is scaled by, 0..1. */
  volume: 0.18,
  /** Default envelope fade-in for one note, in ms. Short enough to stay percussive. */
  attackMs: 8,
  /**
   * Shortest gap between two plays of the SAME cue, in ms.
   *
   * Only the scroll-like cues use it (services/soundEffects playThrottledSound):
   * a carousel index changes many times during one fast burst of arrow taps or
   * a swipe, and a tick per change is unbearable. One-per-action cues (step,
   * correct, …) keep the unthrottled path — step and correct deliberately fire
   * back to back when a law finishes the puzzle.
   */
  throttleMs: 90,
  cues: {
    /* ---- wood: pointing, selecting, nudging ---- */

    /** A law was applied. Warm marimba pluck: triangular body, short mallet tick. */
    step: {
      wave: 'triangle',
      gain: 0.8,
      noteMs: 105,
      stack: 6,
      notes: [
        { note: 'E5', hold: 18, noise: { ms: 16, gain: 0.2, freq: 1100, q: 0.9 } },
      ],
    },

    /**
     * A literal, term or negated group joined the selection. Soft wooden tick:
     * barely there, but it lands exactly when the click does.
     */
    select: {
      wave: 'triangle',
      gain: 0.42,
      noteMs: 34,
      stack: 5,
      notes: [
        { note: 'B5', attack: 4, noise: { ms: 12, gain: 0.3, freq: 2900, q: 0.7 } },
      ],
    },

    /** The same click took the item back out: the tick, a step lower and darker. */
    deselect: {
      wave: 'triangle',
      gain: 0.3,
      noteMs: 40,
      stack: 5,
      notes: [
        { note: 'F#5', attack: 4, glide: -1, noise: { ms: 12, gain: 0.22, freq: 1500, q: 0.9 } },
      ],
    },

    /** The level carousel moved to another card. Tiny wooden tick, always throttled. */
    levelNav: {
      wave: 'triangle',
      gain: 0.26,
      noteMs: 26,
      notes: [
        { note: 'A5', attack: 3, noise: { ms: 8, gain: 0.26, freq: 3400, q: 0.8 } },
      ],
    },

    /* ---- glass: help and reward ---- */

    /** A hint was taken. Two-note glass bell, a fifth apart, left to ring. */
    hint: {
      wave: 'sine',
      gain: 0.5,
      noteMs: 200,
      gapMs: 55,
      stack: 9,
      noise: { ms: 10, gain: 0.1, freq: 5200, q: 1.1 },
      notes: [
        'C6',
        { note: 'G6', duration: 240 },
      ],
    },

    /** The Guide was activated. Rising three-note glass shimmer. */
    guide: {
      wave: 'sine',
      gain: 0.48,
      noteMs: 110,
      gapMs: 35,
      stack: 8,
      notes: [
        { note: 'E5', glide: 1 },
        { note: 'A5', glide: 1 },
        { note: 'C#6', duration: 170 },
      ],
    },

    /** The puzzle is solved. Bright pentatonic sparkle with a short tail. */
    correct: {
      wave: 'triangle',
      gain: 0.72,
      noteMs: 70,
      gapMs: 25,
      stack: 7,
      notes: [
        'C6', 'D6', 'E6', 'G6',
        { note: 'A6', duration: 190, gain: 0.9 },
      ],
    },

    /** A star was earned. One high bell that rings out after the fanfare. */
    star: {
      wave: 'sine',
      gain: 0.46,
      stack: 11,
      notes: [
        { note: 'B6', attack: 5, duration: 330 },
        { note: 'E7', at: 0, duration: 200, gain: 0.22 },
      ],
    },

    /**
     * Level or stage completed and scored. The one long cue: a soft bass note
     * under a rising sparkle arpeggio (~1.05 s).
     */
    complete: {
      wave: 'sine',
      gain: 1,
      stack: 5,
      notes: [
        { note: 'C3', at: 0, duration: 950, gain: 0.5, attack: 14 },
        { note: 'G4', at: 0, duration: 150, gain: 0.45 },
        { note: 'C5', at: 110, duration: 150, gain: 0.5 },
        { note: 'E5', at: 220, duration: 150, gain: 0.55 },
        { note: 'G5', at: 330, duration: 160, gain: 0.55 },
        { note: 'C6', at: 440, duration: 200, gain: 0.6 },
        { note: 'E6', at: 620, duration: 240, gain: 0.4 },
        { note: 'G6', at: 760, duration: 300, gain: 0.36, noise: { ms: 60, gain: 0.1, freq: 6800, q: 0.8 } },
      ],
    },

    /* ---- air: movement ---- */

    /** The problem was reset. Quick downward airy sweep over three falling notes. */
    reset: {
      wave: 'sine',
      gain: 0.38,
      noteMs: 75,
      gapMs: 25,
      stack: 6,
      noise: { ms: 260, gain: 0.26, freq: 2200, freqTo: 520, q: 0.6 },
      notes: [
        { note: 'A5', glide: -2 },
        { note: 'F5', glide: -2 },
        { note: 'C5', duration: 130 },
      ],
    },

    /** A level or stage was chosen and the app is navigating. Soft rising whoosh. */
    enter: {
      wave: 'sine',
      gain: 0.5,
      noteMs: 95,
      gapMs: 40,
      stack: 6,
      noise: { ms: 240, gain: 0.16, freq: 600, freqTo: 2400, q: 0.7 },
      notes: [
        { note: 'G4', glide: 1 },
        { note: 'D5', glide: 1, duration: 150 },
      ],
    },

    /** A panel, drawer or sheet opened: paper sliding up, with a high tick. */
    panelOpen: {
      wave: 'sine',
      gain: 0.6,
      noteMs: 26,
      noise: { ms: 170, gain: 0.24, freq: 700, freqTo: 2600, q: 0.8 },
      notes: [
        { note: 'D6', attack: 3, gain: 0.4 },
      ],
    },

    /** A panel, drawer or sheet closed: the same paper, sliding down. */
    panelClose: {
      wave: 'sine',
      gain: 0.6,
      noteMs: 26,
      noise: { ms: 190, gain: 0.22, freq: 2600, freqTo: 700, q: 0.8 },
      notes: [
        { note: 'A5', attack: 3, gain: 0.35 },
      ],
    },

    /* ---- failures and milestones ---- */

    /**
     * Dead end, or a selection no law applies to. Muted low thud with a little
     * body — a door closing, never a buzz.
     */
    wrong: {
      wave: 'sine',
      gain: 0.9,
      stack: 4,
      noise: { ms: 34, gain: 0.18, freq: 240, q: 1.2, type: 'lowpass' },
      notes: [
        { note: 'A2', duration: 180, glide: -3, attack: 5 },
        { note: 'E2', at: 15, duration: 210, gain: 0.55, attack: 6 },
      ],
    },

    /** A level unlocked: low mechanical click, then a rising fifth. */
    unlock: {
      wave: 'sine',
      gain: 0.6,
      stack: 5,
      noise: { ms: 20, gain: 0.3, freq: 420, q: 1.1, type: 'lowpass' },
      notes: [
        { note: 'C4', duration: 140, attack: 5 },
        { note: 'G4', at: 110, duration: 190, glide: 0.5, attack: 6 },
      ],
    },

    /** The walkthrough is about to demonstrate a step. Soft two-note guide tick. */
    tutorialStep: {
      wave: 'sine',
      gain: 0.34,
      noteMs: 70,
      gapMs: 45,
      stack: 5,
      notes: [
        'A4',
        { note: 'E5', duration: 110 },
      ],
    },
  },
}

/** Solver search budgets — the graded path and the generator differ. */
export const SOLVER_BUDGET = {
  /** Defaults used when a graded puzzle is loaded. */
  graded: { maxDepth: 16, maxStates: 3000 },
  /** Random generator: must reach the simplest form, then the goal. */
  generator: {
    simplestForm: { maxDepth: 12, maxStates: 8000 },
    optimalPath: { maxDepth: 12, maxStates: 12000 },
  },
}
