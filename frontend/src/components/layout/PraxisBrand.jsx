import { Link } from 'react-router-dom'

/**
 * The Praxis wordmark. It IS the way home — there is no separate "Home" pill to
 * the left of it. The "x" carries the accent so the brand reads as a link rather
 * than a logo image. The app icon is the square x badge in /favicon.svg; it is
 * deliberately not repeated next to the wordmark (a second x reads as noise).
 */
export function PraxisWordmark({ size = 'md' }) {
  const large = size === 'lg'

  return (
    <Link
      to="/"
      aria-label="Praxis home"
      className="group inline-flex shrink-0 items-center font-extrabold tracking-[-0.035em] text-slate-900 transition-opacity hover:opacity-80 dark:text-white"
    >
      <span className={`inline-flex items-baseline ${large ? 'text-[26px]' : 'text-[21px]'}`}>
        <span>pra</span>
        <span className="text-indigo-600 dark:text-indigo-400">x</span>
        <span>is</span>
      </span>
    </Link>
  )
}

/**
 * Wordmark + contextual breadcrumb (`praxis / My Profile`). Every crumb but the
 * last links somewhere; the last one is the current route and is not a link.
 */
export default function PraxisBrand({ crumbs = [] }) {
  return (
    <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
      <PraxisWordmark />
      {crumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2">
          {crumbs.map((crumb, index) => {
            const isLast = index === crumbs.length - 1
            return (
              <span key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-2">
                <span aria-hidden="true" className="text-sm font-light text-slate-300 dark:text-slate-600">/</span>
                {crumb.to && !isLast ? (
                  <Link
                    to={crumb.to}
                    data-testid={crumb.testId}
                    className="truncate text-[13px] font-semibold text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span aria-current="page" className="truncate text-[13px] font-semibold text-slate-500 dark:text-slate-400">
                    {crumb.label}
                  </span>
                )}
              </span>
            )
          })}
        </nav>
      )}
    </div>
  )
}
