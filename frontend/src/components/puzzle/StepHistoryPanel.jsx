/**
 * StepHistoryPanel — the derivation history. It is the first column on the wide
 * tiers; on the tiers that cannot afford it, the SAME element (same
 * `data-tutorial` hook the tutorial overlay and the e2e suites resolve) is
 * rendered inside an overlay drawer, together with the zoom + tutorial controls
 * that have no header room there.
 */
import ExprText from '../ExprText'
import TutorialToggle from './TutorialToggle'
import ZoomControls from './ZoomControls'

export default function StepHistoryPanel({
  steps, inspectedStepIdx, onToggleInspectStep, useOverlayHistory, isPhoneLandscape,
  stepHistoryOpen, onCloseStepHistory, isSandbox, onBack, touchTargets,
  zoom, onZoom, isTutorialActive, onToggleTutorial, chromeText, chromeHeight,
}) {
  const stepHistoryPanel = (
    <aside
      data-tutorial="step-history-panel"
      className={useOverlayHistory
        ? 'w-full h-full min-w-0 bg-white flex flex-col overflow-hidden'
        : 'w-[260px] min-w-[200px] max-w-[300px] bg-white border-r border-border flex flex-col overflow-hidden'}
    >
      <div className={useOverlayHistory
        ? 'px-3 pt-2.5 pb-2 border-b border-border flex items-end justify-between gap-2 shrink-0'
        : 'px-4 pt-3.5 pb-2.5 border-b border-border flex flex-col gap-2'}>
        <div className="flex flex-col gap-2 min-w-0">
          <button
            className={`flex items-center gap-1.5 px-2.5 py-1 font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-all shadow-2xs w-fit ${useOverlayHistory ? 'text-[13px]' : 'text-xs'}`}
            onClick={() => onBack()}
          >
            <span className="font-extrabold text-teal">←</span> {isSandbox ? 'Back to Levels' : 'Back to Stages'}
          </button>
          <div className={`font-bold text-text-2 tracking-[0.5px] uppercase ${useOverlayHistory ? 'text-[15px]' : 'text-[13px]'}`}>Step History</div>
        </div>
        {useOverlayHistory && (
          <button
            type="button"
            data-testid="step-history-close"
            className="shrink-0 w-11 h-11 rounded-lg border border-border bg-bg text-[16px] font-bold text-text-2 hover:bg-border transition-all flex items-center justify-center"
            onClick={() => onCloseStepHistory()}
            title="Close step history"
          >✕</button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-3.5 py-3 flex flex-col gap-2.5">
        {steps.length === 0 && (
          <div className={`text-text-3 text-center pt-5 ${useOverlayHistory ? 'text-[14px]' : 'text-[13px]'}`}>No steps yet.</div>
        )}
        {steps.map((s, i) => {
          const isInspected = inspectedStepIdx === i
          const isLatest = i === steps.length - 1

          return (
            <div
              key={i}
              data-tutorial={`step-history-card-${i}`}
              onClick={() => onToggleInspectStep(prev => (prev === i ? null : i))}
              className={`border rounded-xl px-3 py-2.5 font-mono cursor-pointer transition-all ${touchTargets ? 'min-h-[44px] text-[14px]' : 'text-[11px]'} ${
                isInspected
                  ? 'border-teal bg-teal-50/90 shadow-md ring-2 ring-teal/30 -translate-y-px'
                  : isLatest
                  ? 'border-teal/60 bg-teal-light hover:border-teal hover:shadow-xs'
                  : 'border-border bg-bg hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="text-text-2 leading-relaxed">
                <span className="text-text-3 mr-1">F =</span> <ExprText text={s.from} />
              </div>
              <div className="text-text-1 font-semibold leading-relaxed">
                <span className="text-text-3 mr-1">F =</span> <ExprText text={s.to} />
              </div>
              <div
                className={`mt-1.5 inline-flex items-center font-sans font-semibold rounded px-2 py-0.5 transition-colors ${touchTargets ? 'text-[12px]' : 'text-[10px]'} ${
                  isInspected
                    ? 'bg-teal text-white shadow-xs'
                    : 'text-teal bg-white border border-teal'
                }`}
              >
                {s.law}
              </div>
            </div>
          )
        })}
      </div>
      {useOverlayHistory && (
        <div className="shrink-0 border-t border-border bg-bg/40 px-3 py-2.5 flex flex-col gap-2">
          <div className="text-[12px] font-bold tracking-[1px] uppercase text-text-3">Workspace controls</div>
          <div className="flex items-center gap-1.5">
            <ZoomControls compact zoom={zoom} onZoom={onZoom} chromeHeight={chromeHeight} />
            <div className="w-[1px] h-5 bg-border mx-0.5" />
            <TutorialToggle compact isTutorialActive={isTutorialActive} onToggle={onToggleTutorial} chromeText={chromeText} chromeHeight={chromeHeight} />
          </div>
        </div>
      )}
    </aside>
  )

  /** Overlay drawer wrapper used by the tiers that cannot afford a column. */
  const historyDrawer = useOverlayHistory ? (
    <>
      {stepHistoryOpen && (
        <div
          data-testid="step-history-backdrop"
          className="fixed inset-0 z-40 bg-black/30"
          onClick={() => onCloseStepHistory()}
        />
      )}
      <div
        data-testid="step-history-drawer"
        className={`fixed inset-y-0 left-0 z-50 ${stepHistoryOpen ? 'flex' : 'hidden'}`}
        style={isPhoneLandscape ? { width: '85vw', maxWidth: '320px' } : { width: '360px', maxWidth: '80vw' }}
        aria-hidden={!stepHistoryOpen}
      >
        <div className="flex h-full w-full flex-col overflow-hidden border-r border-border bg-white shadow-2xl">
          {stepHistoryPanel}
        </div>
      </div>
    </>
  ) : null

  return (
    <>
      {!useOverlayHistory && stepHistoryPanel}
      {historyDrawer}
    </>
  )
}
