import Icon from './Icon'

/**
 * SoundToggle — the speaker on/off control for the header rails.
 *
 * Presentational: it renders the preference it is handed and reports the click.
 * `compact` is the tight-rail variant; height follows the host header's chrome
 * scale so it never shifts the layout, and it stays >= 44px on landscape phones.
 * Icon-only, matching the theme toggle it sits next to.
 */
export default function SoundToggle({ enabled, onToggle, compact = false, chromeHeight = '' }) {
  const label = enabled ? 'Sound effects on' : 'Sound effects off'
  const size = compact
    ? 'h-9 w-9 [@media(max-height:480px)]:h-11 [@media(max-height:480px)]:w-11'
    : 'h-9 px-2.5 [@media(max-height:480px)]:h-11'
  const tone = enabled
    ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20'
    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-700'

  return (
    <button
      type="button"
      data-testid="sound-toggle"
      className={'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg transition-colors ' + chromeHeight + ' ' + size + ' ' + tone}
      onClick={onToggle}
      aria-pressed={enabled}
      aria-label={label}
      title={label + ': click to turn sound ' + (enabled ? 'off' : 'on')}
    >
      <span aria-hidden="true" className="text-[16px] leading-none">{enabled ? <Icon name="volume" /> : <Icon name="muted" />}</span>
    </button>
  )
}
