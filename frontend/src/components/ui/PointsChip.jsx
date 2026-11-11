export default function PointsChip({ variant = 'xp-bar', points = 0 }) {
  return <span className={variant === 'header'
    ? 'hidden sm:flex items-center px-3 py-1 bg-amber-50/80 border border-amber/30 rounded-full text-xs font-bold text-amber-700'
    : 'bg-bg-card border-[1.5px] border-border rounded-full px-3 sm:px-4 py-1.5 text-sm font-bold text-text-1 shadow-sm'}>⭐ {points} Points</span>
}
