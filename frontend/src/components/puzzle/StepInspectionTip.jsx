/**
 * StepInspectionTip — the first-run hint that a past step can be inspected.
 * It shares the collision-aware popup layer with the law explanation.
 */
export default function StepInspectionTip({ ready, onDismiss }) {
  return (
    <div
      data-testid="step-inspection-tip"
      className={`bg-white border-2 border-teal/70 shadow-2xl rounded-2xl text-left flex flex-col p-3.5 gap-2 w-[260px] max-w-[calc(100vw-32px)] ring-4 ring-teal/10 select-none pointer-events-auto ${
        ready ? 'opacity-100' : 'opacity-0'
      }`}
      style={{ transition: 'opacity 0.15s ease' }}
    >
      <div className="flex items-center gap-1.5 text-xs font-bold text-teal">
        <span>💡</span> Try Inspecting Steps
      </div>

      <p className="text-[12px] text-text-2 leading-relaxed font-sans font-normal">
        Click any past step in the history panel OR any connection line between equations to inspect the applied law and reasoning!
      </p>

      <div className="flex justify-end pt-1">
        <button
          type="button"
          data-testid="step-inspection-tip-ok"
          onClick={() => onDismiss()}
          className="px-3.5 py-1.5 min-h-[32px] bg-teal hover:bg-teal-dark text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
        >
          Okay
        </button>
      </div>
    </div>
  )
}
