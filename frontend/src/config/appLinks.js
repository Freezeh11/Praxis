/**
 * Outbound links and contact addresses the app shows, in one place.
 *
 * A URL or an address never belongs inline at a call site: moving where feedback
 * goes must be a change here only.
 */

/**
 * The plain-mail alternative shown on the contact page.
 *
 * Empty by default. The in-app form is the primary route and needs no address;
 * set this (for example 'hello@praxis.app') and /contact renders a mailto row.
 * The form keeps working either way, so a missing address is never a dead end.
 */
export const CONTACT_EMAIL = ''
