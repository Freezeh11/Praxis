/**
 * ResetConfirmModal — the confirmation shown when a solved stage is reset,
 * with the per-session opt-out.
 */
export default function ResetConfirmModal({
  show, shortViewport, isSandbox, dontAskResetAgain, onToggleDontAsk, onClose, onConfirm,
}) {
  if (!show) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/30 backdrop-blur-[2px] cursor-pointer"
      onClick={() => onClose()}
    >
      <div
        className={`bg-white rounded-2xl flex flex-col shadow-2xl max-w-[380px] w-full border border-border cursor-default praxis-modal-panel ${shortViewport ? 'p-4' : 'p-6'}`}
        onClick={e => e.stopPropagation()}
      >
        <div className={`flex items-center gap-3 ${shortViewport ? 'mb-2' : 'mb-3'}`}>
          <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-lg font-bold shrink-0">
            ↺
          </div>
          <div>
            <h3 className="text-[16px] font-bold text-text-1">
              {isSandbox ? 'Reset this problem?' : 'Reset this stage?'}
            </h3>
            <p className="text-xs text-text-3 mt-0.5">
              {isSandbox
                ? 'This clears your current derivation so you can solve the same random problem again.'
                : 'Are you sure you want to reset the stage? This will clear your current derivation so you can solve it from scratch.'}
            </p>
          </div>
        </div>

        {/* Don't ask me again checkbox */}
        <label className={`flex items-center gap-2.5 px-1 cursor-pointer select-none ${shortViewport ? 'mt-1 mb-3' : 'mt-2 mb-5'}`}>
          <input
            type="checkbox"
            checked={dontAskResetAgain}
            onChange={e => onToggleDontAsk(e.target.checked)}
            className="w-4 h-4 rounded border-border text-teal focus:ring-teal cursor-pointer accent-teal"
          />
          <span className="text-xs text-text-2 font-medium">Don't ask me again for this session</span>
        </label>

        {/* Action buttons: Go back & Reset */}
        <div className="praxis-modal-actions flex items-center gap-3 w-full mt-1 pt-1">
          <button
            type="button"
            className="flex-1 py-2.5 px-4 text-xs font-bold text-text-2 bg-bg hover:bg-border/70 hover:text-text-1 border border-border rounded-xl transition-all shadow-xs"
            onClick={() => onClose()}
          >
            Go back
          </button>
          <button
            type="button"
            className="flex-1 py-2.5 px-4 text-xs font-bold text-white bg-red hover:opacity-90 rounded-xl transition-all shadow-sm active:scale-[0.98]"
            style={{ backgroundColor: '#ef4444', color: '#ffffff' }}
            onClick={onConfirm}
          >
            Reset Stage
          </button>
        </div>
      </div>
    </div>
  )
}
