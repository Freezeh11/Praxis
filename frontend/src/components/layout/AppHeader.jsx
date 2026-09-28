/**
 * Shared page header shell: the card/backdrop-blur bar with left and right slots.
 * `variant` carries the two existing bar treatments (levels list vs stage selector).
 */
export default function AppHeader({ variant = 'list', left, right }) {
  const className = variant === 'list'
    ? 'relative w-full h-[72px] [@media(max-height:480px)]:h-[52px] px-4 sm:px-8 flex items-center justify-between bg-bg-card/70 backdrop-blur-md border-b-2 border-border z-20 shrink-0'
    : 'relative w-full h-[64px] [@media(max-height:480px)]:h-[52px] px-3 sm:px-6 md:px-10 flex items-center justify-between bg-bg-card/85 backdrop-blur-md border-b border-border z-20 shrink-0'

  return (
    <header className={className}>
      {left}
      {right}
    </header>
  )
}
