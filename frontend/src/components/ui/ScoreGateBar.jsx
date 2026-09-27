import { SCORE_RAMP, UNLOCK_AVERAGE_SCORE } from '../../config/game-rules'

/** Fill colours for the score ramp, keyed to the SCORE_RAMP thresholds. */
const RAMP_COLORS = { good: '#22c55e', fair: '#f59e0b', low: '#ef4444' }

/** Ramp colour for a score: good at/above SCORE_RAMP.good, fair above SCORE_RAMP.fair, else low. */
const rampColor = (score) => {
  if (score >= SCORE_RAMP.good) return RAMP_COLORS.good
  if (score >= SCORE_RAMP.fair) return RAMP_COLORS.fair
  return RAMP_COLORS.low
}

/**
 * Score progress bar with the unlock-threshold notch: `score` drives the ramp colour (from
 * config/game-rules.js), `success` forces the good colour, `percent` overrides the fill width.
 * `variant` keeps the two existing tracks (compact card bar vs hero bar) unchanged.
 */
export default function ScoreGateBar({ score = 0, percent = Math.min(100, score), success = false, variant = 'compact', notch = false }) {
  const trackClassName = variant === 'hero'
    ? 'relative w-full h-2.5 bg-border rounded-full overflow-visible my-0.5'
    : 'w-full h-2 bg-bg rounded-full overflow-hidden border border-border'

  return (
    <div className={trackClassName}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${percent}%`, background: success ? RAMP_COLORS.good : rampColor(score) }}
      />
      {notch && (
        <div
          className="absolute top-1/2 -translate-y-1/2 w-[2px] h-4 bg-text-1 rounded-full shadow-xs"
          style={{ left: `${UNLOCK_AVERAGE_SCORE}%` }}
          title={`${UNLOCK_AVERAGE_SCORE}% Target Gate`}
        />
      )}
    </div>
  )
}
