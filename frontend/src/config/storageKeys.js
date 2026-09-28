/**
 * Every browser storage key the app uses, in one place.
 *
 * Keys were previously string literals spread over five files, which made it
 * impossible to answer "what do we persist?" without grep. Changing a key here
 * changes it everywhere; never inline a key at a call site.
 */

/** Per-user progress snapshot (points, stages, scores, solutions). */
export const progressKey = (userId) => `praxis_v1_${userId}`

/** Namespace prefix of the per-user progress key (used to find it generically). */
export const PROGRESS_KEY_PREFIX = 'praxis_v1_'

/** sessionStorage: learner chose "don't ask again" for the tutorial replay prompt. */
export const SKIP_TUTORIAL_REPLAY_PROMPT = 'praxis_skip_tutorial_replay_prompt'

/** sessionStorage: learner chose "don't ask again" for the reset confirmation. */
export const SKIP_RESET_CONFIRM = 'praxis_skip_reset_confirm'

/** sessionStorage: learner-authored sandbox puzzle handed from /sandbox to /sandbox/play. */
export const CUSTOM_SANDBOX_PUZZLE = 'praxis_sandbox_custom_puzzle'

/** sessionStorage: rotate-device banner dismissed for this session. */
export const HIDE_ROTATE_BANNER = 'praxis_hide_rotate_banner'

/** localStorage: learner's sound-effects preference, 'true' | 'false'. */
export const SOUND_ENABLED = 'praxis_sound_enabled'
