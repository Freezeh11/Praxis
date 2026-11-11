/**
 * Terms of use copy for the auth pages' "Terms and Conditions" dialog.
 *
 * Plain data so the dialog stays presentational: every section has a stable `id`
 * (list anchor + React key), a `title`, one or more `paragraphs` and optional
 * `bullets`. Edit the copy here, never inside the dialog component.
 */
export const LAST_UPDATED = 'November 11, 2026'

export const TERMS_SECTIONS = [
  {
    id: 'acceptance',
    title: 'Acceptance',
    paragraphs: [
      'Praxis is a learning tool for Boolean algebra and digital logic: lessons, law cards and circuit puzzles that you work through at your own pace.',
      'These terms are the agreement between you and Praxis for using the app. By creating an account, signing in, or continuing past the sign-in screen, you confirm that you have read them and accept them. If you do not accept them, please do not create an account.',
    ],
  },
  {
    id: 'accounts-and-security',
    title: 'Accounts and security',
    paragraphs: [
      'One Praxis account holds your name, your email address and your password. You are responsible for keeping that password confidential and for everything that happens under your account.',
    ],
    bullets: [
      'Use an email address you control. It is how you sign in and how a locked account is recovered.',
      'Do not share your password with anyone; Praxis staff will never ask you for it.',
      'Tell us promptly if you believe someone else has accessed your account.',
    ],
  },
  {
    id: 'acceptable-use',
    title: 'Acceptable use',
    paragraphs: [
      'Praxis is for personal learning, and for classroom use organised by an instructor.',
    ],
    bullets: [
      'Do not scrape, copy or resell the lesson content, levels, worked solutions or answer keys.',
      'Do not automate puzzle solving, or use the app to present machine-generated answers as your own work.',
      'Do not attempt to disrupt the service, overload its servers or bypass access controls.',
    ],
  },
  {
    id: 'your-learning-data',
    title: 'Your learning data',
    paragraphs: [
      'Your progress (completed levels, stars, streaks, stage results and circuit attempts) is stored with your account so you can pick up where you left off on any device.',
    ],
    bullets: [
      'Your name and email are used to identify your account and to sign you in.',
      'Your practice history is used to show you progress, mastery and streak information.',
      'You can ask for a copy of your learning data, or for your account and its data to be deleted, at any time.',
    ],
  },
  {
    id: 'intellectual-property',
    title: 'Intellectual property',
    paragraphs: [
      'The lessons, law cards, level puzzles, interface and code that make up Praxis belong to Praxis and its authors. These terms do not transfer ownership of any of it to you.',
      'Circuits and expressions you build yourself remain yours. By submitting an answer you allow Praxis to check it and record the result against your account.',
    ],
  },
  {
    id: 'availability-and-changes',
    title: 'Availability and changes',
    paragraphs: [
      'Praxis is a small, actively developed app. Levels, features and these terms may change as it improves.',
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
      'Questions about these terms, or requests about your learning data, can be raised from the support option in your account, or in reply to any email Praxis has sent you.',
      'We aim to respond within a few working days.',
    ],
  },
]
