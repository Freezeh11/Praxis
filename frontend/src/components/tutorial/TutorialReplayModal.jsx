/**
 * Tutorial-replay confirmation dialog shared by the level screens. Presentational:
 * `shift` is the vertical nudge published by usePopupPlacement, everything else is props.
 */
export default function TutorialReplayModal({ show, onClose, dontAskAgain, onDontAskAgainChange, shift, onRestart }) {
  if (!show) return null

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs transition-opacity"
      onClick={onClose}
    >
      <div
        data-popup-panel="centered"
        className="praxis-modal-panel relative bg-white rounded-3xl pt-9 pb-8 [@media(max-height:480px)]:pt-6 [@media(max-height:480px)]:pb-3 px-6 sm:px-10 max-w-[460px] w-full shadow-2xl border border-border/80 flex flex-col items-center text-center gap-5 [@media(max-height:480px)]:gap-2.5"
        style={{ transform: `translateY(${Math.round(shift || 0)}px)` }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          type="button"
          className="absolute top-2 right-2 w-11 h-11 rounded-full flex items-center justify-center text-text-3 hover:text-text-1 hover:bg-slate-100 transition-all cursor-pointer"
          onClick={onClose}
        >
          ✕
        </button>

        <div className="flex flex-col items-center gap-2">
          <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-text-3">
            Tutorial Replay
          </span>
          <h3 className="text-xl font-extrabold text-text-1 tracking-tight">
            Restart the Walkthrough?
          </h3>
        </div>

        <p className="text-[13.5px] text-text-2 leading-relaxed max-w-[380px]">
          You've already made progress in the tutorial. Would you like to reset your derivation and experience the full guided walkthrough again?
        </p>

        {/* Don't ask again checkbox */}
        <label className="flex items-center gap-2.5 px-3 py-1 rounded-lg hover:bg-bg cursor-pointer select-none -mt-1">
          <input
            type="checkbox"
            checked={dontAskAgain}
            onChange={e => onDontAskAgainChange(e.target.checked)}
            className="w-4 h-4 rounded border-border text-teal focus:ring-teal cursor-pointer accent-teal"
          />
          <span className="text-xs text-text-2 font-medium">Don't ask me again for this session</span>
        </label>

        {/* Actions */}
        <div className="praxis-modal-actions flex items-center gap-3 w-full mt-1">
          <button
            type="button"
            className="flex-1 min-h-11 py-3 px-4 text-xs font-bold text-text-2 bg-slate-100 hover:bg-slate-200 hover:text-text-1 rounded-xl transition-all cursor-pointer"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="flex-1 min-h-11 py-3 px-4 text-xs font-bold text-white bg-teal hover:bg-teal-600 active:scale-[0.98] rounded-xl transition-all shadow-sm cursor-pointer"
            onClick={onRestart}
          >
            Restart Walkthrough
          </button>
        </div>
      </div>
    </div>
  )
}
