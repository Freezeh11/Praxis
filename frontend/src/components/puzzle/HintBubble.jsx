import Icon from '../ui/Icon'
/** A centered, dismissible hint that stays independent of canvas zoom. */
export default function HintBubble({
  show, hint, isPhoneLandscape, isNarrowViewport, onClose,
}) {
  return (
    <div
      data-testid="hint-bubble-layer"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
      aria-hidden={!show}
    >
      <div className="w-full max-w-md max-h-[80dvh] overflow-y-auto" role={show ? 'status' : undefined} aria-live="polite">
        {show && (
          <div
            data-testid="hint-bubble"
            className={`flex items-start gap-2 px-3.5 py-2.5 bg-amber-50 border border-amber rounded-lg text-amber-900 shadow-sm pointer-events-auto ${
              isPhoneLandscape || isNarrowViewport ? 'text-[14px]' : 'text-[13px]'
            }`}
            style={{ width: '100%', transition: 'opacity 0.12s ease' }}
          >
            <span className="text-base leading-none shrink-0"><Icon name="bulb" /></span>
            <span className="leading-snug">{hint}</span>
            <button
              type="button"
              data-testid="hint-bubble-close"
              className="ml-auto shrink-0 -mr-1 -mt-0.5 w-6 h-6 rounded-md text-amber-800/70 hover:text-amber-900 hover:bg-amber-100 flex items-center justify-center text-xs font-bold transition-colors"
              onClick={() => onClose()}
              title="Dismiss hint"
            ><Icon name="close" /></button>
          </div>
        )}
      </div>
    </div>
  )
}
