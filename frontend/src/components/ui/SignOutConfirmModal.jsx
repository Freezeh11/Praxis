import useDialogA11y from '../../hooks/useDialogA11y.js'

/**
 * SignOutConfirmModal — confirmation dialog shown before a user is signed out.
 * Escape/Cancel/backdrop dismiss it; focus stays inside while it is open.
 * Matches the visual style of ResetConfirmModal so the two feel consistent.
 */
export default function SignOutConfirmModal({ show, onClose, onConfirm }) {
  const panelRef = useDialogA11y(show, onClose)
  if (!show) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/30 backdrop-blur-[2px] cursor-pointer"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sign-out-title"
        aria-describedby="sign-out-description"
        className="bg-bg-card rounded-2xl flex flex-col shadow-2xl max-w-[380px] w-full border border-border cursor-default praxis-modal-panel p-6"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-lg font-bold shrink-0">
            ↩
          </div>
          <div>
            <h3 id="sign-out-title" className="text-[16px] font-bold text-text-1">Sign out?</h3>
            <p id="sign-out-description" className="text-xs text-text-3 mt-0.5">
              Your progress is saved. You can sign back in at any time.
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="praxis-modal-actions flex items-center gap-3 w-full mt-4">
          <button
            type="button"
            className="flex-1 py-2.5 px-4 text-xs font-bold text-text-2 bg-bg hover:bg-border/70 hover:text-text-1 border border-border rounded-xl transition-all shadow-xs"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="flex-1 py-2.5 px-4 text-xs font-bold text-white rounded-xl transition-all shadow-sm active:scale-[0.98] hover:opacity-90"
            style={{ backgroundColor: '#b91c1c', color: '#ffffff' }}
            onClick={onConfirm}
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  )
}
