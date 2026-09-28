/**
 * @file tutorialTargets.js
 * @description Owns every `[data-tutorial=...]` obstacle selector the coach card
 * must dodge, and the named anchor zones mapping a declared placement to a side.
 */

/** Every control the learner may need while a tutorial step is on screen. */
export const TUTORIAL_OBSTACLE_SELECTORS = [
  '[data-tutorial="canvas"] [data-path]',
  '[data-tutorial="not-capsule"]',
  '[data-tutorial^="law-card-"]',
  '[data-tutorial^="step-history-card-"]',
  '[data-tutorial="hint-button"]',
  '[data-tutorial="guide-button"]',
  '[data-tutorial="laws-reference-button"]',
  '[data-tutorial="undo-button"]',
  '[data-tutorial="reset-button"]',
  '[data-tutorial="reopen-score-btn"]',
  '[data-tutorial="next-stage-btn"]',
  '[data-tutorial="review-derivation-btn"]',
  '[data-tutorial="assistance-group"]',
  '[data-tutorial="points-and-assistance"]',
  '[data-tutorial="undo-reset-group"]',
  '[data-tutorial="new-expression-next-btn"]',
  '[data-tutorial="randomize-next-btn"]',
  '[data-tutorial="score-modal"] button',
  'button[title*="grip" i]',
]

/** The same obstacle list as one CSS selector string. */
export const CARD_OBSTACLE_SELECTOR = TUTORIAL_OBSTACLE_SELECTORS.join(',')

/** Declared anchor zones → the side of the target the card should prefer. */
export const CARD_ANCHOR_ZONES = {
  'workspace-bottom-left': { side: 'bottom', align: 'start' },
  'bottom-left': { side: 'bottom', align: 'start' },
  'workspace-top-left': { side: 'top', align: 'start' },
  'top-left': { side: 'top', align: 'start' },
  'workspace-top-right': { side: 'top', align: 'end' },
  'top-right': { side: 'top', align: 'end' },
  'workspace-bottom-right': { side: 'bottom', align: 'end' },
  'bottom-right': { side: 'bottom', align: 'end' },
}
