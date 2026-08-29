import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useApi } from '../hooks/useApi'
import { useProgress } from '../hooks/useProgress'
import { useGameState } from '../hooks/useGameState'
import ExpressionDisplay from '../components/ExpressionDisplay'
import AnimationOverlay from '../components/AnimationOverlay'
import ExprText from '../components/ExprText'

export default function ProblemPage() {
  const { levelId, stageIdx } = useParams()
  const navigate = useNavigate()
  const { fetchLevel, laws, submitScore } = useApi()
  const { progress, addPoints, deductPoints, completeStage, saveScore } = useProgress()

  const [level, setLevel] = useState(null)
  const [puzzle, setPuzzle] = useState(null)
  const [showHint, setShowHint] = useState(false)
  const [currentHint, setCurrentHint] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)
  const [earnedPoints, setEarnedPoints] = useState(0)
  const [toastMessage, setToastMessage] = useState(null)
  const [zoom, setZoom] = useState(1.0)
  const [inspectedStepIdx, setInspectedStepIdx] = useState(null)
  const [showLawsDrawer, setShowLawsDrawer] = useState(false)
  const [scoreResult, setScoreResult] = useState(null)

  function getLawExplanation(lawName) {
    if (!lawName) return null
    const lower = lawName.toLowerCase()
    if (lower.includes('initial')) {
      return 'Starting problem expression.'
    }
    if (lower.includes('distributive')) {
      return 'Factored out common variable into parentheses.'
    }
    if (lower.includes('absorption')) {
      return 'Shorter term absorbs redundant longer term.'
    }
    if (lower.includes('complement')) {
      return 'Opposites cancel: A + A\' = 1 and A · A\' = 0.'
    }
    if (lower.includes('idempotent')) {
      return 'Duplicate terms combine: A + A = A.'
    }
    if (lower.includes('identity')) {
      return 'Neutral element dropped: A · 1 = A and A + 0 = A.'
    }
    if (lower.includes('annulment')) {
      return 'Dominant value takes over: A + 1 = 1 and A · 0 = 0.'
    }
    if (lower.includes('double neg')) {
      return 'Double NOT cancels out: (A\')\' = A.'
    }
    if (lower.includes('demorgan')) {
      return 'Break the bar, flip the operator (+ ↔ ·).'
    }
    return `Applied ${lawName}.`
  }
  const ZOOM_STEP = 0.15
  const ZOOM_MIN = 0.5
  const ZOOM_MAX = 2.0

  const {
    expr, sel, steps, exprHistory,
    applicableLaws,
    isComplete, earnedXp,
    status, statusMsg,
    activeGuidePaths,
    isAnimating, animationData,
    loadPuzzle,
    handleClickLit, handleClickNot, handleClickTerm,
    applyLaw, undoAction, resetPuzzle, useHint, swapTerms, activateGuide,
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

  // Reset overlays when navigating to a new stage
  useEffect(() => {
    setShowSuccess(false)
    setShowHint(false)
    setScoreResult(null)
  }, [levelId, stageNum])

  // Show success screen when puzzle is done
  useEffect(() => {
    if (isComplete) {
      addPoints(earnedXp)
      completeStage(Number(levelId), stageNum)

      // Derive lawsUsed from step history at this moment
      const lawsUsed = steps.map(s => {
        // Map law name back to law id via a simple lookup
        const nameToId = {
          'Absorption Law': 'absorption',
          'Idempotent Law': 'idempotent',
          'Identity Law': 'identity',
          'Annulment Law': 'annulment',
          'Complement Law': 'complement',
          'Distributive (Factor)': 'distributive',
          'Double Negation': 'double-neg',
          "De Morgan's (AND\u2192OR)": 'demorgan-and',
          "De Morgan's (OR\u2192AND)": 'demorgan-or',
        }
        return nameToId[s.law] || s.law
      })

      // Submit score and show breakdown after 3s
      submitScore({
        levelId: Number(levelId),
        stageIdx: stageNum,
        stepsUsed: steps.length,
        lawsUsed,
        hintsUsed,
      }).then(result => {
        if (result) {
          saveScore(Number(levelId), stageNum, result.total)
          setScoreResult(result)
        }
      })

      setTimeout(() => setShowSuccess(true), 3000)
    }
  }, [isComplete])

  const handleHint = () => {
    if (!puzzle) return
    const hint = useHint(puzzle)
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
            const isInspected = inspectedStepIdx === i
            const isLatest = i === steps.length - 1

            return (
              <div
                key={i}
                onClick={() => setInspectedStepIdx(prev => (prev === i ? null : i))}
                className={`border rounded-xl px-3 py-2.5 font-mono text-[11px] cursor-pointer transition-all ${
                  isInspected
                    ? 'border-sky-400 bg-sky-50 shadow-md ring-2 ring-sky-300/80 -translate-y-px'
                    : isLatest
                    ? 'border-teal bg-teal-light hover:border-teal hover:shadow-xs'
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
                  className={`mt-1.5 inline-flex items-center gap-1 text-[10px] font-sans font-semibold rounded px-2 py-0.5 transition-colors ${
                    isInspected
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'text-teal bg-white border border-teal'
                  }`}
                >
                  <span>✦</span> {s.law}
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
          <div className="flex gap-1.5 items-center">
            {/* Zoom controls */}
            <button
              className="w-8 h-8 rounded-md border border-border bg-bg text-[16px] text-text-2 flex items-center justify-center transition-all hover:bg-border hover:text-text-1 disabled:opacity-30 disabled:cursor-not-allowed"
              onClick={() => setZoom(z => Math.max(ZOOM_MIN, parseFloat((z - ZOOM_STEP).toFixed(2))))}
              disabled={zoom <= ZOOM_MIN}
              title="Zoom out"
            >−</button>
            <button
              className="h-7 px-2 rounded border border-border bg-bg text-[10px] font-mono text-text-2 hover:bg-border transition-all"
              onClick={() => setZoom(1)}
              title="Reset zoom"
            >{Math.round(zoom * 100)}%</button>
            <button
              className="w-8 h-8 rounded-md border border-border bg-bg text-[16px] text-text-2 flex items-center justify-center transition-all hover:bg-border hover:text-text-1 disabled:opacity-30 disabled:cursor-not-allowed"
              onClick={() => setZoom(z => Math.min(ZOOM_MAX, parseFloat((z + ZOOM_STEP).toFixed(2))))}
              disabled={zoom >= ZOOM_MAX}
              title="Zoom in"
            >+</button>

            <div className="w-px h-5 bg-border mx-0.5" />

            <button
              className="w-8 h-8 rounded-md border border-border bg-bg text-[15px] text-text-2 flex items-center justify-center transition-all hover:bg-border hover:text-text-1 disabled:opacity-30 disabled:cursor-not-allowed"
              onClick={undoAction}
              disabled={exprHistory.length === 0}
              title="Undo"
            >↩</button>
            <button
              className="w-8 h-8 rounded-md border border-border bg-bg text-[15px] text-text-2 flex items-center justify-center transition-all hover:bg-border hover:text-text-1 disabled:opacity-30 disabled:cursor-not-allowed"
              onClick={handleReset}
              title="Reset puzzle"
            >⟳</button>
          </div>
        </div>


        {/* Expression workspace — grid bg + derivation chain */}
        <div className={`flex-1 flex flex-col justify-center items-center bg-white bg-[linear-gradient(rgba(0,0,0,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.045)_1px,transparent_1px)] bg-[size:28px_28px] relative min-h-[400px] overflow-hidden ${isAnimating ? 'pointer-events-none opacity-90' : ''}`}>
          <div className="relative w-full h-full flex flex-col justify-center items-center">
            {isAnimating && <AnimationOverlay data={animationData} />}

            {/* Status pill — absolutely pinned to top, outside zoom wrapper so it stays fixed size */}
            {status !== 'select' && (
              <div className={`absolute top-3.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold tracking-[0.1px] shadow-sm border-[1.5px] whitespace-nowrap z-20 transition-all duration-200
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

            {/* Zoom wrapper — scales the entire expression block */}
            <div style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', transition: 'transform 0.18s ease' }}>
              {/* Derivation chain — clean FIFO top-to-bottom queue */}
            {expr && (() => {
              // Build list of past lines from steps
              const pastLines = []
              if (steps.length > 0) {
                // Line 0 is the starting expression, transformed by steps[0].law
                pastLines.push({
                  text: steps[0].from,
                  isFirst: true,
                  law: 'Initial Expression',
                  cardLaw: steps[0].law,
                  stepKey: -1,
                })
                for (let i = 0; i < steps.length - 1; i++) {
                  pastLines.push({
                    text: steps[i].to,
                    isFirst: false,
                    law: steps[i].law,
                    cardLaw: steps[i].law,
                    stepKey: i,
                  })
                }
              }
              const total = pastLines.length
              const activeStepKey = steps.length > 0 ? steps.length - 1 : null
              const isActiveInspected = activeStepKey !== null && inspectedStepIdx === activeStepKey
              const activeCardLaw = steps.length > 0 ? steps[steps.length - 1].law : null

              return (
                <motion.div
                  layout
                  className="flex flex-col gap-3 font-mono text-[22px] font-medium items-start"
                >
                  {/* Top-down past lines queue */}
                  {pastLines.map((line, i) => {
                    const age = total - i
                    const isInspected = inspectedStepIdx === line.stepKey
                    const targetOpacity = isInspected ? 1 : Math.max(0.25, 0.55 - (age - 1) * 0.08)

                    return (
                      <motion.div
                        layout
                        key={`past-${i}-${line.text}`}
                        initial={{ opacity: 0.9 }}
                        animate={{ opacity: targetOpacity }}
                        transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
                        onClick={() => setInspectedStepIdx(prev => (prev === line.stepKey ? null : line.stepKey))}
                        className="relative flex items-center cursor-pointer group py-1 rounded-lg select-none transition-all"
                      >
                        {/* Left Annotation: Clean text, anchored directly to the left */}
                        <div
                          className="absolute right-full mr-5 flex items-center gap-2.5 whitespace-nowrap justify-end cursor-pointer"
                          onClick={e => {
                            e.stopPropagation()
                            setInspectedStepIdx(prev => (prev === line.stepKey ? null : line.stepKey))
                          }}
                        >
                          <span
                            className={`font-sans text-xs tracking-wide transition-colors ${
                              isInspected
                                ? 'font-bold text-sky-700 underline underline-offset-4'
                                : 'font-medium text-text-3 group-hover:text-teal'
                            }`}
                          >
                            {line.law}
                          </span>
                          <span
                            className={`font-mono text-sm transition-colors ${
                              isInspected
                                ? 'font-bold text-sky-700'
                                : 'font-light text-text-3 group-hover:text-teal'
                            }`}
                          >
                            →
                          </span>
                        </div>

                        {/* Centered Equation Line — prominently highlighted when inspected */}
                        <div
                          onClick={e => {
                            e.stopPropagation()
                            setInspectedStepIdx(prev => (prev === line.stepKey ? null : line.stepKey))
                          }}
                          className={`flex items-baseline gap-3.5 px-3 py-1 rounded-lg border cursor-pointer transition-all ${
                            isInspected
                              ? 'border-sky-400 bg-sky-50 shadow-sm ring-2 ring-sky-200/70'
                              : 'border-transparent group-hover:border-slate-200 group-hover:bg-slate-50/90'
                          }`}
                        >
                          <span
                            className={`font-mono text-[22px] whitespace-pre shrink-0 min-w-[2.4em] transition-colors ${
                              isInspected ? 'text-sky-800 font-semibold' : 'text-text-2 font-medium'
                            }`}
                          >
                            {line.isFirst ? 'F =' : '\u00a0\u00a0='}
                          </span>
                          <ExprText
                            text={line.text}
                            className={isInspected ? 'text-sky-950 font-semibold' : 'text-text-1'}
                          />
                        </div>

                        {/* Right-Aligned Context Card (Revealed on click) */}
                        {isInspected && (
                          <div
                            className="absolute left-[calc(100%+20px)] flex items-center z-40 pointer-events-auto"
                            onClick={e => e.stopPropagation()}
                          >
                            <motion.div
                              initial={{ opacity: 0, x: -6, scale: 0.97 }}
                              animate={{ opacity: 1, x: 0, scale: 1 }}
                              className="bg-white border border-sky-400 shadow-lg rounded-xl px-3.5 py-2.5 text-left w-[250px]"
                            >
                              <div className="flex items-center justify-between gap-1 text-[11px] font-bold text-sky-800 uppercase tracking-wide">
                                <span>✦ {line.cardLaw}</span>
                                <button
                                  type="button"
                                  onClick={() => setInspectedStepIdx(null)}
                                  className="text-[11px] text-slate-400 font-bold hover:text-slate-700 px-1 rounded hover:bg-slate-100 transition-colors"
                                >
                                  ✕
                                </button>
                              </div>
                              <div className="text-[11px] text-slate-600 mt-1 leading-snug font-sans font-normal">
                                {getLawExplanation(line.cardLaw)}
                              </div>
                            </motion.div>
                          </div>
                        )}
                      </motion.div>
                    )
                  })}

                  {/* Current active expression at the bottom of the queue */}
                  <motion.div
                    layout
                    key={`active-step-${steps.length}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
                    onClick={() => activeStepKey !== null && setInspectedStepIdx(prev => (prev === activeStepKey ? null : activeStepKey))}
                    className="relative flex items-center z-10 cursor-pointer"
                  >
                    {/* Left Annotation */}
                    <div className="absolute right-full mr-5 flex items-center gap-2.5 whitespace-nowrap justify-end">
                      <span
                        className={`font-sans text-xs tracking-wide transition-colors ${
                          isActiveInspected
                            ? 'font-bold text-sky-700 underline underline-offset-4'
                            : steps.length === 0
                            ? 'font-medium text-text-2'
                            : 'font-semibold text-teal'
                        }`}
                      >
                        {steps.length === 0 ? 'Initial Expression' : steps[steps.length - 1].law}
                      </span>
                      <span
                        className={`font-mono text-sm transition-colors ${
                          isActiveInspected ? 'font-bold text-sky-700' : 'text-teal font-bold'
                        }`}
                      >
                        →
                      </span>
                    </div>

                    {/* Centered Interactive Equation */}
                    <div
                      className={`flex items-center gap-3.5 px-3 py-1 rounded-lg border transition-all ${
                        isActiveInspected
                          ? 'border-sky-400 bg-sky-50 shadow-sm ring-2 ring-sky-200/70'
                          : 'border-transparent'
                      }`}
                    >
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
                        animationPaths={isAnimating ? animationData?.paths : []}
                        animationLaw={isAnimating ? animationData?.lawId : null}
                      />
                    </div>

                    {/* Right-Aligned Context Card while animation is actively playing OR active line is inspected */}
                    {(isAnimating || isActiveInspected) && (
                      <div
                        className="absolute left-[calc(100%+20px)] flex items-center z-40 pointer-events-auto"
                        onClick={e => e.stopPropagation()}
                      >
                        <motion.div
                          initial={{ opacity: 0, x: -8, scale: 0.97 }}
                          animate={{ opacity: 1, x: 0, scale: 1 }}
                          exit={{ opacity: 0, x: -6 }}
                          className="bg-white border border-teal shadow-md rounded-lg px-3.5 py-2.5 text-left w-[250px]"
                        >
                          <div className="flex items-center justify-between gap-1 text-[11px] font-bold text-teal uppercase tracking-wide">
                            <span>✦ {animationData?.lawName || activeCardLaw || 'Applying Law'}</span>
                            {isActiveInspected && (
                              <button
                                type="button"
                                onClick={() => setInspectedStepIdx(null)}
                                className="text-[11px] text-slate-400 font-bold hover:text-slate-700 px-1 rounded hover:bg-slate-100 transition-colors"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-700 mt-1 leading-snug font-sans font-normal">
                            {getLawExplanation(animationData?.lawName || activeCardLaw)}
                          </div>
                        </motion.div>
                      </div>
                    )}
                  </motion.div>
                </motion.div>
              )
            })()}
            </div>{/* end zoom wrapper */}

            {/* Hint bubble */}
            {showHint && (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber rounded-md text-[13px] text-amber-900 max-w-[480px]">
                <span className="text-base">💡</span>
                <span className="line-height-1.5">{currentHint}</span>
              </div>
            )}
          </div>
        </div>


        {/* ── APPLICABLE LAWS / STAGE COMPLETE BAR ── */}
        <div className="border-t-[1.5px] border-border p-3 px-5 pb-4 bg-white shrink-0">
          {isComplete ? (
            <div className="flex items-center justify-between gap-4 flex-wrap py-1">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-sm">
                  ✓
                </div>
                <div>
                  <div className="text-[13px] font-bold text-text-1">Stage Completed! 🎉</div>
                  <div className="text-[11px] text-text-3">Click past steps above to review derivations, or move on to the next puzzle.</div>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  className="px-3.5 py-2 border border-slate-200 text-text-2 font-semibold text-xs rounded-lg bg-slate-50 hover:bg-slate-100 hover:text-text-1 transition-all"
                  onClick={() => setShowSuccess(true)}
                >
                  📊 Score Summary
                </button>
                {level && stageNum + 1 < level.puzzles.length ? (
                  <button
                    className="px-5 py-2 bg-accent text-white rounded-lg font-semibold text-sm transition-all shadow-sm hover:bg-text-1 hover:shadow-md hover:-translate-y-px"
                    onClick={handleNextStage}
                  >
                    Next Stage →
                  </button>
                ) : (
                  <button
                    className="px-5 py-2 bg-accent text-white rounded-lg font-semibold text-sm transition-all shadow-sm hover:bg-text-1 hover:shadow-md hover:-translate-y-px"
                    onClick={() => navigate(`/level/${levelId}/stages`)}
                  >
                    Back to Stages
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
      </main>

      {/* ── RIGHT PANEL: Level Progress, Points, Assistance & Stages ── */}
      <aside className="w-[280px] min-w-[240px] bg-white border-l border-border flex flex-col overflow-hidden">
        {/* Top: Stage / Level Progress */}
        <div className="border-b border-border p-3.5 pt-4 bg-bg/30">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold tracking-[1px] uppercase text-text-3">LEVEL PROGRESS</span>
            <span className="text-xs font-bold text-teal">Stage {stageNum + 1} / {level?.puzzles.length ?? '?'}</span>
          </div>
          <div className="h-1.5 bg-border rounded-full mb-1.5 overflow-hidden">
            <div
              className="h-full bg-teal transition-all duration-300 rounded-full"
              style={{ width: `${level ? ((stageNum + 1) / level.puzzles.length) * 100 : 0}%` }}
            />
          </div>
          <div className="text-[10.5px] text-text-3 font-medium">
            {level?.name || 'Level Stages'}
          </div>
        </div>

        {/* Middle: User Points & Assistance Controls (Replaced Target Box) */}
        <div className="p-3.5 border-b border-border flex flex-col gap-2.5 bg-white">
          {/* User Points Card */}
          <div className="flex items-center justify-between px-3.5 py-2.5 bg-amber-50/70 border border-amber/40 rounded-xl">
            <div className="flex items-center gap-2">
              <span className="text-lg">⭐</span>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-900/80">TOTAL POINTS</div>
                <div className="text-base font-extrabold text-amber-600 leading-none mt-0.5">
                  {progress.points ?? 0} <span className="text-[11px] font-semibold text-amber-700">pts</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold text-teal bg-teal/10 border border-teal/30 px-2 py-0.5 rounded-full">
                +10 on clear
              </span>
            </div>
          </div>

          {/* Hint & Guide Action Buttons */}
          <div className="flex gap-2">
            <button
              className="flex-1 py-2 px-2.5 rounded-lg text-xs font-semibold border border-border bg-bg text-text-2 transition-all hover:bg-border/60 hover:text-text-1 flex items-center justify-center gap-1.5 shadow-xs"
              onClick={handleHint}
              title="Get a hint for the next step"
            >
              <span>💡</span> Hint
            </button>
            <button
              className="flex-1 py-2 px-2 rounded-lg text-xs font-semibold border border-amber/50 bg-amber-50/80 text-amber-900 transition-all hover:bg-amber-100 hover:border-amber flex items-center justify-center gap-1 shadow-xs"
              onClick={handleGuide}
              title="Highlight terms for the next move (Costs 20 pts)"
            >
              <span>🎯</span> Guide <span className="text-[10px] text-amber-700 font-normal">(20p)</span>
            </button>
          </div>

          {/* Quick Laws Reference Drawer Trigger */}
          <button
            className="w-full py-2 px-3 bg-bg border border-border rounded-lg text-xs font-semibold text-text-2 hover:bg-border/60 transition-all flex items-center justify-between shadow-xs"
            onClick={() => setShowLawsDrawer(true)}
          >
            <span>📖 Laws Quick Reference</span>
            <span className="text-text-3">→</span>
          </button>
        </div>

        {/* Level Puzzles List */}
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1.5">
          <div className="text-[10px] font-bold tracking-[1px] uppercase text-text-3 mb-1 px-1">STAGES</div>
          {level?.puzzles.map((p, idx) => {
            const isCurrent = idx === stageNum
            const isCompleted = idx < stageNum
            const isLocked = idx > stageNum

            return (
              <button
                key={p.id || idx}
                disabled={isLocked}
                onClick={() => {
                  if (!isLocked && levelId) {
                    navigate(`/level/${levelId}/problem/${idx}`)
                  }
                }}
                className={`flex items-center justify-between p-2.5 rounded-lg text-left transition-all border ${
                  isCurrent
                    ? 'bg-teal/10 border-teal text-teal font-bold'
                    : isCompleted
                    ? 'bg-bg/50 border-transparent text-text-2 hover:bg-bg hover:border-border cursor-pointer'
                    : 'bg-transparent border-transparent text-text-3 opacity-40 cursor-not-allowed pointer-events-none'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs w-4">{idx + 1}.</span>
                  <span className="font-mono text-xs">{p.initial || `Stage ${idx + 1}`}</span>
                </div>
                {isCompleted && <span className="text-teal text-xs font-bold">✓</span>}
                {isCurrent && <span className="text-[10px] uppercase tracking-wider font-bold bg-teal text-white px-1.5 py-0.5 rounded">Active</span>}
                {isLocked && <span className="text-xs text-text-3 opacity-60">🔒</span>}
              </button>
            )
          })}
        </div>
      </aside>

      {/* ── LAWS QUICK REFERENCE DRAWER ── */}
      {showLawsDrawer && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] transition-opacity"
          onClick={() => setShowLawsDrawer(false)}
        />
      )}
      <div className={`fixed top-0 right-0 h-full w-[360px] bg-white border-l border-border z-50 shadow-2xl transition-transform duration-300 flex flex-col ${
        showLawsDrawer ? 'translate-x-0' : 'translate-x-full'
      }`}>
        <div className="p-4 border-b border-border flex items-center justify-between bg-bg">
          <div className="font-bold text-sm text-text-1 flex items-center gap-2">
            <span>📖</span> Boolean Laws Reference
          </div>
          <button
            className="w-7 h-7 rounded-md hover:bg-border text-text-3 hover:text-text-1 flex items-center justify-center font-bold text-sm"
            onClick={() => setShowLawsDrawer(false)}
          >
            ✕
          </button>
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-[8px] cursor-pointer"
          onClick={() => setShowSuccess(false)}
        >
          <div
            className="bg-white rounded-2xl px-8 py-8 flex flex-col items-center shadow-2xl max-w-[420px] w-full animate-fade-in border border-border cursor-default"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-[44px] mb-1 leading-none">🎉</div>
            <h2 className="text-[26px] font-extrabold text-accent mb-1">Stage Complete!</h2>
            <p className="text-xs text-text-3 mb-5">Here's how you did across the three metrics</p>

            {scoreResult && (
              <div className="w-full flex flex-col gap-3 mb-5">
                {/* Total score badge */}
                <div className="flex items-center justify-center gap-2 mb-1">
                  <span className={`text-3xl font-extrabold ${
                    scoreResult.total >= 80 ? 'text-green-600' :
                    scoreResult.total >= 50 ? 'text-amber-600' : 'text-red-500'
                  }`}>{scoreResult.total}</span>
                  <span className="text-sm text-text-3 font-medium">/ 100</span>
                </div>

                {/* Metric rows */}
                {[
                  { label: '⚡ Efficiency', score: scoreResult.efficiency, max: 40,
                    sub: `${scoreResult.breakdown.stepsUsed} steps (optimal: ${scoreResult.breakdown.optimalSteps})`,
                    color: 'bg-sky-500' },
                  { label: '🎯 Target Laws', score: scoreResult.targetLaw, max: 30,
                    sub: scoreResult.breakdown.targetLawsRequired.length === 0
                      ? 'No required laws'
                      : `Used ${scoreResult.breakdown.targetLawsUsed.length} / ${scoreResult.breakdown.targetLawsRequired.length} required`,
                    color: 'bg-violet-500' },
                  { label: '💡 Independence', score: scoreResult.hintIndependence, max: 30,
                    sub: `${scoreResult.breakdown.hintsUsed} hint${scoreResult.breakdown.hintsUsed !== 1 ? 's' : ''} used`,
                    color: 'bg-teal' },
                ].map(({ label, score, max, sub, color }) => (
                  <div key={label} className="bg-bg rounded-xl px-4 py-3">
                    <div className="flex justify-between items-baseline mb-1.5">
                      <span className="text-[13px] font-semibold text-text-1">{label}</span>
                      <span className="text-[13px] font-bold text-text-1">{score}<span className="text-text-3 font-normal text-xs"> / {max}</span></span>
                    </div>
                    <div className="w-full h-2 bg-border rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${color} transition-all duration-700`}
                        style={{ width: `${(score / max) * 100}%` }}
                      />
                    </div>
                    <div className="text-[11px] text-text-3 mt-1">{sub}</div>
                  </div>
                ))}

                {/* Optimal hint shown if efficiency < max */}
                {scoreResult.efficiency < 40 && puzzle?.optimalHint && (
                  <div className="text-[12px] text-amber-800 bg-amber-50 border border-amber/30 p-3 rounded-lg w-full leading-relaxed">
                    <strong>💡 Tip:</strong> {puzzle.optimalHint}
                  </div>
                )}
              </div>
            )}

            <div className="inline-block text-[14px] font-bold text-amber-600 bg-amber-50 border-2 border-amber px-4 py-1.5 rounded-full shadow-sm mb-5">
              +{earnedXp + (scoreResult?.earnedPoints ?? 0)} Points
            </div>

            <div className="flex flex-col gap-2.5 w-full">
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

              {/* Review Completed Derivation Button */}
              <button
                className="w-full py-2.5 border border-slate-200 text-text-2 font-semibold text-xs rounded-lg bg-slate-50 transition-all hover:bg-slate-100 hover:text-text-1 flex items-center justify-center gap-1.5"
                onClick={() => setShowSuccess(false)}
              >
                <span>🔍</span> Review Completed Derivation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
