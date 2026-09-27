/**
 * ZoomControls — the zoom out / reset / in cluster of the expression canvas.
 * It renders in the header on the wide tiers and in the step-history drawer on
 * the compact ones. Presentational: `zoom` comes in, `onZoom` receives a state
 * updater (the same `setZoom` the page owns).
 */

/** Zoom magnitude steps of the workspace canvas. */
const ZOOM_STEP = 0.15
const ZOOM_MIN = 0.5
const ZOOM_MAX = 2.0

export default function ZoomControls({ compact, zoom, onZoom, chromeHeight }) {
  return (
    <>
      <button
        className={compact
          ? `flex items-center justify-center rounded-md border border-border bg-bg text-[16px] text-text-2 transition-all hover:bg-border hover:text-text-1 disabled:opacity-30 disabled:cursor-not-allowed ${chromeHeight}`
          : 'w-8 h-8 rounded-md border border-border bg-bg text-[16px] text-text-2 flex items-center justify-center transition-all hover:bg-border hover:text-text-1 disabled:opacity-30 disabled:cursor-not-allowed'}
        onClick={() => onZoom(z => Math.max(ZOOM_MIN, parseFloat((z - ZOOM_STEP).toFixed(2))))}
        disabled={zoom <= ZOOM_MIN}
        title="Zoom out"
      >−</button>
      <button
        className={compact
          ? `flex items-center justify-center rounded-md border border-border bg-bg text-[14px] font-mono text-text-2 transition-all hover:bg-border ${chromeHeight}`
          : 'h-7 px-2 rounded border border-border bg-bg text-[10px] font-mono text-text-2 hover:bg-border transition-all'}
        onClick={() => onZoom(1)}
      >{compact ? `${Math.round(zoom * 100)}%` : '100%'}</button>
      <button
        className={compact
          ? `flex items-center justify-center rounded-md border border-border bg-bg text-[16px] text-text-2 transition-all hover:bg-border hover:text-text-1 disabled:opacity-30 disabled:cursor-not-allowed ${chromeHeight}`
          : 'w-8 h-8 rounded-md border border-border bg-bg text-[16px] text-text-2 flex items-center justify-center transition-all hover:bg-border hover:text-text-1 disabled:opacity-30 disabled:cursor-not-allowed'}
        onClick={() => onZoom(z => Math.min(ZOOM_MAX, parseFloat((z + ZOOM_STEP).toFixed(2))))}
        disabled={zoom >= ZOOM_MAX}
        title="Zoom in"
      >+</button>
    </>
  )
}
