/**
 * @file tutorialContent.js
 * @description Curated multi-stage interactive tutorial definitions for Praxis.
 * Contains the welcome modal slide sequence and step-by-step interactive guidance
 * aligned with the law-first workflow: choose a law, select target(s), then press Apply.
 */

/**
 * @typedef {Object} WelcomeSlide
 * @property {string} title Main header
 * @property {string} body Primary explanatory body text
 * @property {string} footer Secondary prompt text
 * @property {string} buttonText Action button text
 */

/**
 * Welcome modal 2-slide introductory deck
 * @type {WelcomeSlide[]}
 */
export const WELCOME_SLIDES = [
  {
    title: 'Welcome to Praxis!',
    body: 'Praxis is an interactive workspace designed for simplifying Boolean algebra expressions step-by-step.',
    footer: 'Before we dive into that, let’s get familiar with the basics of our system first!',
    buttonText: 'Continue →',
  },
  {
    title: 'Interactive Simplification',
    body: 'Simplify expressions in three steps: choose a law from the palette, select the matching terms or variables, then press Apply.',
    footer: 'Try solving this first equation.',
    buttonText: 'Start →',
  },
]

/**
 * @typedef {Object} TutorialStep
 * @property {string} id Unique step identifier
 * @property {string} title Step title header
 * @property {string} desc Instructional text explaining the interaction
 * @property {string} target Selector for the DOM element to highlight (e.g. '[data-tutorial="term-0"]')
 * @property {string} [secondaryTarget] Optional secondary selector to spotlight simultaneously
 * @property {'button' | 'choose_law' | 'select' | 'select_var' | 'select_both' | 'swap' | 'click_not' | 'apply_law' | 'click_review' | 'next_stage' | 'finish'} actionType
 * @property {string} [lawId] Expected law id when actionType is 'choose_law'
 * @property {string[]} [expectedPaths] Required selection paths before advancing selection steps
 * @property {string} [buttonText] Custom button text for button-gated steps
 * @property {string} [expectedLaw] Expected law name when actionType is 'apply_law'
 * @property {boolean} [noOverlay] Disables spotlight backdrop/blocking for free-solve steps
 * @property {'top' | 'bottom' | 'left' | 'right' | 'center'} [tooltipPosition] Placement relative to target
 * @property {string | Object} [position] Named workspace anchor zone or explicit coordinates
 */

/**
 * Stage-by-stage interactive tutorial steps
 * @type {Record<number, TutorialStep[]>}
 */
