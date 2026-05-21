import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { useProgress } from '../hooks/useProgress'
import { useGameState } from '../hooks/useGameState'
import ExpressionDisplay from '../components/ExpressionDisplay'
import AnimationOverlay from '../components/AnimationOverlay'

export default function ProblemPage() {
  const { levelId, stageIdx } = useParams()
  const navigate = useNavigate()
  const { fetchLevel, laws } = useApi()
  const { progress, addPoints, deductPoints, completeStage } = useProgress()

  const [level, setLevel] = useState(null)
  const [puzzle, setPuzzle] = useState(null)
  const [showHint, setShowHint] = useState(false)
  const [currentHint, setCurrentHint] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)
  const [showLawsDrawer, setShowLawsDrawer] = useState(false)

  const {
    expr, sel, steps, exprHistory,
    applicableLaws,
    isComplete, earnedXp,
    status, statusMsg,
    activeGuidePaths,
    isAnimating, animationData,
    loadPuzzle,
    handleClickLit, handleClickNot, handleClickTerm,
    applyLaw, undoAction, resetPuzzle, getHint, swapTerms, activateGuide,
    hintsUsed,
  } = useGameState()

  const stageNum = parseInt(stageIdx)

  // Load puzzle data
  useEffect(() => {
    fetchLevel(Number(levelId)).then(data => {
      setLevel(data)
      const puz = data.puzzles[stageNum]
      if (puz) {
        setPuzzle(puz)
        loadPuzzle(puz)
      }
    })
  }, [levelId, stageNum])

  // Show success screen when puzzle is done
  useEffect(() => {
    if (isComplete) {
      addPoints(earnedXp) // earnedXp is now 10 points
      completeStage(Number(levelId), stageNum)
      setTimeout(() => setShowSuccess(true), 600)
    }
  }, [isComplete])

  const handleHint = () => {
    if (!puzzle) return
    const hint = getHint(puzzle)
    if (hint) {
      setCurrentHint(hint)
      setShowHint(true)
      setTimeout(() => setShowHint(false), 6000)
    }
  }

  const handleNextStage = () => {
    const nextIdx = stageNum + 1
    if (level && nextIdx < level.puzzles.length) {
      navigate(`/level/${levelId}/stage/${nextIdx}`)
    } else {
      navigate(`/level/${levelId}/stages`)
    }
  }

  const handleGuide = () => {
    if (progress.points >= 20) {
      const activated = activateGuide()
      if (activated) {
        deductPoints(20)
      }
    } else {
      alert("Not enough points! You need 20 points to use the Guide.")
    }
  }

  const handleReset = () => {
    setShowSuccess(false)
    setShowHint(false)
    resetPuzzle(puzzle)
  }

  /* Wrapper functions to pass current expr snapshot to handlers */
  const onClickLit = (path) => expr && handleClickLit(path, expr)
  const onClickNot = (path) => expr && handleClickNot(path, expr)
  const onClickTerm = (path) => expr && handleClickTerm(path, expr)
  const onApplyLaw = (law) => expr && applyLaw(law, expr, steps, hintsUsed)
  const onSwapTerms = (sumPath, fromIdx, toIdx) => swapTerms(sumPath, fromIdx, toIdx)

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      {/* ── LEFT PANEL: Step History ── */}
      <aside className="w-[260px] min-w-[200px] max-w-[300px] bg-white border-r border-border flex flex-col overflow-hidden">
        <div className="px-4 pt-3.5 pb-2.5 border-b border-border flex flex-col gap-2">
          <button className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-text-2 bg-transparent hover:bg-border rounded transition-all w-fit" onClick={() => navigate(`/level/${levelId}/stages`)}>
            ← Stages
          </button>
          <div className="text-[13px] font-bold text-text-2 tracking-[0.5px] uppercase">Step History</div>
        </div>
        <div className="flex-1 overflow-y-auto px-3.5 py-3 flex flex-col gap-2.5">
          {steps.length === 0 && (
            <div className="text-[13px] text-text-3 text-center pt-5">No steps yet.</div>
          )}
          {steps.map((s, i) => {
            const isLatest = i === steps.length - 1
            return (
              <div key={i} className={`border rounded-md px-3 py-2.5 font-mono text-[11px] transition-all
                ${isLatest ? 'border-teal bg-teal-light' : 'border-border bg-bg'}`}>
                <div className="text-text-2 leading-relaxed">
                  <span className="text-text-3 mr-1">F =</span> {s.from}
                </div>
                <div className="text-text-1 font-semibold leading-relaxed">
                  <span className="text-text-3 mr-1">F =</span> {s.to}
                </div>
                <div className="mt-1.5 inline-block text-[10px] font-sans font-semibold text-teal bg-white border border-teal rounded px-1.5 py-0.5">
                  {s.law}
                </div>
              </div>
            )
          })}
        </div>
      </aside>

      {/* ── CENTER PANEL: Expression Workspace ── */}
      <main className="flex-1 flex flex-col bg-white border border-border m-3 rounded-xl shadow-sm overflow-hidden">
        {/* Center header */}
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
          <div>
            <div className="text-[15px] font-bold text-text-1">Simplify Expression</div>
            <div className="text-[11px] text-text-3 mt-0.5">Reduce to its simplest form</div>
          </div>
          <div className="flex gap-1.5">
            <button
              className="w-8 h-8 rounded-md border border-border bg-bg text-[15px] text-text-2 flex items-center justify-center transition-all hover:not:disabled:bg-border hover:not:disabled:text-text-1 disabled:opacity-30 disabled:cursor-not-allowed"
              onClick={undoAction}
              disabled={exprHistory.length === 0}
              title="Undo"
            >↩</button>
            <button
              className="w-8 h-8 rounded-md border border-border bg-bg text-[15px] text-text-2 flex items-center justify-center transition-all hover:not:disabled:bg-border hover:not:disabled:text-text-1 disabled:opacity-30 disabled:cursor-not-allowed"
              onClick={handleReset}
              title="Reset puzzle"
            >⟳</button>
          </div>
        </div>


        {/* Expression workspace — grid bg + derivation chain */}
        <div className={`flex-1 flex flex-col justify-center items-center bg-white bg-[linear-gradient(rgba(0,0,0,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.045)_1px,transparent_1px)] bg-[size:28px_28px] relative min-h-[400px] ${isAnimating ? 'pointer-events-none opacity-90' : ''}`}>
          <div className="relative w-full h-full flex flex-col justify-center items-center">
            {isAnimating && <AnimationOverlay data={animationData} />}

            {/* Status pill — absolutely pinned to the top of workspace */}
            {status !== 'select' && (
              <div className={`absolute top-3.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold tracking-[0.1px] shadow-sm border-[1.5px] whitespace-nowrap z-10 transition-all duration-200
                ${status === 'error' ? 'bg-red-100 text-red-700 border-red-300' : ''}
                ${status === 'laws' ? 'bg-teal-light text-sky-700 border-sky-300' : ''}
                ${status === 'success' ? 'bg-green-light text-green-800 border-green-300' : ''}
              `}>
                {status === 'success' && <span className="text-xs font-bold">✓</span>}
                {status === 'error'   && <span className="text-xs font-bold">✕</span>}
                {status === 'laws'    && <span className="text-xs font-bold">→</span>}
                {statusMsg}
              </div>
            )}

            {/* Derivation chain */}
            {expr && (() => {
              // Build list of past lines from steps
              const pastLines = []
              if (steps.length > 0) {
                pastLines.push({ text: steps[0].from, isFirst: true, law: null })
                for (let i = 0; i < steps.length - 1; i++) {
                  pastLines.push({ text: steps[i].to, isFirst: false, law: steps[i].law })
                }
              }
              const total = pastLines.length
              return (
                <div className="flex flex-col gap-1 font-mono text-[22px] font-medium">
                  {/* Dimmed past lines */}
                  {pastLines.map((line, i) => {
                    const age = total - i   // 1 = most recent past, higher = older
                    const opacity = Math.max(0.12, 0.4 - (age - 1) * 0.07)
                    return (
                      <div key={i} className="flex items-baseline gap-3.5 pointer-events-none select-none transition-opacity duration-400 blur-[0.3px]" style={{ opacity }}>
                        <span className="font-mono text-[22px] font-medium text-text-2 whitespace-pre shrink-0 min-w-[2.4em]">
                          {line.isFirst ? 'F =' : '\u00a0\u00a0='}
                        </span>
                        <span className="text-text-1">{line.text}</span>
                      </div>
                    )
                  })}

                  {/* Current expression — interactive */}
                  <div className="flex items-center gap-3.5 flex-wrap">
                    <span className="font-mono text-[22px] font-medium text-text-2 whitespace-pre shrink-0 min-w-[2.4em]">
                      {steps.length === 0 ? 'F =' : '\u00a0\u00a0='}
                    </span>
                    <ExpressionDisplay
                      expr={expr}
                      sel={sel}
                      onClickLit={onClickLit}
                      onClickNot={onClickNot}
                      onClickTerm={onClickTerm}
                      onSwapTerms={onSwapTerms}
                      activeGuidePaths={activeGuidePaths}
                    />
                  </div>
                </div>
              )
            })()}

            {/* Hint bubble */}
            {showHint && (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber rounded-md text-[13px] text-amber-900 max-w-[480px]">
                <span className="text-base">💡</span>
                <span className="line-height-1.5">{currentHint}</span>
              </div>
            )}
          </div>
        </div>


        {/* ── APPLICABLE LAWS — below expression ── */}
        <div className="border-t-[1.5px] border-border p-3 px-5 pb-4 bg-white shrink-0">
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
        </div>
      </main>

      {/* ── RIGHT PANEL: Rewards + Stage Info ── */}
      <aside className="w-[280px] min-w-[240px] bg-white border-l border-border flex flex-col overflow-hidden">
        <div className="border-b border-border p-3.5 pt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold tracking-[1px] uppercase text-text-3">REWARDS</span>
            <span className="text-xs font-bold text-amber">+10 Points</span>
          </div>
          <div className="h-1 bg-border rounded-full mb-3 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-teal to-green rounded-full transition-all duration-500 ease-out"
              style={{ width: `${Math.min(100, steps.length * 15)}%` }}
            />
          </div>

          <div className="flex gap-2">
            <button className="flex-1 px-1.5 py-2 rounded-md text-xs font-semibold border-[1.5px] border-border bg-white text-text-2 transition-all hover:bg-bg hover:border-border-dark" onClick={() => setShowLawsDrawer(true)}>
              📜 Laws
            </button>
            <button className="flex-1 px-1.5 py-2 rounded-md text-xs font-semibold border-[1.5px] border-border bg-white text-text-2 transition-all hover:bg-bg hover:border-border-dark" onClick={handleHint}>
              💡 Hint
            </button>
            <button
              className="flex-1 px-1.5 py-2 rounded-md text-xs font-semibold border-[1.5px] border-amber bg-amber-light text-amber-600 transition-all shadow-sm hover:-translate-y-px hover:shadow-md hover:bg-amber-100"
              onClick={handleGuide}
            >
              📖 Guide (20 pts)
            </button>
          </div>
        </div>

        {/* Stage info */}
        <div className="p-4 bg-bg border-t border-border mt-auto shrink-0 flex flex-col gap-1.5">
          <div className="text-[13px] font-bold text-text-1">{level?.name}</div>
          <div className="text-[11px] text-text-3">
            Stage {stageNum + 1} / {level?.puzzles?.length || '?'}
          </div>
          <div className="text-xs font-semibold text-accent mt-1">Total Points: {progress.points}</div>
        </div>
      </aside>

      {/* ── LAWS DRAWER (SLIDING OVERLAY) ── */}
      <div className={`fixed inset-0 bg-accent/30 z-[100] transition-opacity duration-300 ${showLawsDrawer ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} onClick={() => setShowLawsDrawer(false)} />
      <div className={`fixed top-0 right-0 h-full w-[340px] bg-white shadow-2xl z-[110] flex flex-col transition-transform duration-300 ${showLawsDrawer ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-base font-bold text-text-1">Law Reference</h2>
          <button className="w-8 h-8 rounded-full border-none bg-bg text-lg text-text-2 flex items-center justify-center hover:bg-border transition-all" onClick={() => setShowLawsDrawer(false)}>✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {laws && laws.map(law => (
            <div key={law.id} className="bg-bg border border-border rounded-lg p-3.5 text-left">
              <div className="text-[13px] font-bold text-text-1 mb-1">{law.name}</div>
              <div className="flex flex-col gap-1 my-2 bg-white border border-border rounded px-3 py-2 shadow-sm">
                {law.formulas && law.formulas.map((f, idx) => (
                  <div key={idx} className="font-mono text-xs font-semibold text-text-1">{f}</div>
                ))}
              </div>
              <div className="text-[12px] text-text-3 leading-relaxed mt-2">{law.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── SUCCESS OVERLAY ── */}
      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-[8px]">
          <div className="bg-white rounded-2xl p-10 flex flex-col items-center shadow-2xl max-w-[380px] animate-fade-in border border-border">
            <div className="text-[48px] mb-2 leading-none">🎉</div>
            <h2 className="text-[28px] font-extrabold text-accent mb-6">Stage Complete!</h2>
            
            <div className="w-full flex flex-col gap-2.5 mb-6">
              <div className="flex justify-between items-center px-4 py-2 bg-bg rounded-lg text-sm text-text-2">
                <span className="font-medium">Optimal steps:</span>
                <span className="font-bold">{puzzle?.optimalSteps || '?'}</span>
              </div>
              <div className="flex justify-between items-center px-4 py-2 bg-bg rounded-lg text-sm text-text-2">
                <span className="font-medium">Your steps:</span>
                <span className={`font-bold px-2.5 py-0.5 rounded-full ${steps.length > (puzzle?.optimalSteps || 0) ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                  {steps.length}
                </span>
              </div>
            </div>

            {puzzle?.optimalSteps && steps.length > puzzle.optimalSteps && puzzle.optimalHint && (
              <div className="text-[13px] text-amber-800 bg-amber-50 border border-amber/30 p-3 rounded-lg w-full mb-6 leading-relaxed">
                <strong>💡 Hint:</strong> {puzzle.optimalHint}
              </div>
            )}

            <div className="inline-block text-[15px] font-bold text-amber-600 bg-amber-50 border-2 border-amber px-4 py-1.5 rounded-full shadow-sm mb-8 transform -rotate-2">+{earnedXp} Points</div>
            <div className="flex gap-3 w-full">
              {level && stageNum + 1 < level.puzzles.length ? (
                <button className="flex-1 py-3 bg-accent text-white rounded-lg font-semibold text-sm transition-all shadow-md hover:bg-text-1 hover:shadow-lg hover:-translate-y-px" onClick={handleNextStage}>
                  Next Stage →
                </button>
              ) : (
                <button className="flex-1 py-3 bg-accent text-white rounded-lg font-semibold text-sm transition-all shadow-md hover:bg-text-1 hover:shadow-lg hover:-translate-y-px" onClick={() => navigate(`/level/${levelId}/stages`)}>
                  Back to Stages
                </button>
              )}
              <button className="px-5 py-3 border-[1.5px] border-border text-text-2 font-semibold text-sm rounded-lg bg-transparent transition-all hover:bg-bg hover:border-border-dark" onClick={handleReset}>Try Again</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
