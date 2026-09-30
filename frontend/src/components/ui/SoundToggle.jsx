/**
 * SoundToggle — the speaker on/off control for the header rails.
 *
 * Presentational: it renders the preference it is handed and reports the click.
 * `compact` is the tight-rail variant; height follows the host header's chrome
 * scale so it never shifts the layout, and it stays >= 44px on landscape phones.
 */
export default function SoundToggle({ enabled, onToggle, compact = false, chromeHeight = '' }) {
  const label = enabled ? 'Sound effects on' : 'Sound effects off'

  return (
    <button
      type="button"
      data-testid="sound-toggle"
      className={`shrink-0 inline-flex items-center justify-center gap-1.5 rounded-lg border font-bold transition-all cursor-pointer ${chromeHeight} ${compact
        ? 'w-9 h-9 [@media(max-height:480px)]:h-11 [@media(max-height:480px)]:w-11'
        : 'px-2.5 h-9 [@media(max-height:480px)]:h-11'} ${enabled
        ? 'border-teal/40 bg-teal-light/70 text-sky-700 hover:bg-teal-light'
        : 'border-border bg-bg text-text-3 hover:bg-border hover:text-text-2'}`}
      onClick={onToggle}
      aria-pressed={enabled}
      aria-label={label}
      title={`${label}: click to turn sound ${enabled ? 'off' : 'on'}`}
    >
      <span aria-hidden="true" className="text-[15px] leading-none">{enabled ? '🔊' : '🔇'}</span>
    </button>
  )
}
