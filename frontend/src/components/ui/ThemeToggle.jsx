import Icon from './Icon'
import { useTheme } from '../../state/theme.js'

/**
 * Icon-only theme switch. One control, no label to reflow: the icon and the
 * aria-label carry the state, so it can sit in every header rail unchanged.
 */
export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const next = theme === 'dark' ? 'light' : 'dark'
  const label = 'Switch to ' + next + ' mode'
  return (
    <button
      type="button"
      data-testid="theme-toggle"
      onClick={toggleTheme}
      aria-label={label}
      aria-pressed={theme === 'dark'}
      title={label}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700 transition-colors hover:bg-slate-200 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-700 [@media(max-height:480px)]:h-11 [@media(max-height:480px)]:w-11"
    >
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} className="text-[16px]" />
    </button>
  )
}
