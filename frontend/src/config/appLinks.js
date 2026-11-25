/**
 * Outbound links and contact addresses the app shows, in one place.
 *
 * A URL or an address never belongs inline at a call site: moving where feedback
 * goes must be a change here only.
 */

/**
 * The learner survey, hosted as a Google Docs form.
 *
 * Every feedback entry point (header button, landing banner, billboard, profile)
 * opens it in a new tab: the survey can be edited, and its response sheet
 * exported, without a deploy, and nothing a learner types there reaches Praxis.
 */
export const SURVEY_URL =
  'https://docs.google.com/forms/d/1P4O0MdbQUAUGz-xNL-neMHX5ukDuLTjCq-nXpEaFdb8/viewform?edit_requested=true'

/**
 * The plain-mail alternative shown on the in-app contact page.
 *
 * Empty by default. The contact page is a support route, not the survey; set this
 * (for example 'hello@praxis.app') and /contact renders a mailto row. The form
 * keeps working either way, so a missing address is never a dead end.
 */
export const CONTACT_EMAIL = ''
