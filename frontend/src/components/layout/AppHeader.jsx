import PraxisBrand from './PraxisBrand.jsx'
import ThemeToggle from '../ui/ThemeToggle.jsx'

/**
 * Shared page header shell: the glass bar with a brand/breadcrumb slot and a
 * control slot. The wordmark IS the home link — there is deliberately no
 * separate "Home" pill to its left.
 */
export default function AppHeader({ variant = 'list', crumbs = [], right, showThemeToggle = true }) {
  const className = variant === 'list'
    ? 'relative z-20 flex h-[72px] w-full shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 bg-white/75 px-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_14px_32px_-26px_rgba(15,23,42,0.50)] backdrop-blur-md sm:px-8 dark:border-white/10 dark:bg-slate-900/65 [@media(max-height:480px)]:h-[52px]'
    : 'relative z-20 flex h-[64px] w-full shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 bg-white/75 px-3 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_14px_32px_-26px_rgba(15,23,42,0.50)] backdrop-blur-md sm:px-6 md:px-10 dark:border-white/10 dark:bg-slate-900/65 [@media(max-height:480px)]:h-[52px]'

  return (
    <header className={className}>
      <PraxisBrand crumbs={crumbs} />
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {showThemeToggle && <ThemeToggle />}
        {right}
      </div>
    </header>
  )
}
