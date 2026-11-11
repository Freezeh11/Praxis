import Icon from './Icon'

/**
 * Points readout. `header` is the compact rail chip used on the stage screens;
 * `xp-bar` is the larger in-page variant. Both themes are explicit, and the
 * star is an SVG (not an emoji) so the glyph matches the rest of the icon set.
 */
export default function PointsChip({ variant = 'xp-bar', points = 0 }) {
  if (variant === 'header') {
    return (
      <span className="hidden h-9 shrink-0 items-center gap-1.5 rounded-lg border border-amber-300/70 bg-amber-50 px-3 text-[13px] font-bold text-amber-800 sm:inline-flex dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300 [@media(max-height:480px)]:h-11">
        <span aria-hidden="true" className="text-[13px] leading-none"><Icon name="star" /></span>
        {points} Points
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/70 bg-amber-50 px-3 py-1.5 text-sm font-bold text-amber-800 shadow-sm dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300">
      <span aria-hidden="true" className="text-[13px] leading-none"><Icon name="star" /></span>
      {points} Points
    </span>
  )
}
