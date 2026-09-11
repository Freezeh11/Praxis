/**
 * @file tutorialData.js
 * @description Curated multi-stage interactive tutorial definitions for Praxis.
 * Contains the welcome modal slide sequence and step-by-step interactive guidance.
 */

/**
 * @typedef {Object} WelcomeSlide
 * @property {string} icon Badge icon emoji
 * @property {string} badge Uppercase category tag
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
    icon: '✨',
    badge: 'WELCOME TO PRAXIS',
    title: 'Welcome to Praxis!',
    body: 'Praxis is an interactive workspace designed for simplifying Boolean algebra expressions step-by-step.',
    footer: 'Before we dive into that, let’s get familiar with the basics of our system first!',
    buttonText: 'Continue →',
  },
  {
    icon: '👆',
    badge: 'CORE MECHANICS',
    title: 'Interactive Simplification',
    body: 'Praxis is designed to allow you to interact with Boolean expressions in an interactive way.',
    footer: 'Try solving this equation.',
    buttonText: 'Start →',
  },
]

/**
 * @typedef {Object} TutorialStep
 * @property {string} id Unique step identifier
 * @property {string} title Step title header
 * @property {string} desc Instructional text explaining the interaction
 * @property {string} target Selector for the DOM element to highlight (e.g. '[data-tutorial="term-0"]')
 * @property {'button' | 'select' | 'select_both' | 'swap' | 'click_not' | 'apply_law' | 'next_stage' | 'finish'} actionType
 * @property {string} [buttonText] Custom button text for button-gated steps
 * @property {string} [expectedLaw] Expected law name when actionType is 'apply_law'
 * @property {'top' | 'bottom' | 'left' | 'right' | 'center'} [tooltipPosition] Placement relative to target
 */

/**
 * Stage-by-stage interactive tutorial steps
 * @type {Record<number, TutorialStep[]>}
 */
