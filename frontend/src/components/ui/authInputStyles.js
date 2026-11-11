/**
 * Shared auth-input styling, kept out of the component files so react-refresh stays
 * happy. `border` replaces the default border/focus utilities (kept for callers that
 * need a custom state); `padLeft` reserves room for a leading field icon; `padRight`
 * reserves room for the password reveal button; `invalid` swaps the border/focus
 * colour to the danger pairing.
 *
 * Colours follow the auth design-system input token exactly: a slate-100 well that
 * resolves to white on focus in light mode, a deep slate well under dark mode, and
 * the indigo/cyan focus accents. 16px type keeps iOS from zooming the page.
 */
const base =
  'w-full min-h-12 rounded-xl border bg-slate-100/80 px-4 py-3 text-[16px] leading-6 text-slate-900 placeholder:text-slate-400 outline-none focus:bg-white focus:ring-2 dark:bg-slate-950/70 dark:text-white dark:placeholder:text-slate-500'

const defaultBorder =
  'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500/15 dark:border-white/10 dark:focus:border-cyan-400 dark:focus:ring-cyan-400/20'

const invalidBorder =
  'border-rose-300 focus:border-rose-500 focus:ring-rose-500/15 dark:border-rose-500/40 dark:focus:border-rose-400 dark:focus:ring-rose-400/20'

export function authInputClassName({ border, padRight, padLeft, invalid } = {}) {
  return [
    base,
    border || (invalid ? invalidBorder : defaultBorder),
    padLeft ? 'pl-11' : '',
    padRight ? 'pr-12' : '',
  ].filter(Boolean).join(' ')
}
