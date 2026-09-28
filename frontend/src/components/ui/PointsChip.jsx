/**
 * Points/streak readout. Presentational, with two deliberately different skins:
 * `xp-bar` is the footer pair of pills, `header` the single amber header pill.
 */
export default function PointsChip({ variant = 'xp-bar', points = 0, streak = 0 }) {
  if (variant === 'header') {
    return (
      <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-amber-50/80 border border-amber/30 rounded-full text-xs font-bold text-amber-700">
        <span>⭐ {points}</span>
        <span className="opacity-40">•</span>
        <span>🔥 {streak}</span>
      </div>
    )
  }

  return (
    <>
      <span className="bg-bg-card border-[1.5px] border-border rounded-full px-3 sm:px-4 py-1.5 [@media(max-height:480px)]:py-0.5 text-sm [@media(max-height:480px)]:text-xs font-bold text-text-1 shadow-sm flex items-center gap-1.5">⭐ {points} Points</span>
      <span className="bg-bg-card border-[1.5px] border-border rounded-full px-3 sm:px-4 py-1.5 [@media(max-height:480px)]:py-0.5 text-sm [@media(max-height:480px)]:text-xs font-bold text-text-1 shadow-sm flex items-center gap-1.5">🔥 {streak} streak</span>
    </>
  )
}