export const TUTORIAL_STAGES = {
  // ── Stage 0 (T1): Selection Mechanics, Laws Dock & Points Economy ──────────
  0: [
    {
      id: 'select-variable',
      title: 'Let’s Pick a Variable',
      desc: 'In Praxis, simplifying starts with selection. Click on the lone variable "x" to highlight it.',
      target: '[data-tutorial="term-0"]',
      actionType: 'select_var',
      tooltipPosition: 'bottom',
    },
    {
      id: 'select-term',
      title: 'Selecting an Entire Term',
      desc: 'Nice! Now click the second term "xy" (or its floating ⠿ handle above it) to select the whole term.',
      target: '[data-tutorial="term-1"]',
      actionType: 'select_both',
      tooltipPosition: 'bottom',
    },
    {
      id: 'highlight-equation',
      title: 'Ready to Simplify',
      desc: 'Both parts of "x + xy" are selected! Notice how this matches the Absorption Law (A + AB = A), where the shorter term absorbs the longer one.',
      target: '[data-tutorial="canvas"]',
      actionType: 'button',
      buttonText: 'View Laws Dock →',
      tooltipPosition: 'bottom',
    },
    {
      id: 'apply-absorption',
      title: 'Apply the Absorption Law',
      desc: 'Click Absorption Law in your laws dock below to absorb "xy" and simplify the expression down to "x".',
      target: '[data-tutorial="law-card-0"]',
      actionType: 'apply_law',
      expectedLaw: 'Absorption Law',
      position: 'workspace-bottom-left',
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
      desc: 'Click "🔍 Review Completed Derivation" below to dismiss the score modal so we can explore the points system and workspace tools.',
      target: '[data-tutorial="review-derivation-btn"]',
      actionType: 'click_review',
    },
    {
      id: 't1-points-intro',
      title: 'Points, Hints & Guides',
      desc: 'Each stage you clear awards 10 base points plus up to 5 bonus points for high efficiency (up to +15 Points total). You can spend 20 points on "🎯 Guide" to highlight exact candidate terms on canvas when stuck. "💡 Hint" gives a free conceptual clue, but using hints reduces your Hint Independence score metric!',
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
      desc: 'Need to review your efficiency, target laws, or score breakdown again? You can reopen the score summary modal at any time by clicking "📊 Score Summary" in the bottom dock.',
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
      desc: 'In Boolean algebra, terms can be reordered freely (A + B = B + A). While not required for solving, dragging terms is a handy way to visually organize longer expressions.',
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
      id: 'select-common-factor',
      title: 'Spot the Common Factor',
      desc: 'Both "x\'y" and "xy" share the variable "y". Click the letter "y" in each term to select them for factoring.',
      target: '[data-path="R.0.1"]',
      secondaryTarget: '[data-path="R.1.1"]',
      actionType: 'select_both',
      tooltipPosition: 'bottom',
    },
    {
      id: 'apply-distributive-factor',
      title: 'Factor Out "y"',
      desc: 'With both "y" variables selected, click "Distributive (Factor)" in your laws dock to factor out "y", leaving y(x\' + x).',
      target: '[data-tutorial="law-card-0"]',
      actionType: 'apply_law',
      expectedLaw: 'Distributive (Factor)',
      position: 'workspace-bottom-left',
    },
    {
      id: 'select-opposites',
      title: 'Pair the Opposites',
      desc: 'Inside the parentheses, click both "x\'" and "x" to select the complementary opposites.',
      target: '[data-path="R.0.1.0"]',
      secondaryTarget: '[data-path="R.0.1.1"]',
      actionType: 'select_both',
      tooltipPosition: 'bottom',
    },
    {
      id: 'apply-complement',
      title: 'Apply Complement Law',
      desc: 'Opposites in OR always evaluate to 1 (x\' + x = 1). Click Complement Law in your laws dock to simplify (x\' + x) to 1.',
      target: '[data-tutorial="law-card-0"]',
      actionType: 'apply_law',
      expectedLaw: 'Complement Law',
      position: 'workspace-bottom-left',
    },
    {
      id: 'select-identity-const',
      title: 'Select Constant "1"',
      desc: 'Anything multiplied by 1 is itself (A · 1 = A). Click the constant "1" to select it.',
      target: '[data-path="R.0.1"]',
      actionType: 'select_var',
      tooltipPosition: 'bottom',
    },
    {
      id: 'apply-identity',
      title: 'Apply Identity Law',
      desc: 'Click Identity Law (A · 1 = A) in your laws dock to eliminate "1" and complete your simplification to "y + z".',
      target: '[data-tutorial="law-card-0"]',
      actionType: 'apply_law',
      expectedLaw: 'Identity Law',
      position: 'workspace-bottom-left',
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
      desc: 'Click "🔍 Review Completed Derivation" below to dismiss the score modal so we can inspect the step history and connection reasoning.',
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
      desc: 'When an entire parenthesized expression is inverted, like (x + y)\', Praxis groups it under a shared overline bar, indicated by a yellow highlight box when hovering over it.',
      target: '[data-tutorial="canvas"]',
      actionType: 'button',
      buttonText: 'Show Me →',
      tooltipPosition: 'bottom',
    },
    {
      id: 'click-not-capsule',
      title: 'Select the Negation Bar',
      desc: 'Click the overline bar above "(x + y)\'" to focus expansion rules.',
      target: '[data-tutorial="not-capsule"]',
      actionType: 'click_not',
      tooltipPosition: 'bottom',
    },
    {
      id: 'apply-demorgan',
      title: "Expand with De Morgan's Law",
      desc: "Click De Morgan's (OR→AND) in your laws dock to expand the inverted sum into \"x'y'\".",
      target: '[data-tutorial="law-card-0"]',
      actionType: 'apply_law',
      expectedLaw: "De Morgan's (OR→AND)",
      position: 'workspace-bottom-left',
    },
    {
      id: 'select-duplicate-terms',
      title: 'Select Duplicate Terms',
      desc: 'Click the grip handles (⠿) or bodies of both identical "x\'y\'" terms to select them.',
      target: '[data-tutorial="term-0"]',
      secondaryTarget: '[data-tutorial="term-1"]',
      actionType: 'select_both',
      tooltipPosition: 'bottom',
    },
    {
      id: 'apply-idempotent',
      title: 'Merge Identical Terms',
      desc: 'Click Idempotent Law (A + A = A) in your laws dock to eliminate the redundant term.',
      target: '[data-tutorial="law-card-0"]',
      actionType: 'apply_law',
      expectedLaw: 'Idempotent Law',
      position: 'workspace-bottom-left',
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
      desc: 'Click "🔍 Review Completed Derivation" to return to the workspace and review your steps.',
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
      desc: 'If you ever feel stuck, click "💡 Hint" for a contextual clue. When you need direct direction, spend 20 points on "🎯 Guide" to highlight exact candidate items on the canvas!',
      target: '[data-tutorial="assistance-group"]',
      actionType: 'button',
      buttonText: 'Start Solving →',
      position: 'workspace-top-right',
    },
    {
      id: 'challenge-solve',
      title: 'Simplify the Expression',
      desc: 'Select terms or variables and apply your chosen laws. The tutorial will adapt to whichever path you choose!',
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
      desc: 'Click "🔍 Review Completed Derivation" to review your derivation before concluding the tutorial.',
      target: '[data-tutorial="review-derivation-btn"]',
      actionType: 'click_review',
    },
    {
      id: 'challenge-complete',
      title: 'Tutorial Complete! 🎉',
      desc: 'You’ve learned all core mechanics: selecting variables and whole terms, factoring, negation capsules, step history inspection, and strategic law choices. You’re ready for Level 1!',
      target: '[data-tutorial="canvas"]',
      actionType: 'finish',
      buttonText: 'Enter Level 1 →',
      tooltipPosition: 'bottom',
    },
  ],
}

