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
 * Each cue is `{ type, notes, noteMs, gapMs, gain }`: an oscillator per note,
 * with its own attack/decay envelope, spaced by `gapMs`. Adding a cue is one
 * line here; the engine never hardcodes a frequency or a duration.
 *
 * `enabled` is the FIRST-RUN default only — the learner's choice lives in
 * localStorage under SOUND_ENABLED_KEY.
 *
 * Cue naming: a cue is what the learner just DID (select, deselect, levelNav,
 * enter, panelOpen, panelClose), not where it was played from, so one cue can
 * serve several screens.
 */
export const SOUND = {
  enabled: true,
  /** Master gain every cue is scaled by, 0..1. */
  volume: 0.16,
  /** Envelope length of one note, in ms (attack is the first 15%). */
  attackMs: 12,
  /**
   * Shortest gap between two plays of the SAME cue, in ms.
   *
   * Only the scroll-like cues use it (services/soundEffects playThrottledSound):
   * a carousel index changes many times during one fast burst of arrow taps or
   * a swipe, and a tick per change is unbearable. One-per-action cues (step,
   * correct, …) keep the unthrottled path — `step` and `correct` deliberately
   * fire back to back when a law finishes the puzzle.
   */
  throttleMs: 90,
  cues: {
    /** A law was applied. Short, low, barely-there click. */
    step: { type: 'triangle', notes: ['E5'], noteMs: 70, gapMs: 0, gain: 0.75 },
    /** A hint was taken. Soft two-note blip. */
    hint: { type: 'sine', notes: ['C5', 'G5'], noteMs: 90, gapMs: 45, gain: 0.8 },
    /** The Guide was activated. Brighter three-note figure. */
    guide: { type: 'sine', notes: ['E5', 'A5', 'C#6'], noteMs: 85, gapMs: 45, gain: 0.8 },
    /** The puzzle is solved. Ascending arpeggio. */
    correct: { type: 'sine', notes: ['C5', 'E5', 'G5', 'C6'], noteMs: 95, gapMs: 55, gain: 0.95 },
    /** Dead end, or a selection no law applies to. Low descending blip. */
    wrong: { type: 'sawtooth', notes: ['A3', 'E3'], noteMs: 120, gapMs: 60, gain: 0.7 },
    /** The problem was reset. Descending sweep. */
    reset: { type: 'triangle', notes: ['A5', 'F5', 'C5'], noteMs: 85, gapMs: 40, gain: 0.7 },
    /** Level/stage completed and scored. A fuller arpeggio. */
    complete: { type: 'sine', notes: ['C5', 'E5', 'G5', 'C6', 'E6'], noteMs: 110, gapMs: 60, gain: 1 },
    /**
     * A literal, term or negated group joined the selection. Higher, shorter
     * and quieter than `step` so a click-to-select never reads as a step.
     */
    select: { type: 'triangle', notes: ['B5'], noteMs: 50, gapMs: 0, gain: 0.5 },
    /** The same click took the item back out: the lower, quieter mirror of `select`. */
    deselect: { type: 'triangle', notes: ['F#5'], noteMs: 50, gapMs: 0, gain: 0.34 },
    /** The level carousel moved to another card. Always via playThrottledSound. */
    levelNav: { type: 'sine', notes: ['A5'], noteMs: 40, gapMs: 0, gain: 0.32 },
    /** A level or stage was actually chosen and the app is navigating there. */
    enter: { type: 'sine', notes: ['G5', 'D6'], noteMs: 75, gapMs: 45, gain: 0.7 },
    /** A panel, drawer or sheet opened: two quick rising notes. */
    panelOpen: { type: 'sine', notes: ['D5', 'G5'], noteMs: 55, gapMs: 30, gain: 0.45 },
    /** A panel, drawer or sheet closed: the same pair, falling and a touch quieter. */
    panelClose: { type: 'sine', notes: ['G5', 'D5'], noteMs: 55, gapMs: 30, gain: 0.4 },
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
