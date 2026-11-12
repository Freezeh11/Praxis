import { memo } from 'react'

import ThemeToggle from '../ui/ThemeToggle.jsx'
import Icon from '../ui/Icon'
/**
 * WorkspaceHeader — the centre panel's header: back navigation, the
 * step-history toggle, title/subtitle, the sandbox/points chip, the randomize /
 * new-expression action, and either the wide inline controls or the compact
 * control rail that re-homes them.
 *
 * Presentational: props in, callbacks out.
 */
import AssistanceControls from './AssistanceControls'
import { LawsReferenceButton } from './LawsReferenceSheet'
import TutorialToggle from './TutorialToggle'
import ZoomControls from './ZoomControls'
import { useZoom } from './zoomStore'
import SoundToggle from '../ui/SoundToggle'

function WorkspaceHeader({
  isSandbox, isCustomSandbox, compactHeader, headerControlRail, showStepHistoryToggle,
  chromeText, chromeHeight,
  steps, optimalSteps, points, isTutorialActive, isTutorialLevel, onToggleTutorial,
  isComplete, guideCost, onHint, onGuide, onOpenLaws, stepHistoryOpen,
  onToggleStepHistory, onRandomize, onNewExpression, onUndo, onReset,
  soundEnabled, onToggleSound,
}) {
  const { zoom, setZoom: onZoom } = useZoom()
  /** Header title/subtitle — custom sandbox announces the typed expression. */
  const workspaceTitle = isSandbox ? 'Sandbox' : 'Simplify Expression'
  const workspaceSubtitle = isSandbox
    ? (isCustomSandbox
      ? 'Your expression · no points awarded'
      : 'Random practice · no points awarded')
    : 'Reduce to its simplest form'

  /**
   * Undo / Reset. They live in the first header row on wide tiers and in the
   * compact control rail on the tiers that have no side column.
   */
  const undoResetGroup = (
    <div data-tutorial="undo-reset-group" className="flex items-center gap-1.5 shrink-0">
      <button
        data-tutorial="undo-button"
        className={`flex items-center gap-1.5 rounded-md border-[1.5px] border-border bg-bg font-semibold text-text-2 shadow-chip transition-all hover:bg-border hover:text-text-1 disabled:opacity-40 disabled:cursor-not-allowed ${compactHeader ? 'px-2.5 py-1.5' : 'px-3 py-1.5 text-xs'} ${chromeText} ${chromeHeight}`}
        onClick={onUndo}
        disabled={steps.length === 0}
        title="Undo last step"
      >
        <span>↶</span> Undo
      </button>

      <button
        data-tutorial="reset-button"
        className={`flex items-center gap-1.5 rounded-md border-[1.5px] border-border bg-bg font-semibold text-text-2 shadow-chip transition-all hover:bg-border hover:text-text-1 ${compactHeader ? 'px-2.5 py-1.5' : 'px-3 py-1.5 text-xs'} ${chromeText} ${chromeHeight}`}
        onClick={onReset}
        title="Reset problem to start"
      >
        <span>↺</span> Reset
      </button>
    </div>
  )

  /**
   * Theme + sound preferences. They ride the same rails as the other chrome:
   * inline in the wide header row, and in the compact control rail on the tiers
   * that have no side column.
   */
  const utilityControls = (
    <div className="flex items-center gap-1.5 shrink-0">
      <ThemeToggle />
      <SoundToggle enabled={soundEnabled} onToggle={onToggleSound} chromeHeight={chromeHeight} />

    </div>
  )

  return (
        <div className={compactHeader
          ? 'px-2.5 py-1.5 border-b border-border flex flex-col gap-1.5 shrink-0 shadow-[0_10px_18px_-18px_rgba(15,23,42,0.35)]'
          : 'px-5 py-3.5 border-b border-border flex items-center justify-between shadow-[0_10px_18px_-18px_rgba(15,23,42,0.35)]'}>
          <div className={compactHeader ? 'flex items-center justify-between gap-2 min-w-0 w-full' : 'contents'}>
          <div className="flex items-center gap-2 min-w-0">
            {showStepHistoryToggle && (
              <button
                type="button"
                data-testid="step-history-toggle"
                data-tutorial="step-history-toggle"
                className={`shrink-0 rounded-lg border border-border bg-bg text-[16px] leading-none text-text-2 shadow-chip transition-all hover:bg-border hover:text-text-1 flex items-center justify-center ${chromeHeight}`}
                onClick={onToggleStepHistory}
                title={stepHistoryOpen ? 'Hide step history' : 'Show step history'}
                aria-expanded={stepHistoryOpen}
              ><Icon name="menu" /></button>
            )}
            <div className="min-w-0">
              <div className="text-[15px] font-bold text-text-1 truncate">
                {workspaceTitle}
              </div>
              <div className={`text-text-3 mt-0.5 truncate ${compactHeader ? 'text-[14px]' : 'text-[11px]'}`}>
                {workspaceSubtitle}
              </div>
            </div>
          </div>
          <div className={`flex items-center ${compactHeader ? 'gap-1 shrink-0' : 'gap-1.5'}`}>
            {/* Compact tiers fold the side panel's status card into the header */}
            {compactHeader && (isSandbox ? (
              <div
                data-tutorial="sandbox-notice"
                title="Sandbox practice: no points, stars or progress are recorded"
                className={`shrink-0 inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50/70 px-2.5 font-semibold text-sky-900 dark:border-cyan-400/30 dark:bg-cyan-500/10 dark:text-cyan-200 ${chromeText} ${chromeHeight}`}
              >
                <span aria-hidden="true"><Icon name="flask" /></span>
                <span data-tutorial="sandbox-stats">{steps.length}{optimalSteps > 0 ? `/${optimalSteps}` : ''}</span>
              </div>
            ) : (
              <div
                data-tutorial="points-card"
                title="Total points"
                className={`shrink-0 inline-flex items-center gap-1 rounded-lg border border-amber-300/70 bg-amber-50 px-2.5 font-extrabold text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300 ${chromeText} ${chromeHeight}`}
              >
                <span aria-hidden="true">⭐</span>{points ?? 0}
              </div>
            ))}

            {/* Sandbox controls: Randomize and New Expression */}
            {isSandbox && (
              <>
                <button
                  id="randomize-btn"
                  className={`shrink-0 flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 font-bold text-indigo-700 transition-colors hover:bg-indigo-100 cursor-pointer dark:border-indigo-400/25 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20 ${compactHeader ? 'px-2.5 py-1.5' : 'px-3.5 py-1.5 text-xs'} ${chromeText} ${chromeHeight}`}
                  onClick={onRandomize}
                  title="Swap in a new random, solver-verified problem"
                >
                  <span className="text-sm leading-none"><Icon name="dice" /></span> Randomize
                </button>
                <button
                  data-tutorial="new-expression-btn"
                  className={`shrink-0 flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 font-bold text-indigo-700 transition-colors hover:bg-indigo-100 cursor-pointer dark:border-indigo-400/25 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20 ${compactHeader ? 'px-2.5 py-1.5' : 'px-3.5 py-1.5 text-xs'} ${chromeText} ${chromeHeight}`}
                  onClick={onNewExpression}
                  title="Type or edit an expression"
                >
                  <span className="text-sm leading-none" aria-hidden="true"><Icon name="edit" /></span> New expression
                </button>
                {!headerControlRail && <div className="w-[1px] h-4 bg-border mx-1" />}
              </>
            )}

            {/* Wide tiers: zoom, undo/reset and the tutorial toggle stay inline.
                Compact tiers move them into the control rail or the drawer. */}
            {!headerControlRail && (
              <>
                <ZoomControls compact={false} zoom={zoom} onZoom={onZoom} chromeHeight={chromeHeight} />

                <div className="w-[1px] h-4 bg-border mx-1" />

                {undoResetGroup}

                {isTutorialLevel && (
                  <>
                    <div className="w-[1px] h-4 bg-border mx-1" />
                    {/* Interactive Tutorial Button */}
                    <TutorialToggle compact={false} isTutorialActive={isTutorialActive} onToggle={onToggleTutorial} chromeText={chromeText} chromeHeight={chromeHeight} />
                  </>
                )}

                <div className="w-[1px] h-4 bg-border mx-1" />

                {utilityControls}
              </>
            )}
          </div>
          </div>

          {/* Compact control rail: the same hooks, one thumb-reachable row that
              wraps (and scrolls) instead of overflowing the viewport. A very
              narrow window wraps it into two short rows so no control is ever
              half off the screen. */}
          {headerControlRail && (
            <div
              data-testid="header-control-rail"
              className="praxis-rail praxis-rail-wrap items-center gap-1.5 w-full pb-0.5"
            >
              {undoResetGroup}
              <AssistanceControls compact isComplete={isComplete} isSandbox={isSandbox} guideCost={guideCost} points={points} onHint={onHint} onGuide={onGuide} chromeText={chromeText} chromeHeight={chromeHeight} />
              <LawsReferenceButton compact chromeText={chromeText} chromeHeight={chromeHeight} onOpen={onOpenLaws} />
              {utilityControls}
            </div>
          )}
        </div>
  )
}

export default memo(WorkspaceHeader)
