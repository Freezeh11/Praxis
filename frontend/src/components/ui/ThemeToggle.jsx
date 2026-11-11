import { useTheme } from '../../state/theme.js'
export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  return <button type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} className="min-h-9 min-w-9 px-2 rounded-lg border border-border bg-bg text-text-1 text-xs font-semibold whitespace-nowrap">{theme === 'dark' ? '☀ Light' : '☾ Dark'}</button>
}
