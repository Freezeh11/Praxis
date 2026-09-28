/**
 * HintBubble — the hint popup of the workspace. It is one fixed, collision-
 * placed layer: `nodeRef` / `layerStyle` / `ready` come from
 * useCollisionPlacement, which parks the bubble against the Hint button.
 */
export default function HintBubble({
  show, hint, isPhoneLandscape, isNarrowViewport, ready, nodeRef, layerStyle, onClose,
}) {
  return (
    <div
      data-testid="hint-bubble-layer"
      style={{ ...layerStyle, pointerEvents: 'none' }}
      aria-hidden={!show}
    >
      <div ref={nodeRef}>
        {show && (
          <div
            data-testid="hint-bubble"
            className={`flex items-start gap-2 px-3.5 py-2.5 bg-amber-50 border border-amber rounded-lg text-amber-900 shadow-sm pointer-events-auto ${
              isPhoneLandscape || isNarrowViewport ? 'text-[14px]' : 'text-[13px]'
            } ${ready ? 'opacity-100' : 'opacity-0'}`}
            style={{ width: '100%', transition: 'opacity 0.12s ease' }}
          >
            <span className="text-base leading-none shrink-0">💡</span>
            <span className="leading-snug">{hint}</span>
            <button
              type="button"
              data-testid="hint-bubble-close"
              className="ml-auto shrink-0 -mr-1 -mt-0.5 w-6 h-6 rounded-md text-amber-800/70 hover:text-amber-900 hover:bg-amber-100 flex items-center justify-center text-xs font-bold transition-colors"
              onClick={() => onClose()}
              title="Dismiss hint"
            >✕</button>
          </div>
        )}
      </div>
    </div>
  )
}
