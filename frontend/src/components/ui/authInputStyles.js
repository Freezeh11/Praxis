/**
 * Shared auth-input styling, kept out of the component files so react-refresh stays
 * happy. `border` replaces the default border/focus utilities (register's invalid
 * state); `padRight` adds the room the password reveal toggle needs.
 */
const base = 'w-full px-3.5 py-2.5 rounded-lg bg-bg text-[16px] leading-6 text-text-1 placeholder:text-text-3/60 outline-none transition-all focus:ring-2 focus:ring-accent/10'

export function authInputClassName({ border, padRight } = {}) {
  const borderClass = border || 'border border-border focus:border-accent'
  return `${base} ${padRight ? 'pr-10 ' : ''}${borderClass}`
}