export const TUTORIAL_STAGES = {
  // ── Stage 0 (T1): Law-First Workflow, Selection Mechanics & Points Economy ──
  0: [
    {
      id: 'choose-absorption',
      title: 'Step 1: Choose a Law',
      desc: 'In Praxis, simplifying starts in the Law Palette. Click Absorption Law (A + AB = A) to choose the law you want to apply.',
      target: '[data-law-id="absorption"]',
      actionType: 'choose_law',
      lawId: 'absorption',
      tooltipPosition: 'top',
    },
    {
      id: 'select-variable',
      title: 'Step 2: Pick the First Target',
      desc: 'With Absorption Law chosen, select its targets on the canvas. Click the lone variable "x" to highlight it.',
      target: '[data-tutorial="term-0"]',
      actionType: 'select_var',
      expectedPaths: ['R.0'],
      tooltipPosition: 'bottom',
    },
    {
      id: 'select-term',
      title: 'Selecting an Entire Term',
      desc: 'Nice! Now click the second term "xy" (or its floating ⠿ handle above it) to select the whole term.',
      target: '[data-tutorial="term-1"]',
      actionType: 'select_both',
      expectedPaths: ['R.0', 'R.1'],
      tooltipPosition: 'bottom',
    },
    {
      id: 'highlight-equation',
      title: 'Ready to Simplify',
      desc: 'Absorption Law is chosen and both parts of "x + xy" are selected! Notice how this matches A + AB = A, where the shorter term absorbs the longer one.',
      target: '[data-tutorial="canvas"]',
      actionType: 'button',
      buttonText: 'Continue to Apply →',
      tooltipPosition: 'bottom',
    },
    {
      id: 'apply-absorption',
      title: 'Step 3: Apply the Law',
      desc: 'Click "Apply Absorption Law" in the palette header to absorb "xy" and simplify the expression down to "x".',
      target: '[data-tutorial="apply-law"]',
      actionType: 'apply_law',
      expectedLaw: 'Absorption Law',
      tooltipPosition: 'top',
    },
    {
      id: 't1-score-intro',
      title: 'Stage 1 Solved & Score Breakdown',
      desc: 'Great job! Whenever you solve an expression, your score summary appears detailing your efficiency, target law usage, and total points earned (10 base + up to 5 performance bonus = up to +15 pts).',
      target: '[data-tutorial="score-modal"]',
      actionType: 'button',
      buttonText: 'Inspect Workspace →',
    },
    {
      id: 't1-close-summary-prompt',
      title: 'Review Derivation & Workspace',
      desc: 'Click "Review Completed Derivation" below to dismiss the score modal so we can explore the points system and workspace tools.',
      target: '[data-tutorial="review-derivation-btn"]',
      actionType: 'click_review',
    },
    {
      id: 't1-points-intro',
      title: 'Points, Hints & Guides',
      desc: 'Each stage you clear awards 10 base points plus up to 5 bonus points for high efficiency (up to +15 Points total). Spend 20 points on "Guide" to pre-select the next law and highlight its target items on canvas, or use "Hint" for a free clue (using assistance reduces your Assistance use score).',
      target: '[data-tutorial="points-and-assistance"]',
      actionType: 'button',
      buttonText: 'Next →',
      tooltipPosition: 'left',
    },
    {
      id: 't1-undo-reset-intro',
      title: 'Undo & Reset Controls',
      desc: 'Made a misstep or want to test another path? Click "↶ Undo" to revert the last move, or "↺ Reset" to restore the initial equation at any time.',
      target: '[data-tutorial="undo-reset-group"]',
      actionType: 'button',
      buttonText: 'Next →',
      tooltipPosition: 'bottom',
    },
    {
      id: 't1-reopen-score-reminder',
      title: 'Reopening Score Summary',
      desc: 'Need to review your efficiency, target laws, or score breakdown again? You can reopen the score summary modal at any time by clicking "Score Summary" in the bottom dock.',
      target: '[data-tutorial="reopen-score-btn"]',
      actionType: 'button',
      buttonText: 'Next →',
      tooltipPosition: 'top',
    },
    {
      id: 't1-next-stage-prompt',
      title: 'Reviewing & Advancing',
      desc: 'Take your time to review your derivation steps in the history panel. When you are ready to advance to Stage 2 (where we explore term reordering and factoring), click "Next Stage →" in the dock!',
      target: '[data-tutorial="next-stage-btn"]',
      actionType: 'finish',
      buttonText: 'Okay',
      tooltipPosition: 'top',
    },
  ],

  // ── Stage 1 (T2): Commutative Reordering & Step History Inspection ─────────
  1: [
    {
      id: 'drag-intro',
      title: 'Commutative Law & Reordering',
      desc: 'In Boolean algebra, terms can be reordered freely (A + B = B + A). You can drag terms at any time, even before choosing a law, to organize longer expressions.',
      target: '[data-tutorial="canvas"]',
      actionType: 'button',
      buttonText: 'Let’s Try It →',
      tooltipPosition: 'bottom',
    },
    {
      id: 'drag-action',
      title: 'Try Dragging Term "xy"',
      desc: 'Grab the term "xy" by its grip handle and drag it to the left of "z" to see how you can arrange your workspace.',
      target: '[data-tutorial="term-2"]',
      secondaryTarget: '[data-tutorial="term-1"]',
      actionType: 'swap',
      tooltipPosition: 'bottom',
    },
    {
      id: 'choose-distributive',
      title: 'Choose Distributive Law',
      desc: 'Now that "x\'y" and "xy" are side by side, choose "Distributive (Factoring & Dual)" from the palette to factor out their common variable.',
      target: '[data-law-id="distributive"]',
      actionType: 'choose_law',
      lawId: 'distributive',
      tooltipPosition: 'top',
    },
    {
      id: 'select-common-factor',
      title: 'Spot the Common Factor',
      desc: 'Both "x\'y" and "xy" share the variable "y". Click the letter "y" in each term to select them for factoring.',
      target: '[data-path="R.0.1"]',
      secondaryTarget: '[data-path="R.1.1"]',
      actionType: 'select_both',
      expectedPaths: ['R.0.1', 'R.1.1'],
      tooltipPosition: 'bottom',
    },
    {
      id: 'apply-distributive-factor',
      title: 'Factor Out "y"',
      desc: 'With both "y" variables selected, press "Apply Distributive (Factoring & Dual)" to factor out "y", leaving y(x\' + x).',
      target: '[data-tutorial="apply-law"]',
      actionType: 'apply_law',
      expectedLaw: 'Distributive (Factor)',
      tooltipPosition: 'top',
    },
    {
      id: 'choose-complement',
      title: 'Choose Complement Law',
      desc: 'Next, choose "Complement Law" (A + A\' = 1) from the palette to simplify the opposite pair inside the parentheses.',
      target: '[data-law-id="complement"]',
      actionType: 'choose_law',
      lawId: 'complement',
      tooltipPosition: 'top',
    },
    {
      id: 'select-opposites',
      title: 'Pair the Opposites',
      desc: 'Inside the parentheses, click both "x\'" and "x" to select the complementary opposites.',
      target: '[data-path="R.0.1.0"]',
      secondaryTarget: '[data-path="R.0.1.1"]',
      actionType: 'select_both',
      expectedPaths: ['R.0.1.0', 'R.0.1.1'],
      tooltipPosition: 'bottom',
    },
    {
      id: 'apply-complement',
      title: 'Apply Complement Law',
      desc: 'Opposites in OR always evaluate to 1 (x\' + x = 1). Press "Apply Complement Law" to simplify (x\' + x) to 1.',
      target: '[data-tutorial="apply-law"]',
      actionType: 'apply_law',
      expectedLaw: 'Complement Law',
      tooltipPosition: 'top',
    },
    {
      id: 'choose-identity',
      title: 'Choose Identity Law',
      desc: 'Now choose "Identity Law" (A · 1 = A) from the palette to remove the redundant constant "1".',
      target: '[data-law-id="identity"]',
      actionType: 'choose_law',
      lawId: 'identity',
      tooltipPosition: 'top',
    },
    {
      id: 'select-identity-const',
      title: 'Select Constant "1"',
      desc: 'Anything multiplied by 1 is itself (A · 1 = A). Click the constant "1" to select it.',
      target: '[data-path="R.0.1"]',
      actionType: 'select_var',
      expectedPaths: ['R.0.1'],
      tooltipPosition: 'bottom',
    },
    {
      id: 'apply-identity',
      title: 'Apply Identity Law',
      desc: 'Press "Apply Identity Law" to eliminate "1" and complete your simplification to "y + z".',
      target: '[data-tutorial="apply-law"]',
      actionType: 'apply_law',
      expectedLaw: 'Identity Law',
      tooltipPosition: 'top',
    },
    {
      id: 't2-score-intro',
      title: 'Stage 2 Solved & Score Breakdown',
      desc: 'Nicely simplified! Notice how applying the factoring path earned points for both Efficiency and Target Law usage.',
      target: '[data-tutorial="score-modal"]',
      actionType: 'button',
      buttonText: 'Inspect Workspace →',
    },
    {
      id: 't2-close-summary-prompt',
      title: 'Review Derivation & Workspace',
      desc: 'Click "Review Completed Derivation" below to dismiss the score modal so we can inspect the step history and connection reasoning.',
      target: '[data-tutorial="review-derivation-btn"]',
      actionType: 'click_review',
    },
    {
      id: 't2-history-intro',
      title: 'Step History & Step Inspection',
      desc: 'Every derivation step you make is recorded in the Step History panel on the left. You can click on any step card in the history panel OR on any connection line in your workspace to inspect the exact law and reasoning behind that transition!',
      target: '[data-tutorial="step-history-panel"]',
      actionType: 'finish',
      buttonText: 'Okay',
      position: 'workspace-top-left',
    },
  ],

  // ── Stage 2 (T3): Negation Capsules & De Morgan's Law ─────────────────────
  2: [
    {
      id: 'not-intro',
      title: 'Negated Groups (or NOT Capsules)',
      desc: 'When an entire parenthesized expression is inverted, like (x + y)\', Praxis groups it under a shared overline bar, highlighted in yellow on hover.',
      target: '[data-tutorial="canvas"]',
      actionType: 'button',
      buttonText: 'Show Me →',
      tooltipPosition: 'bottom',
    },
    {
      id: 'choose-demorgan',
      title: "Choose De Morgan's Law",
      desc: 'First, choose "De Morgan\'s Law" from the palette so we can expand the negated group.',
      target: '[data-law-id="demorgan"]',
      actionType: 'choose_law',
      lawId: 'demorgan',
      tooltipPosition: 'top',
    },
    {
      id: 'click-not-capsule',
      title: 'Select the Negation Bar',
      desc: 'Click the overline bar above "(x + y)\'" to select the negated group.',
      target: '[data-tutorial="not-capsule"]',
      actionType: 'click_not',
      expectedPaths: ['R.0'],
      tooltipPosition: 'bottom',
    },
    {
      id: 'apply-demorgan',
      title: "Expand with De Morgan's Law",
      desc: "Press \"Apply De Morgan's Law\" to expand the inverted sum into \"x'y'\".",
      target: '[data-tutorial="apply-law"]',
      actionType: 'apply_law',
      expectedLaw: "De Morgan's Law",
      tooltipPosition: 'top',
    },
    {
      id: 'choose-idempotent',
      title: 'Choose Idempotent Law',
      desc: 'Now choose "Idempotent Law" (A + A = A) from the palette to merge the duplicate terms.',
      target: '[data-law-id="idempotent"]',
      actionType: 'choose_law',
      lawId: 'idempotent',
      tooltipPosition: 'top',
    },
    {
      id: 'select-duplicate-terms',
      title: 'Select Duplicate Terms',
      desc: 'Click the grip handles (⠿) or capsule edges of both identical "x\'y\'" terms to select both whole terms.',
      target: '[data-tutorial="term-0"]',
      secondaryTarget: '[data-tutorial="term-1"]',
      actionType: 'select_both',
      expectedPaths: ['R.0', 'R.1'],
      tooltipPosition: 'bottom',
    },
    {
      id: 'apply-idempotent',
      title: 'Merge Identical Terms',
      desc: 'Press "Apply Idempotent Law" to eliminate the redundant term and complete the simplification.',
      target: '[data-tutorial="apply-law"]',
      actionType: 'apply_law',
      expectedLaw: 'Idempotent Law',
      tooltipPosition: 'top',
    },
    {
      id: 't3-score-intro',
      title: 'Stage 3 Solved & Score Breakdown',
      desc: "Excellent work! Expanding negation capsules with De Morgan's Law and eliminating duplicates with Idempotent Law simplified the expression cleanly.",
      target: '[data-tutorial="score-modal"]',
      actionType: 'button',
      buttonText: 'Inspect Workspace →',
    },
    {
      id: 't3-close-summary-prompt',
      title: 'Review Derivation & Workspace',
      desc: 'Click "Review Completed Derivation" to return to the workspace and review your steps.',
      target: '[data-tutorial="review-derivation-btn"]',
      actionType: 'click_review',
    },
    {
      id: 't3-complete',
      title: 'Reviewing & Advancing',
      desc: 'Take your time to review your steps in the history panel. When you are ready for the final Efficiency Challenge (Stage 4), click "Next Stage →" in the dock!',
      target: '[data-tutorial="next-stage-btn"]',
      actionType: 'finish',
      buttonText: 'Okay',
      tooltipPosition: 'top',
    },
  ],

  // ── Stage 3 (T4): Efficiency Challenge, Assistance & Free Practice ───────
  3: [
    {
      id: 'challenge-intro',
      title: 'Efficiency Challenge & Strategic Choice',
      desc: 'Now test your skills on "x + x\'y + xy"! Multiple simplification paths exist, but choosing the most strategic laws will help you find the shortest derivation. Aim for a 100% Efficiency score!',
      target: '[data-tutorial="canvas"]',
      actionType: 'button',
      buttonText: 'Show Assistance Tools →',
      tooltipPosition: 'bottom',
    },
    {
      id: 'assistance-intro',
      title: 'Need Help? Hints & Guides',
      desc: 'If you ever feel stuck, click "Hint" for a contextual clue. When you need direct direction, spend 20 points on "Guide" to pre-select the next law and highlight its target items on the canvas!',
      target: '[data-tutorial="assistance-group"]',
      actionType: 'button',
      buttonText: 'Start Solving →',
      position: 'workspace-top-right',
    },
    {
      id: 'challenge-solve',
      title: 'Simplify the Expression',
      desc: 'Choose a law from the palette, select its target terms or variables, then press Apply. The tutorial will adapt to whichever path you choose!',
      target: '[data-tutorial="canvas"]',
      actionType: 'apply_law',
      noOverlay: true,
      position: 'workspace-bottom-left',
      tooltipPosition: 'bottom',
    },
    {
      id: 't4-score-intro',
      title: 'Challenge Solved & Score Breakdown',
      desc: 'Great job! Your score summary shows how your path choices affected your Efficiency score and points earned.',
      target: '[data-tutorial="score-modal"]',
      actionType: 'button',
      buttonText: 'Inspect Workspace →',
    },
    {
      id: 't4-close-summary-prompt',
      title: 'Review Your Challenge Solution',
      desc: 'Click "Review Completed Derivation" to review your derivation before concluding the tutorial.',
      target: '[data-tutorial="review-derivation-btn"]',
      actionType: 'click_review',
    },
    {
      id: 'challenge-complete',
      title: 'Tutorial Complete!',
      desc: 'You’ve learned the full workflow: choosing a law from the palette, selecting variables, whole terms, or negation capsules, inspecting step history, and making strategic law choices. You’re ready for Level 1!',
      target: '[data-tutorial="canvas"]',
      actionType: 'finish',
      buttonText: 'Enter Level 1 →',
      tooltipPosition: 'bottom',
    },
  ],
}
