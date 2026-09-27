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
  /** Delay before the success modal auto-opens. */
  successModalDelayMs: 200,
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

/** Default difficulty for generated sandbox problems. */
export const SANDBOX_DIFFICULTY = 'medium'

/** Solver search budgets — the graded path, the generator and the sandbox all differ. */
export const SOLVER_BUDGET = {
  /** Defaults used when a graded puzzle is loaded. */
  graded: { maxDepth: 10, maxStates: 3000 },
  /** Random generator: must reach the simplest form, then the goal. */
  generator: {
    simplestForm: { maxDepth: 12, maxStates: 8000 },
    optimalPath: { maxDepth: 12, maxStates: 12000 },
  },
  /** Learner-authored expressions can be longer, so they get a bigger budget. */
  sandbox: {
    simplestForm: { maxDepth: 14, maxStates: 20000 },
    optimalPath: { maxDepth: 14, maxStates: 24000 },
  },
}
