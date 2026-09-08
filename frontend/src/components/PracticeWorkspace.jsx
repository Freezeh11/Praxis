import { useEffect, useRef, useState } from 'react'
import { useGameState } from '../hooks/useGameState'
import ExpressionDisplay from './ExpressionDisplay'
import AnimationOverlay from './AnimationOverlay'

/**
 * Compact, reusable gameplay workspace used by the Sandbox, Practice and
 * Tutorial pages. Wraps useGameState + ExpressionDisplay + the applicable
 * laws bar in a self-contained layout that works with ANY puzzle object
 * ({ expr, goal, ... }), not just backend level data.
 *
 * Props:
 *  - puzzle: { expr, goal, ... } the puzzle to solve
 *  - onStateChange?: (snapshot) => void  — fired whenever game state changes
 *        (used by the interactive tutorial to detect user actions)
 *  - onExit: () => void — back navigation
 *  - exitLabel?: string
 *  - title / subtitle: header text
 *  - onNewPuzzle?: () => void — renders a "New problem" action when provided
 *  - enableHint?: boolean — show the contextual hint button (default true)
 */
export default function PracticeWorkspace({
  puzzle,
  onStateChange,
  onExit,
  exitLabel = 'Back',
  title = 'Simplify Expression',
  subtitle = 'Reduce to its simplest form',
  onNewPuzzle,
  enableHint = true,
}) {
  const {
    expr, sel, steps,
    applicableLaws,
    isComplete,
    status, statusMsg,
    isAnimating, animationData,
    loadPuzzle,
    handleClickLit, handleClickNot, handleClickTerm,
    applyLaw, undoAction, resetPuzzle, useHint: requestHint,
    optimalSteps,
  } = useGameState()

  const [showHint, setShowHint] = useState(false)
  const [currentHint, setCurrentHint] = useState('')

  // Keep the latest onStateChange callback in a ref so the effect below
  // does not need it as a dependency (parents pass unstable callbacks).
  const onStateChangeRef = useRef(onStateChange)
  useEffect(() => {
    onStateChangeRef.current = onStateChange
  })

  // Load puzzle whenever it changes
  useEffect(() => {
    if (puzzle) loadPuzzle(puzzle)
  }, [puzzle, loadPuzzle])

  // Report game state changes to the parent (for the tutorial)
  useEffect(() => {
    if (typeof onStateChangeRef.current === 'function') {
      onStateChangeRef.current({
        selCount: sel.length,
        stepsCount: steps.length,
        applicableLawIds: applicableLaws.map(l => l.id),
        isComplete,
        status,
        expr,
      })
    }
  }, [sel.length, steps.length, applicableLaws, isComplete, status, expr])

  const handleHint = () => {
    if (!puzzle || isComplete) return
    const hint = requestHint(puzzle)
    if (hint) {
      setCurrentHint(hint)
      setShowHint(true)
      setTimeout(() => setShowHint(false), 6000)
    }
  }

  const handleReset = () => {
    setShowHint(false)
    resetPuzzle(puzzle)
  }

  const onClickLit = (path) => expr && handleClickLit(path, expr)
  const onClickNot = (path) => expr && handleClickNot(path, expr)
  const onClickTerm = (path) => expr && handleClickTerm(path, expr)
  const onApplyLaw = (law) => expr && applyLaw(law, expr, steps)

  return (
    <div className="flex flex-col bg-white border border-border rounded-xl shadow-sm overflow-hidden h-full min-h-0">
      {/* ── HEADER ── */}
      <div className="px-3 sm:px-5 py-2.5 sm:py-3.5 border-b border-border flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <button
            className="flex items-center gap-1 px-2.5 py-2 min-tap text-xs font-semibold text-text-2 bg-transparent hover:bg-border rounded-lg transition-all shrink-0"
            onClick={onExit}
          >
            ← {exitLabel}
          </button>
          <div className="min-w-0">
            <div className="text-[14px] sm:text-[15px] font-bold text-text-1 truncate">{title}</div>
            <div className="text-[11px] text-text-3 mt-0.5 truncate">{subtitle}</div>
          </div>
        </div>

        <div className="flex gap-1 sm:gap-1.5 items-center shrink-0">
          {enableHint && (
            <button
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 min-tap rounded-md border-[1.5px] border-border bg-bg text-xs font-semibold text-text-2 transition-all hover:bg-border hover:text-text-1 disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={handleHint}
              disabled={isComplete}
              title={isComplete ? 'Expression is already simplified' : 'Get a hint for the next step'}
            >
              <span>💡</span><span className="hidden sm:inline">Hint</span>
            </button>
          )}
          <button
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 min-tap rounded-md border-[1.5px] border-border bg-bg text-xs font-semibold text-text-2 transition-all hover:bg-border hover:text-text-1 disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={undoAction}
            disabled={steps.length === 0}
            title="Undo last step"
          >
            <span>↶</span><span className="hidden sm:inline">Undo</span>
          </button>
          <button
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 min-tap rounded-md border-[1.5px] border-border bg-bg text-xs font-semibold text-text-2 transition-all hover:bg-border hover:text-text-1"
            onClick={handleReset}
            title="Reset problem to start"
          >
            <span>↺</span><span className="hidden sm:inline">Reset</span>
          </button>
          {typeof onNewPuzzle === 'function' && (
            <button
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 min-tap rounded-md bg-accent text-white text-xs font-bold transition-all hover:bg-text-1 shadow-sm"
              onClick={onNewPuzzle}
              title="Generate a new random problem"
            >
              <span>🎲</span><span className="hidden sm:inline">New problem</span>
            </button>
          )}
        </div>
      </div>

      {/* ── EXPRESSION WORKSPACE ── */}
      <div className="flex-1 flex flex-col justify-center items-center bg-white bg-[linear-gradient(rgba(0,0,0,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.045)_1px,transparent_1px)] bg-[size:28px_28px] relative min-h-[320px] overflow-hidden">
        <div className="relative w-full h-full flex flex-col justify-center items-center px-4 py-6">
          {isAnimating && <AnimationOverlay data={animationData} />}

          {/* Status pill */}
          {status !== 'select' && (
            <div className={`absolute top-3.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold tracking-[0.1px] shadow-sm border-[1.5px] whitespace-nowrap z-20 transition-all duration-200 max-w-[90%]
              ${status === 'error' ? 'bg-red-100 text-red-700 border-red-300' : ''}
              ${status === 'laws' ? 'bg-teal-light text-sky-700 border-sky-300' : ''}
              ${status === 'success' ? 'bg-green-light text-green-800 border-green-300' : ''}
            `}>
              {status === 'success' && <span className="text-xs font-bold">✓</span>}
              {status === 'error' && <span className="text-xs font-bold">✕</span>}
              {status === 'laws' && <span className="text-xs font-bold">→</span>}
              <span className="truncate">{statusMsg}</span>
            </div>
          )}

          {expr && (
            <div className={`flex flex-col items-center gap-3 font-mono text-[22px] font-medium select-none transition-opacity ${isAnimating ? 'pointer-events-none opacity-90' : ''}`}>
              {/* Goal chip */}
              <div className="text-[11px] font-sans font-bold tracking-[1px] uppercase text-text-3">
                Goal: <span className="font-mono text-[13px] text-teal font-bold">{puzzle.goal}</span>
                {optimalSteps > 0 && (
                  <span className="ml-2 text-text-3 font-sans font-medium normal-case tracking-normal">
                    (optimal: {optimalSteps} step{optimalSteps !== 1 ? 's' : ''})
                  </span>
                )}
              </div>

              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-[22px] whitespace-pre shrink-0 select-none mr-1 text-text-2 font-medium">F =</span>
                <ExpressionDisplay
                  expr={expr}
                  sel={sel}
                  onClickLit={onClickLit}
                  onClickNot={onClickNot}
                  onClickTerm={onClickTerm}
                  activeGuidePaths={[]}
                  animationPaths={isAnimating ? animationData?.paths : []}
                  animationLaw={isAnimating ? animationData?.lawId : null}
                />
              </div>
            </div>
          )}

          {/* Hint bubble */}
          {showHint && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber rounded-md text-[13px] text-amber-900 max-w-[480px] w-[90%]">
              <span className="text-base shrink-0">💡</span>
              <span className="leading-snug">{currentHint}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── APPLICABLE LAWS / COMPLETE BAR ── */}
      <div className="border-t-[1.5px] border-border p-3 px-5 pb-4 bg-white shrink-0">
        {isComplete ? (
          <div className="flex items-center justify-between gap-4 flex-wrap py-1">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-sm">
                ✓
              </div>
              <div>
                <div className="text-[13px] font-bold text-text-1">Simplified! 🎉</div>
                <div className="text-[11px] text-text-3">
                  You reduced it to <span className="font-mono text-teal">{puzzle.goal}</span> in {steps.length} step{steps.length !== 1 ? 's' : ''}.
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                className="px-3.5 py-2 border border-slate-200 text-text-2 font-semibold text-xs rounded-lg bg-slate-50 hover:bg-slate-100 hover:text-text-1 transition-all"
                onClick={handleReset}
              >
                ↺ Try again
              </button>
              {typeof onNewPuzzle === 'function' && (
                <button
                  className="px-5 py-2 bg-accent text-white rounded-lg font-semibold text-sm transition-all shadow-sm hover:bg-text-1 hover:shadow-md hover:-translate-y-px"
                  onClick={onNewPuzzle}
                >
                  🎲 New problem →
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-2.5">
              <span className="text-[11px] font-bold tracking-[1px] uppercase text-text-3 whitespace-nowrap">APPLICABLE LAWS</span>
              {applicableLaws.length === 0 && (
                <span className="text-xs text-text-3 italic">
                  {sel.length === 0 ? '← Select a term or variable to begin' : 'No laws apply — try a different selection'}
                </span>
              )}
            </div>
            {applicableLaws.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {applicableLaws.map((law, i) => (
                  <button
                    key={i}
                    className="bg-white border-[1.5px] border-border rounded-md px-3.5 py-2.5 text-left cursor-pointer transition-all min-w-[160px] max-w-[240px] hover:border-text-1 hover:bg-bg hover:shadow-sm hover:-translate-y-[1px]"
                    onClick={() => onApplyLaw(law)}
                  >
                    <div className="text-[13px] font-semibold text-text-1 mb-0.5">{law.name}</div>
                    <div className="font-mono text-[11px] text-teal mb-1">{law.formula}</div>
                    <div className="text-[11px] text-text-3 leading-tight">{law.desc}</div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
