import Icon from '../ui/Icon'
/**
 * StepHistoryPanel — the derivation history. It is the first column on the wide
 * tiers; on the tiers that cannot afford it, the SAME element (same
 * `data-tutorial` hook the tutorial overlay and the e2e suites resolve) is
 * rendered inside an overlay drawer, together with the zoom + tutorial controls
 * that have no header room there.
 */
import usePanelSound from '../../hooks/usePanelSound'
import ExprText from '../ExprText'
import TutorialToggle from './TutorialToggle'
import ZoomControls from './ZoomControls'

export default function StepHistoryPanel({
  steps, inspectedStepIdx, onToggleInspectStep, useOverlayHistory, isPhoneLandscape,
  stepHistoryOpen, onCloseStepHistory, isSandbox, onBack, touchTargets,
  zoom, onZoom, isTutorialActive, isTutorialLevel, onToggleTutorial, chromeText, chromeHeight,
}) {
  // Only the overlay-drawer variant opens and closes — on the wide tiers this
  // panel is a permanent column, so the flag stays false and the cue is unused.
  usePanelSound(stepHistoryOpen)

  const stepHistoryPanel = (
    <aside
      data-tutorial="step-history-panel"
      className={useOverlayHistory
        ? 'w-full h-full min-w-0 bg-bg-card flex flex-col overflow-hidden'
        : 'w-[260px] min-w-[200px] max-w-[300px] bg-bg-card border-r border-border flex flex-col overflow-hidden shadow-[inset_-1px_0_0_rgba(15,23,42,0.05)]'}
    >
      <div className={useOverlayHistory
        ? 'px-3 pt-2.5 pb-2 border-b border-border flex items-end justify-between gap-2 shrink-0'
        : 'px-4 pt-3.5 pb-2.5 border-b border-border flex flex-col gap-2'}>
        <div className="flex flex-col gap-2 min-w-0">
          {/* Back navigation reads as one intentional control in BOTH themes: a
              compact pill whose chevron sits in its own key-cap, so it can
              never be mistaken for tinted text. */}
          <button
            type="button"
            aria-label={isSandbox ? 'Back to Levels' : 'Back to Stages'}
            onClick={() => onBack()}
            className={`group inline-flex w-fit items-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 bg-white/85 py-1 pl-1 pr-2.5 text-[13px] font-semibold text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition-colors duration-200 hover:border-indigo-300 hover:bg-white hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200 dark:shadow-none dark:hover:border-cyan-400/40 dark:hover:bg-slate-800 dark:focus-visible:ring-cyan-400/60 ${useOverlayHistory ? 'min-h-[44px]' : 'min-h-[34px]'}`}
          >
            <span
              aria-hidden="true"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-indigo-600 transition-colors duration-200 group-hover:border-indigo-300 dark:border-white/10 dark:bg-slate-800 dark:text-cyan-300 dark:group-hover:border-cyan-400/40"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                <path d="M14.5 6 8.5 12l6 6" />
              </svg>
            </span>
            {isSandbox ? 'Back to Levels' : 'Back to Stages'}
          </button>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Step History</div>
        </div>
        {useOverlayHistory && (
          <button
            type="button"
            data-testid="step-history-close"
            aria-label="Close step history"
            className="shrink-0 w-11 h-11 rounded-lg border border-slate-200 bg-white/85 text-[16px] text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition-colors duration-200 hover:border-indigo-300 hover:bg-white hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-300 dark:shadow-none dark:hover:border-cyan-400/40 dark:hover:bg-slate-800 dark:hover:text-white dark:focus-visible:ring-cyan-400/60 flex items-center justify-center"
            onClick={() => onCloseStepHistory()}
            title="Close step history"
          ><Icon name="close" /></button>
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
              className={`border rounded-xl px-3 py-2.5 font-mono cursor-pointer shadow-chip transition-all ${touchTargets ? 'min-h-[44px] text-[14px]' : 'text-[11px]'} ${
                isInspected
                  ? 'border-teal bg-teal-50/90 shadow-md ring-2 ring-teal/30 -translate-y-px'
                  : isLatest
                  ? 'border-teal/60 bg-teal-light hover:border-teal hover:shadow-sm'
                  : 'border-border bg-bg hover:border-slate-300 hover:bg-slate-50 hover:shadow-[0_8px_18px_-14px_rgba(15,23,42,0.40)]'
              }`}
            >
              <div className="text-text-2 leading-relaxed">
                <span className="text-text-2 mr-1">F =</span> <ExprText text={s.from} />
              </div>
              <div className="text-text-1 font-semibold leading-relaxed">
                <span className="text-text-2 mr-1">F =</span> <ExprText text={s.to} />
              </div>
              <div
                className={`mt-1.5 inline-flex items-center font-sans font-semibold rounded px-2 py-0.5 transition-colors ${touchTargets ? 'text-[12px]' : 'text-[10px]'} ${
                  isInspected
                    ? 'bg-teal text-white shadow-xs'
                    : 'text-teal bg-bg-card border border-teal'
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
            {isTutorialLevel && (
              <>
                <div className="w-[1px] h-5 bg-border mx-0.5" />
                <TutorialToggle compact isTutorialActive={isTutorialActive} onToggle={onToggleTutorial} chromeText={chromeText} chromeHeight={chromeHeight} />
              </>
            )}
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
        <div className="flex h-full w-full flex-col overflow-hidden border-r border-border bg-bg-card shadow-2xl">
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
