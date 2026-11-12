import useDialogA11y from '../../hooks/useDialogA11y.js'

/**
 * ExitTutorialConfirm — asks before the coach card's "Exit Tutorial" throws
 * away an in-progress derivation, mirroring the reset confirmation.
 */
export default function ExitTutorialConfirm({ show, shortViewport, onClose, onConfirm }) {
  const panelRef = useDialogA11y(show, onClose)
  if (!show) return null

  return (
    <div
      className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/30 p-3 backdrop-blur-[2px] dark:bg-black/65"
      onClick={() => onClose()}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="exit-tutorial-title"
        aria-describedby="exit-tutorial-description"
        className={`flex w-full max-w-[380px] cursor-default flex-col rounded-2xl border border-slate-200/90 bg-white/95 shadow-2xl dark:border-white/10 dark:bg-slate-900/95 praxis-modal-panel ${shortViewport ? 'p-4' : 'p-6'}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={`flex items-center gap-3 ${shortViewport ? 'mb-2' : 'mb-3'}`}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-lg font-bold text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">
            !
          </div>
          <div>
            <h3 id="exit-tutorial-title" className="text-[16px] font-bold text-text-1">
              Exit the tutorial?
            </h3>
            <p id="exit-tutorial-description" className="mt-0.5 text-xs text-text-3">
              Your current derivation will be cleared. You can restart the tutorial from the stage list.
            </p>
          </div>
        </div>

        <div className="praxis-modal-actions mt-1 flex items-center gap-3 w-full pt-1">
          <button
            type="button"
            className="flex-1 rounded-xl border border-border bg-bg px-4 py-2.5 text-xs font-bold text-text-2 shadow-xs transition-all hover:bg-border/70 hover:text-text-1"
            onClick={() => onClose()}
            data-autofocus
          >
            Keep practicing
          </button>
          <button
            type="button"
            className="flex-1 rounded-xl bg-red px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ backgroundColor: '#b91c1c', color: '#ffffff' }}
            onClick={() => onConfirm()}
          >
            Exit Tutorial
          </button>
        </div>
      </div>
    </div>
  )
}
