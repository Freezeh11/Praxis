/**
 * StepInspectionTip — the first-run hint that a past step can be inspected.
 * It shares the collision-aware popup layer with the law explanation.
 */
export default function StepInspectionTip({ compactCanvas, shortViewport, ready, onDismiss }) {
  return (
    <div
      data-testid="step-inspection-tip"
      className={`bg-white border-2 border-teal/70 shadow-2xl rounded-2xl text-left flex flex-col ring-4 ring-teal/10 select-none pointer-events-auto ${
        compactCanvas
          ? 'p-2.5 gap-1 w-[170px] max-w-full [@media(max-height:359px)]:p-2 [@media(max-height:359px)]:w-[156px]'
          : 'p-3.5 gap-2 w-[250px]'
      } ${ready ? 'opacity-100' : 'opacity-0'}`}
      style={{ transition: 'opacity 0.12s ease' }}
    >
      <div className="flex items-center gap-1.5 text-xs font-bold text-teal">
        <span>💡</span> Try Inspecting Steps
      </div>

      <p className={`text-[11.5px] text-text-2 leading-snug font-sans font-normal line-clamp-3 ${shortViewport ? 'praxis-hide-short' : ''}`}>
        Click any past step in the left history panel OR any connection line between equations to inspect the applied law and reasoning!
      </p>

      <div className="flex justify-end pt-1">
        <button
          type="button"
          data-testid="step-inspection-tip-ok"
          onClick={() => onDismiss()}
          className="px-3.5 py-1.5 min-h-[32px] [@media(max-height:359px)]:min-h-[28px] [@media(max-height:359px)]:py-1 bg-teal hover:bg-teal-dark text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
        >
          Okay
        </button>
      </div>
    </div>
  )
}
