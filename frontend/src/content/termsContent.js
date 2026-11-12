/**
 * Terms of use copy for the auth pages' "Terms and Conditions" dialog.
 *
 * Plain data so the dialog stays presentational: every section has a stable `id`
 * (list anchor + React key), a `title`, one or more `paragraphs` and optional
 * `bullets`. Edit the copy here, never inside the dialog component.
 *
 * Keep this file aligned with the product as it is actually specified and built:
 * - docs/01-product/SRS.md (functional requirements, star rules, level unlocking)
 * - docs/Software Proposal Writing Guide (LAWS) v2.0.docx.md (scope, Guide system,
 *   three-level progression, Law Reference, dual-mode selection)
 * - frontend/src/config/gameRules.js (every number quoted below)
 * If a rule changes in gameRules.js or the SRS, change it here in the same commit.
 */
export const LAST_UPDATED = 'November 12, 2026'

export const TERMS_SECTIONS = [
  {
    id: 'acceptance',
    title: 'What Praxis is',
    paragraphs: [
      'Praxis is an interactive web-based trainer for Boolean algebra simplification, built for first-year CCS students taking digital logic and discrete mathematics. You simplify two-, three- and four-variable expressions one law at a time, using the ten Boolean equivalence laws, worded hints and a Guide you can buy with earned points.',
      'The practice is strictly algebraic. Praxis does not cover Karnaugh maps, truth-table construction, combinational circuit design, sequential logic or hardware description languages, and it offers no instructor dashboards, institutional grading or curriculum management.',
      'These terms are the agreement between you and the Praxis team for using the app. By creating an account, signing in, or continuing past the sign-in screen, you confirm that you have read them and accept them. If you do not accept them, please do not create an account.',
    ],
  },
  {
    id: 'accounts-and-security',
    title: 'Accounts and security',
    paragraphs: [
      'One Praxis account holds your display name and email address. Passwords are handled by our authentication provider, Supabase, which stores only a hash; the app never keeps your password in plain text or in browser storage. You are responsible for keeping your password confidential and for everything that happens under your account.',
    ],
    bullets: [
      'Use an email address you control. It is how you sign in and how a locked account is recovered.',
      'Do not share your password with anyone; the Praxis team will never ask you for it.',
      'Tell us promptly if you believe someone else has accessed your account.',
    ],
  },
  {
    id: 'acceptable-use',
    title: 'Acceptable use',
    paragraphs: [
      'Praxis is for personal, self-directed learning. An instructor may point a class to it, but the app itself has no classroom dashboard, gradebook integration or group management.',
    ],
    bullets: [
      'Do not scrape, copy or resell the law cards, level puzzles, hint or guide text, worked solutions or answer keys.',
      'Do not automate puzzle solving, or present machine-generated answers as your own work.',
      'Do not bypass the level order, tamper with scores or points, or attempt to overload the service or its servers.',
    ],
  },
  {
    id: 'points-levels-and-stars',
    title: 'Levels, points and stars',
    paragraphs: [
      'Level 1 uses two-variable expressions, Level 2 uses three-variable expressions and Level 3 uses four-variable expressions. A level opens once the previous level averages at least 80% across its stages. Each completed stage pays 10 points, plus up to 5 bonus points for a perfect score, and earns one to three stars from its score.',
    ],
    bullets: [
      'A stage score of 90 or above earns three stars; 75 or above earns two; any completion earns one.',
      'A Guide costs 20 points and highlights the literals or terms involved in a correct move without revealing which move to make. Worded hints are free.',
      'Using hints or the Guide lowers the hint-independence part of that stage score.',
      'Sandbox practice never records points, stars, scores or progress.',
    ],
  },
  {
    id: 'your-learning-data',
    title: 'Your learning data',
    paragraphs: [
      'Your progress is stored with your account so you can continue on another device: points, completed stages, best stage scores and stars, tutorial completion, and a history of submitted scores with the steps, laws, hints and guide uses of each attempt.',
    ],
    bullets: [
      'Your display name and email identify your account and sign you in.',
      'Stage scores and score history are used to show progress, stars, mastery and level unlocks.',
      'Final expressions you solve may also be kept on this device so a puzzle can be restored without a network connection.',
      'You can ask the Praxis team for a copy of your learning data, or for your account and its data to be deleted, at any time. Deleting the account also deletes its progress, scores and history.',
    ],
  },
  {
    id: 'intellectual-property',
    title: 'Intellectual property',
    paragraphs: [
      'The ten Boolean law cards, level puzzles, hint and guide text, interface and code that make up Praxis belong to the Praxis team and its authors. These terms do not transfer ownership of any of it to you.',
      'Expressions you build yourself remain yours. By submitting an answer you allow Praxis to check it and record the result against your account.',
    ],
  },
  {
    id: 'availability-and-changes',
    title: 'Availability and changes',
    paragraphs: [
      'Praxis is a student-built project under active development. Levels, features and these terms may change as it improves.',
    ],
    bullets: [
      'The service may be unavailable while it is updated or maintained; continuous uptime is not guaranteed.',
      'The date at the top of this dialog is the date of the version you are reading.',
      'Continuing to use Praxis after a change means you accept the updated terms.',
    ],
  },
  {
    id: 'contact',
    title: 'Contact',
    paragraphs: [
      'Questions about these terms, or requests about your learning data, can be sent through the feedback survey in the app header, or in reply to any email from the Praxis team.',
      'We aim to respond within a few working days.',
    ],
  },
]
