import { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useApi } from '../hooks/useApi'
import { useProgress } from '../hooks/useProgress'
import { useGameState } from '../hooks/useGameState'
import ExpressionDisplay from '../components/ExpressionDisplay'
import AnimationOverlay from '../components/AnimationOverlay'
import ExprText from '../components/ExprText'
import InteractiveTutorial from '../components/InteractiveTutorial'

export default function ProblemPage() {
  const { levelId, stageIdx } = useParams()
  const navigate = useNavigate()
  const { fetchLevel, laws, submitScore } = useApi()
  const { progress, addPoints, deductPoints, completeStage, saveScore, getStagesCompleted, saveSolution, getSavedSolution } = useProgress()

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
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [dontAskResetAgain, setDontAskResetAgain] = useState(false)
  const [dismissReviewReminder, setDismissReviewReminder] = useState(false)
  const [showStepInspectionTip, setShowStepInspectionTip] = useState(false)
  const [isTutorialActive, setIsTutorialActive] = useState(() => new URLSearchParams(window.location.search).get('tutorial') === 'true')
  const loadedAsSavedRef = useRef(false)

  const stageNum = parseInt(stageIdx)
  const completedSet = new Set(getStagesCompleted(Number(levelId)))

  // Reset review reminder and inspection tip on stage changes
  useEffect(() => {
    setDismissReviewReminder(false)
    setShowStepInspectionTip(false)
  }, [levelId, stageIdx])

  // Dismiss inspection tip whenever a step is actively inspected
  useEffect(() => {
    if (inspectedStepIdx !== null) {
      setShowStepInspectionTip(false)
    }
  }, [inspectedStepIdx])

  // Sync tutorial active state from URL query or tutorial level
  useEffect(() => {
    const isTutQuery = new URLSearchParams(window.location.search).get('tutorial') === 'true'
    const isTutLevel = Number(levelId) === 0
    setIsTutorialActive(isTutQuery || isTutLevel)
  }, [levelId, stageIdx])

  function getLawExplanation(lawName) {
    if (!lawName) return null
    const lower = String(lawName).toLowerCase()
    if (lower.includes('initial')) {
      return 'Starting problem expression.'
    }
    if (lower.includes('distributive')) {
      return 'Factored out a common variable (AB + AC = A(B+C)) or applied POS dual distribution ((A+B)(A+C) = A + BC).'
    }
    if (lower.includes('absorption')) {
      return 'Redundant term absorbed: A + AB = A in sums, and A(A + B) = A in products.'
    }
    if (lower.includes('complement')) {
      return 'Opposites evaluated: A + A\' = 1 in sums, and A · A\' = 0 in products.'
    }
    if (lower.includes('idempotent')) {
      return 'Duplicate terms combined: A + A = A in sums, and A · A = A in products.'
    }
    if (lower.includes('identity')) {
      return 'Neutral element dropped: A + 0 = A in sums, and A · 1 = A in products.'
    }
    if (lower.includes('annulment')) {
      return 'Dominant value takes over: A + 1 = 1 in sums, and A · 0 = 0 in products.'
    }
    if (lower.includes('double neg')) {
      return 'Double NOT cancels out: (A\')\' = A.'
    }
    if (lower.includes('demorgan')) {
      return 'Negated group expanded: (AB)\' = A\' + B\' or (A+B)\' = A\'B\'.'
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
    isPreLawHighlight,
    isAnimating, animationData,
    loadPuzzle,
    handleClickLit, handleClickNot, handleClickTerm,
    applyLaw, undoAction, resetPuzzle, useHint, swapTerms, activateGuide,
    hintsUsed,
    optimalSteps, optimalPath,
  } = useGameState()

  // 1. Fetch level and set current puzzle
  useEffect(() => {
    let isCancelled = false
    setShowSuccess(false)
    setShowHint(false)
    setScoreResult(null)

    fetchLevel(Number(levelId)).then(data => {
      if (isCancelled || !data) return
      setLevel(data)
      const puz = data.puzzles?.[stageNum]
      if (puz) {
        setPuzzle(puz)
      } else {
        navigate(`/level/${levelId}/stages`, { replace: true })
      }
    }).catch(err => {
      if (!isCancelled) {
        console.error('Failed to load level:', err)
        navigate('/levels', { replace: true })
      }
    })

    return () => {
      isCancelled = true
    }
  }, [levelId, stageNum, navigate])

  // 2. Synchronize puzzle derivation with saved solution (reactive to auth hydration)
  const currentSavedKey = `${levelId}:${stageNum}`
  useEffect(() => {
    if (!puzzle) return

    const isTutorial = Number(levelId) === 0 && new URLSearchParams(window.location.search).get('tutorial') === 'true'
    const savedSteps = isTutorial ? null : getSavedSolution(Number(levelId), stageNum)
    loadedAsSavedRef.current = Boolean(savedSteps && savedSteps.length > 0)
    loadPuzzle(puzzle, savedSteps)
  }, [puzzle, levelId, stageNum])

  // Handle stage completion
  useEffect(() => {
    if (!isComplete) return

    // If this stage was simply preloaded from an existing saved solution on visit, do NOT auto-popup
    if (loadedAsSavedRef.current) {
      return
    }

    const isFirstTime = !completedSet.has(stageNum)

    // Derive lawsUsed from step history at this moment
    const nameToId = {
      'Absorption Law': 'absorption',
      'Absorption Law (Product)': 'absorption',
      'Idempotent Law': 'idempotent',
      'Idempotent Law (Product)': 'idempotent',
      'Complement Law': 'complement',
      'Complement Law (Product)': 'complement',
      'Identity Law': 'identity',
      'Identity Law (Product)': 'identity',
      'Annulment Law': 'annulment',
      'Annulment Law (Product)': 'annulment',
      'Double Negation': 'double-neg',
      "De Morgan's (AND\u2192OR)": 'demorgan-and',
      "De Morgan's (OR\u2192AND)": 'demorgan-or',
      'Distributive (Factor)': 'distributive',
      'Distributive (POS)': 'distributive',
    }
    const lawsUsed = steps.map(s => nameToId[s?.law] || s?.law?.toLowerCase() || 'unknown')
    const effectiveOptimal = (optimalSteps && optimalSteps > 0) ? optimalSteps : (puzzle?.optimalSteps || steps.length)

    // Compute immediate local score result so UI renders instant 0ms breakdown
    const target_laws = new Set(puzzle?.targetLaws || [])
    const laws_used = new Set(lawsUsed)
    const efficiency = steps.length <= effectiveOptimal ? 40.0 : Math.max(0.0, 40.0 - (steps.length - effectiveOptimal) * 10.0)
    const target_law = target_laws.size === 0 ? 30.0 : Math.round((Array.from(target_laws).filter(l => laws_used.has(l)).length / target_laws.size) * 30.0 * 10) / 10
    const hint_independence = hintsUsed === 0 ? 30.0 : Math.max(0.0, 30.0 - hintsUsed * 10.0)
    const total = Math.round((efficiency + target_law + hint_independence) * 10) / 10
    const earnedPoints = Math.round((total / 100.0) * 5) // +5 bonus for 100% score

    if (isFirstTime) {
      addPoints(earnedXp + earnedPoints)
    }
    completeStage(Number(levelId), stageNum)
    saveSolution(Number(levelId), stageNum, steps)

    const immediateScore = {
      efficiency,
      targetLaw: target_law,
      hintIndependence: hint_independence,
      total,
      earnedPoints,
      breakdown: {
        stepsUsed: steps.length,
        optimalSteps: effectiveOptimal,
        targetLawsRequired: Array.from(target_laws),
        targetLawsUsed: Array.from(laws_used).filter(l => target_laws.has(l)),
        hintsUsed: hintsUsed || 0,
      },
    }
    setScoreResult(immediateScore)
    saveScore(Number(levelId), stageNum, total)

    // Submit score in background to sync with server/database
    submitScore({
      levelId: Number(levelId),
      stageIdx: stageNum,
      stepsUsed: steps.length,
      lawsUsed,
      hintsUsed,
      optimalSteps: effectiveOptimal,
    }).then(result => {
      if (result) {
        saveScore(Number(levelId), stageNum, result.total)
        setScoreResult(result)
      }
    })

    // Auto-pop the complete modal promptly after solving
    const timer = setTimeout(() => setShowSuccess(true), 200)
    return () => clearTimeout(timer)
  }, [isComplete])

  // Global click-away listener for derivation step inspection
  useEffect(() => {
    if (inspectedStepIdx === null) return
    const handlePointerDown = (e) => {
      if (e.target.closest('[data-inspect-card]') || e.target.closest('[data-inspect-trigger]')) {
        return
      }
      setInspectedStepIdx(null)
    }
    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [inspectedStepIdx])

  const handleOpenScoreSummary = () => {
    if (!scoreResult && isComplete) {
      const nameToId = {
        'Absorption Law': 'absorption',
        'Absorption Law (Product)': 'absorption',
        'Idempotent Law': 'idempotent',
        'Idempotent Law (Product)': 'idempotent',
        'Complement Law': 'complement',
        'Complement Law (Product)': 'complement',
        'Identity Law': 'identity',
        'Identity Law (Product)': 'identity',
        'Annulment Law': 'annulment',
        'Annulment Law (Product)': 'annulment',
        'Double Negation': 'double-neg',
        "De Morgan's (AND\u2192OR)": 'demorgan-and',
        "De Morgan's (OR\u2192AND)": 'demorgan-or',
        'Distributive (Factor)': 'distributive',
        'Distributive (POS)': 'distributive',
      }
      const lawsUsed = steps.map(s => nameToId[s?.law] || s?.law?.toLowerCase() || 'unknown')
      const effectiveOptimal = (optimalSteps && optimalSteps > 0) ? optimalSteps : (puzzle?.optimalSteps || steps.length)
      submitScore({
        levelId: Number(levelId),
        stageIdx: stageNum,
        stepsUsed: steps.length,
        lawsUsed,
        hintsUsed,
        optimalSteps: effectiveOptimal,
      }).then(result => {
        if (result) {
          saveScore(Number(levelId), stageNum, result.total)
          setScoreResult(result)
        }
        setShowSuccess(true)
      })
    } else {
      setShowSuccess(true)
    }
  }

  const handleHint = () => {
    if (!puzzle || isComplete) return
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
      const isTutLevel = Number(levelId) === 0
      const tutParam = isTutLevel ? '?tutorial=true' : ''
      navigate(`/level/${levelId}/stage/${nextIdx}${tutParam}`)
    } else {
      if (Number(levelId) === 0) {
        setIsTutorialActive(false)
      }
      navigate(`/level/${levelId}/stages`)
    }
  }

  const handleGuide = () => {
    if (isComplete) return
    if (progress.points >= 20) {
      const activated = activateGuide()
      if (activated) {
        deductPoints(20)
      }
    } else {
      alert("Not enough points! You need 20 points to use the Guide.")
    }
  }

  const handleResetClick = () => {
    // If the stage is completed and user hasn't opted out in this session
    const skipPrompt = sessionStorage.getItem('praxis_skip_reset_confirm') === 'true'
    if (isComplete && !skipPrompt) {
      setDontAskResetAgain(false)
      setShowResetConfirm(true)
    } else {
      executeReset()
    }
  }

  const executeReset = () => {
    if (dontAskResetAgain) {
      sessionStorage.setItem('praxis_skip_reset_confirm', 'true')
    }
    setInspectedStepIdx(null)
    loadedAsSavedRef.current = false
    setShowResetConfirm(false)
    setShowSuccess(false)
    setShowHint(false)
    resetPuzzle(puzzle)
  }

  const handleUndo = () => {
    setInspectedStepIdx(null)
    loadedAsSavedRef.current = false
    undoAction()
  }

  /* Wrapper functions to pass current expr snapshot to handlers */
  const onClickLit = (path) => {
    setInspectedStepIdx(null)
    if (expr) handleClickLit(path, expr)
  }
  const onClickNot = (path) => {
    setInspectedStepIdx(null)
    if (expr) handleClickNot(path, expr)
  }
  const onClickTerm = (path) => {
    setInspectedStepIdx(null)
    if (expr) handleClickTerm(path, expr)
  }
  const onApplyLaw = (law) => {
    setInspectedStepIdx(null)
    loadedAsSavedRef.current = false
    const enableTutorialPause = isTutorialActive && stageNum < 3
    if (expr) applyLaw(law, expr, steps, hintsUsed, enableTutorialPause)
  }
  const onSwapTerms = (sumPath, fromIdx, toIdx) => {
    setInspectedStepIdx(null)
    loadedAsSavedRef.current = false
    swapTerms(sumPath, fromIdx, toIdx)
  }

  if (!level || !puzzle) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-7 w-7 text-accent" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm font-semibold text-text-3">Loading stage...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      {/* ── LEFT PANEL: Step History ── */}
      <aside data-tutorial="step-history-panel" className="w-[260px] min-w-[200px] max-w-[300px] bg-white border-r border-border flex flex-col overflow-hidden">
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
                data-tutorial={`step-history-card-${i}`}
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
                  className={`mt-1.5 inline-flex items-center text-[10px] font-sans font-semibold rounded px-2 py-0.5 transition-colors ${
                    isInspected
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'text-teal bg-white border border-teal'
                  }`}
                >
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
            >100%</button>
            <button
              className="w-8 h-8 rounded-md border border-border bg-bg text-[16px] text-text-2 flex items-center justify-center transition-all hover:bg-border hover:text-text-1 disabled:opacity-30 disabled:cursor-not-allowed"
              onClick={() => setZoom(z => Math.min(ZOOM_MAX, parseFloat((z + ZOOM_STEP).toFixed(2))))}
              disabled={zoom >= ZOOM_MAX}
              title="Zoom in"
            >+</button>

            <div className="w-[1px] h-4 bg-border mx-1" />

            {/* Undo & Reset group */}
            <div data-tutorial="undo-reset-group" className="flex items-center gap-1.5">
              <button
                data-tutorial="undo-button"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border-[1.5px] border-border bg-bg text-xs font-semibold text-text-2 transition-all hover:bg-border hover:text-text-1 disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={handleUndo}
                disabled={steps.length === 0}
                title="Undo last step"
              >
                <span>↶</span> Undo
              </button>

              <button
                data-tutorial="reset-button"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border-[1.5px] border-border bg-bg text-xs font-semibold text-text-2 transition-all hover:bg-border hover:text-text-1"
                onClick={handleResetClick}
                title="Reset problem to start"
              >
                <span>↺</span> Reset
              </button>
            </div>

            <div className="w-[1px] h-4 bg-border mx-1" />

            {/* Interactive Tutorial Button */}
            <button
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-semibold transition-all ${
                isTutorialActive
                  ? 'bg-teal text-white border-teal shadow-xs'
                  : 'border-border bg-bg text-text-2 hover:bg-border hover:text-text-1'
              }`}
              onClick={() => {
                setIsTutorialActive(prev => {
                  const next = !prev
                  if (next && puzzle) {
                    loadedAsSavedRef.current = false
                    setShowSuccess(false)
                    setShowHint(false)
                    setScoreResult(null)
                    resetPuzzle(puzzle)
                  }
                  return next
                })
              }}
              title="Toggle Interactive Tutorial Guide"
            >
              Tutorial
            </button>
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
            <div data-tutorial="canvas" style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', transition: 'transform 0.18s ease' }}>
              {/* Derivation chain — clean FIFO top-to-bottom queue */}
            {expr && (() => {
              const totalSteps = steps.length

              // Build unified list of derivation lines
              const lines = []
              if (totalSteps === 0) {
                lines.push({
                  key: 'active-0',
                  isFirst: true,
                  isActive: true,
                  text: null,
                  stepIdx: null,
                  law: null,
                })
              } else {
                // Line 0: Starting problem
                lines.push({
                  key: 'past-0',
                  isFirst: true,
                  isActive: false,
                  text: steps[0].from,
                  stepIdx: 0,
                  law: steps[0].law,
                })
                // Intermediate lines
                for (let i = 1; i < totalSteps; i++) {
                  lines.push({
                    key: `past-${i}`,
                    isFirst: false,
                    isActive: false,
                    text: steps[i - 1].to,
                    stepIdx: i,
                    law: steps[i].law,
                  })
                }
                // Active bottom line
                lines.push({
                  key: `active-${totalSteps}`,
                  isFirst: false,
                  isActive: true,
                  text: null,
                  stepIdx: null,
                  law: null,
                })
              }

              return (
                <motion.div
                  layout
                  className="flex flex-col gap-3 font-mono text-[22px] font-medium items-start select-none"
                  onClick={() => setInspectedStepIdx(null)}
                >
                  {lines.map((line, idx) => {
                    const isFromInspected = line.stepIdx !== null && inspectedStepIdx === line.stepIdx
                    const isToInspected = idx > 0 && inspectedStepIdx === idx - 1
                    const isLineHighlighted = isFromInspected || isToInspected
                    return (
                      <motion.div
                        layout
                        key={line.key}
                        initial={{ opacity: 0, y: line.isActive && idx > 0 ? 6 : 0 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
                        className="relative flex items-center min-h-[44px] gap-2.5"
                      >
                        {/* Stepper Left Rail: Dot + Symmetrical Connector Line (Independent Column with z-30) */}
                        <div className="relative flex items-center justify-center w-6 self-stretch shrink-0 select-none z-30">
                          {/* Downward connector line centered exactly between node i and node i+1 */}
                          {line.stepIdx !== null && (
                            <button
                              type="button"
                              data-inspect-trigger="true"
                              onClick={(e) => {
                                e.stopPropagation()
                                setInspectedStepIdx(prev => (prev === line.stepIdx ? null : line.stepIdx))
                              }}
                              className="group absolute top-[calc(50%+8px)] left-1/2 -translate-x-1/2 w-6 h-[calc(100%-4px)] flex items-center justify-center cursor-pointer p-0 bg-transparent border-0 z-30"
                              title={`Click to inspect ${line.law}`}
                            >
                              {/* Symmetrical vertical line */}
                              <div
                                className={`w-[2px] h-full rounded-full transition-all duration-200 ${
                                  inspectedStepIdx === line.stepIdx
                                    ? 'bg-teal w-[3px] shadow-sm'
                                    : 'bg-slate-300 group-hover:bg-teal group-hover:w-[3px]'
                                }`}
                              />
                            </button>
                          )}

                          {/* Node Dot */}
                          {isLineHighlighted ? (
                            <div className="relative z-30 w-3 h-3 rounded-full bg-teal ring-4 ring-teal/20 shadow-xs transition-all duration-200" />
                          ) : line.isActive ? (
                            <div className="relative z-30 flex items-center justify-center w-4 h-4 rounded-full border-2 border-teal bg-white shadow-xs transition-all">
                              <div className="w-1.5 h-1.5 rounded-full bg-teal animate-pulse" />
                            </div>
                          ) : (
                            <div className="relative z-30 w-2.5 h-2.5 rounded-full bg-slate-300 transition-all duration-200" />
                          )}

                          {/* Floating Law Context Card anchored at the exact midpoint of the transition */}
                          <AnimatePresence>
                            {line.stepIdx !== null && inspectedStepIdx === line.stepIdx && (
                              <div
                                data-inspect-card="true"
                                className="absolute right-full top-[calc(100%+6px)] -translate-y-1/2 mr-4 z-40 pointer-events-auto"
                                onClick={e => e.stopPropagation()}
                              >
                                <motion.div
                                  initial={{ opacity: 0, x: -6, scale: 0.96 }}
                                  animate={{ opacity: 1, x: 0, scale: 1 }}
                                  exit={{ opacity: 0, x: -6, scale: 0.96 }}
                                  transition={{ duration: 0.18, ease: 'easeOut' }}
                                  className="bg-white border border-teal/40 shadow-xl rounded-xl p-3.5 text-left w-[260px] select-none"
                                >
                                  <div className="flex items-center justify-between gap-1 text-[11px] font-bold text-teal uppercase tracking-wide border-b border-slate-100 pb-1.5 mb-1.5">
                                    <span>{line.law}</span>
                                    <button
                                      type="button"
                                      onClick={() => setInspectedStepIdx(null)}
                                      className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 w-5 h-5 rounded flex items-center justify-center font-bold text-xs transition-colors"
                                      title="Close explanation"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                  <div className="text-[12px] text-slate-600 leading-relaxed font-sans font-normal">
                                    {getLawExplanation(line.law)}
                                  </div>
                                </motion.div>
                              </div>
                            )}
                          </AnimatePresence>

                          {/* Small dismissable modal pointing at the connection line after Stage 2 tutorial */}
                          <AnimatePresence>
                            {showStepInspectionTip && idx === 0 && line.stepIdx !== null && inspectedStepIdx === null && (
                              <div
                                className="absolute right-full top-[calc(100%+6px)] -translate-y-1/2 mr-4 z-40 pointer-events-auto select-none"
                                onClick={e => e.stopPropagation()}
                              >
                                <motion.div
                                  initial={{ opacity: 0, x: -8, scale: 0.95 }}
                                  animate={{ opacity: 1, x: 0, scale: 1 }}
                                  exit={{ opacity: 0, x: -8, scale: 0.95 }}
                                  transition={{ duration: 0.2, ease: 'easeOut' }}
                                  className="bg-white border-2 border-teal/70 shadow-2xl rounded-2xl p-3.5 w-[250px] text-left relative flex flex-col gap-2 ring-4 ring-teal/10"
                                >
                                  {/* Right Pointer Triangle pointing directly at the connection line */}
                                  <div className="absolute top-1/2 -right-2 -translate-y-1/2 w-0 h-0 border-t-[7px] border-t-transparent border-b-[7px] border-b-transparent border-l-[8px] border-l-teal/70" />

                                  <div className="flex items-center gap-1.5 text-xs font-bold text-teal">
                                    <span>💡</span> Try Inspecting Steps
                                  </div>

                                  <p className="text-[11.5px] text-text-2 leading-relaxed font-sans font-normal">
                                    Click any past step in the left history panel OR any connection line between equations to inspect the applied law and reasoning!
                                  </p>

                                  <div className="flex justify-end pt-1">
                                    <button
                                      type="button"
                                      onClick={() => setShowStepInspectionTip(false)}
                                      className="px-3.5 py-1 bg-teal hover:bg-teal-dark text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                                    >
                                      Okay
                                    </button>
                                  </div>
                                </motion.div>
                              </div>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Formula Display with Highlight Box wrapping ONLY the equation */}
                        <div
                          data-tutorial={line.isActive ? "active-equation" : undefined}
                          className={`relative flex items-baseline gap-1.5 px-3 py-1.5 rounded-xl border transition-all duration-300 ${
                            isLineHighlighted
                              ? 'border-sky-300 bg-sky-50/70 shadow-xs ring-1 ring-sky-200/60'
                              : 'border-transparent'
                          }`}
                        >
                          <span
                            className={`font-mono text-[22px] whitespace-pre shrink-0 select-none mr-1 transition-colors duration-300 ${
                              isLineHighlighted ? 'text-teal font-semibold' : 'text-text-2 font-medium'
                            }`}
                          >
                            {line.isFirst ? 'F =' : '\u00a0\u00a0='}
                          </span>
                          {line.isActive ? (
                            <ExpressionDisplay
                              expr={expr}
                              sel={sel}
                              onClickLit={onClickLit}
                              onClickNot={onClickNot}
                              onClickTerm={onClickTerm}
                              onSwapTerms={swapTerms}
                              activeGuidePaths={activeGuidePaths}
                              animationPaths={isAnimating ? animationData?.paths : []}
                              animationLaw={isAnimating ? animationData?.lawId : null}
                            />
                          ) : (
                            <ExprText
                              text={line.text}
                              className={isLineHighlighted ? 'text-slate-900 font-semibold' : 'text-text-1'}
                            />
                          )}
                        </div>
                      </motion.div>
                    )
                  })}
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
        <div data-tutorial="laws-dock" className="border-t-[1.5px] border-border p-3 px-5 pb-4 bg-white shrink-0">
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
                  data-tutorial="reopen-score-btn"
                  className="px-3.5 py-2 border border-slate-200 text-text-2 font-semibold text-xs rounded-lg bg-slate-50 hover:bg-slate-100 hover:text-text-1 transition-all cursor-pointer"
                  onClick={handleOpenScoreSummary}
                >
                  📊 Score Summary
                </button>
                {level && stageNum + 1 < level.puzzles.length ? (
                  <button
                    data-tutorial="next-stage-btn"
                    className="px-5 py-2 bg-accent text-white rounded-lg font-semibold text-sm transition-all shadow-sm hover:bg-text-1 hover:shadow-md hover:-translate-y-px"
                    onClick={handleNextStage}
                  >
                    Next Stage →
                  </button>
                ) : (
                  <button
                    data-tutorial="next-stage-btn"
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
                      data-tutorial={`law-card-${i}`}
                      data-law-id={law.id}
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
            <span className="text-xs font-bold text-teal">{completedSet.size} / {level?.puzzles.length ?? '?'} Completed</span>
          </div>
          <div className="h-1.5 bg-border rounded-full mb-1.5 overflow-hidden">
            <div
              className="h-full bg-teal transition-all duration-300 rounded-full"
              style={{ width: `${level && level.puzzles.length > 0 ? (completedSet.size / level.puzzles.length) * 100 : 0}%` }}
            />
          </div>
          <div className="text-[10.5px] text-text-3 font-medium">
            {level?.name || 'Level Stages'}
          </div>
        </div>

        {/* Middle: User Points & Assistance Controls (Replaced Target Box) */}
        <div data-tutorial="points-and-assistance" className="p-3.5 border-b border-border flex flex-col gap-2.5 bg-white">
          {/* User Points Card */}
          <div data-tutorial="points-card" className="flex items-center justify-between px-3.5 py-2.5 bg-amber-50/70 border border-amber/40 rounded-xl">
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
                +10 to +15 on clear
              </span>
            </div>
          </div>

          {/* Hint & Guide Action Buttons */}
          <div data-tutorial="assistance-group" className="flex gap-2">
            <button
              data-tutorial="hint-button"
              className="flex-1 py-2 px-2.5 rounded-lg text-xs font-semibold border border-border bg-bg text-text-2 transition-all hover:bg-border/60 hover:text-text-1 flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-bg disabled:hover:text-text-2"
              onClick={handleHint}
              disabled={isComplete}
              title={isComplete ? "Expression is already simplified" : "Get a hint for the next step"}
            >
              <span>💡</span> Hint
            </button>
            <button
              data-tutorial="guide-button"
              className="flex-1 py-2 px-2 rounded-lg text-xs font-semibold border border-amber/50 bg-amber-50/80 text-amber-900 transition-all hover:bg-amber-100 hover:border-amber flex items-center justify-center gap-1 shadow-xs disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-amber-50/80 disabled:hover:border-amber/50"
              onClick={handleGuide}
              disabled={isComplete || (progress.points ?? 0) < 20}
              title={isComplete ? "Expression is already simplified" : "Highlight terms for the next move (Costs 20 pts)"}
            >
              <span>🎯</span> Guide <span className="text-[10px] text-amber-700 font-normal">(20p)</span>
            </button>
          </div>

          {/* Quick Laws Reference Drawer Trigger */}
          <button
            data-tutorial="laws-reference-button"
            className="w-full py-2 px-3 bg-bg border border-border rounded-lg text-xs font-semibold text-text-2 hover:bg-border/60 transition-all flex items-center justify-between shadow-xs"
            onClick={() => setShowLawsDrawer(true)}
          >
            <span>📖 Laws Quick Reference</span>
            <span className="text-text-3">→</span>
          </button>
        </div>

        {/* Level Puzzles List (Quick Stage Select) */}
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1.5">
          {/* Review Mode Reminder Card */}
          {isComplete && !showSuccess && !dismissReviewReminder && level && stageNum + 1 < level.puzzles.length && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="bg-emerald-50 border border-emerald-500/60 rounded-xl p-2.5 mb-1.5 flex flex-col gap-2 shadow-2xs"
            >
              <div className="flex items-start gap-2">
                <span className="relative flex h-2 w-2 mt-1 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <div className="text-[11.5px] leading-snug font-semibold text-emerald-950">
                  When you're ready, press the next stage.
                </div>
              </div>
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setDismissReviewReminder(true)}
                  className="px-3 py-0.5 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-[11px] font-bold transition-all cursor-pointer shadow-2xs"
                >
                  Okay
                </button>
              </div>
            </motion.div>
          )}

          <div className="text-[10px] font-bold tracking-[1px] uppercase text-text-3 mb-1 px-1">STAGES</div>
          {level?.puzzles.map((p, idx) => {
            const isCurrent = idx === stageNum
            const isCompleted = completedSet.has(idx)
            const isAvailable = idx === 0 || completedSet.has(idx - 1) || isCompleted
            const isLocked = !isAvailable && !isCompleted
            const isNextAvailable = isComplete && !showSuccess && idx === stageNum + 1 && (idx === 0 || completedSet.has(idx - 1) || isCompleted)

            return (
              <button
                key={p.id || idx}
                disabled={isLocked || isTutorialActive}
                onClick={() => {
                  if (!isLocked && !isTutorialActive && levelId) {
                    const isTutLevel = Number(levelId) === 0
                    const tutParam = isTutLevel ? '?tutorial=true' : ''
                    navigate(`/level/${levelId}/stage/${idx}${tutParam}`)
                  }
                }}
                className={`flex items-center justify-between p-2.5 rounded-lg text-left transition-all border ${
                  isTutorialActive
                    ? isCurrent
                      ? 'bg-teal/10 border-teal text-teal font-bold shadow-xs'
                      : 'bg-transparent border-transparent text-text-3 opacity-40 cursor-not-allowed pointer-events-none'
                    : isNextAvailable
                    ? 'ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50 text-emerald-800 font-bold shadow-md animate-pulse cursor-pointer'
                    : isCurrent
                    ? 'bg-teal/10 border-teal text-teal font-bold shadow-xs'
                    : isCompleted
                    ? 'bg-bg/50 border-transparent text-text-2 hover:bg-bg hover:border-border cursor-pointer'
                    : isAvailable
                    ? 'bg-transparent border-border text-text-1 hover:bg-bg cursor-pointer'
                    : 'bg-transparent border-transparent text-text-3 opacity-40 cursor-not-allowed pointer-events-none'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs w-4">{idx + 1}.</span>
                  <span className="font-mono text-xs">{p.initial || `Stage ${idx + 1}`}</span>
                </div>
                {isNextAvailable && (
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Next →</span>
                )}
                {!isNextAvailable && isCompleted && <span className="text-teal text-xs font-bold">✓</span>}
                {!isNextAvailable && isLocked && <span className="text-xs text-text-3 opacity-60">🔒</span>}
              </button>
            )
          })}
        </div>
      </aside>

      {/* ── LAWS QUICK REFERENCE DRAWER (Smooth 60FPS Framer Motion) ── */}
      <AnimatePresence>
        {showLawsDrawer && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/25"
              onClick={() => setShowLawsDrawer(false)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 350 }}
              className="fixed top-0 right-0 h-full w-[360px] bg-white border-l border-border z-50 shadow-2xl flex flex-col will-change-transform"
            >
              <div className="p-4 border-b border-border flex items-center justify-between bg-bg">
                <div className="font-bold text-sm text-text-1 flex items-center gap-2">
                  <span>📖</span> Boolean Laws Reference
                </div>
                <button
                  type="button"
                  className="w-7 h-7 rounded-md hover:bg-border text-text-3 hover:text-text-1 flex items-center justify-center font-bold text-sm transition-colors"
                  onClick={() => setShowLawsDrawer(false)}
                >
                  ✕
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                {laws && laws.map(law => (
                  <div key={law.id} className="bg-bg border border-border rounded-lg p-3.5 text-left">
                    <div className="text-[13px] font-bold text-text-1 mb-1">{law.name}</div>
                    <div className="flex flex-col gap-1 my-2 bg-white border border-border rounded px-3 py-2 shadow-xs">
                      {law.formulas && law.formulas.map((f, idx) => (
                        <div key={idx} className="font-mono text-xs font-semibold text-text-1">{f}</div>
                      ))}
                    </div>
                    <div className="text-[12px] text-text-3 leading-relaxed mt-2">{law.desc}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── SUCCESS OVERLAY ── */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            key="success-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={`fixed inset-0 z-50 flex items-center justify-center cursor-pointer ${
              isTutorialActive ? 'bg-transparent' : 'bg-white/60 backdrop-blur-[8px]'
            }`}
            onClick={() => setShowSuccess(false)}
          >
            <motion.div
              data-tutorial="score-modal"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -6 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="bg-white rounded-2xl px-8 py-8 flex flex-col items-center shadow-2xl max-w-[420px] w-full border border-border cursor-default"
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
                      sub: `${scoreResult.breakdown?.stepsUsed ?? 0} steps (optimal: ${scoreResult.breakdown?.optimalSteps ?? 1})`,
                      color: 'bg-sky-500' },
                    { label: '🎯 Target Laws', score: scoreResult.targetLaw, max: 30,
                      sub: (scoreResult.breakdown?.targetLawsRequired || []).length === 0
                        ? 'No required laws'
                        : `Used ${(scoreResult.breakdown?.targetLawsUsed || []).length} / ${(scoreResult.breakdown?.targetLawsRequired || []).length} required`,
                      color: 'bg-violet-500' },
                    { label: '💡 Independence', score: scoreResult.hintIndependence, max: 30,
                      sub: `${scoreResult.breakdown?.hintsUsed ?? 0} hint${scoreResult.breakdown?.hintsUsed !== 1 ? 's' : ''} used`,
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
                    <button
                      disabled={isTutorialActive}
                      className={`flex-1 py-3 bg-accent text-white rounded-lg font-semibold text-sm transition-all shadow-md ${
                        isTutorialActive
                          ? 'opacity-40 cursor-not-allowed'
                          : 'hover:bg-text-1 hover:shadow-lg hover:-translate-y-px cursor-pointer'
                      }`}
                      onClick={handleNextStage}
                    >
                      Next Stage →
                    </button>
                  ) : (
                    <button
                      disabled={isTutorialActive}
                      className={`flex-1 py-3 bg-accent text-white rounded-lg font-semibold text-sm transition-all shadow-md ${
                        isTutorialActive
                          ? 'opacity-40 cursor-not-allowed'
                          : 'hover:bg-text-1 hover:shadow-lg hover:-translate-y-px cursor-pointer'
                      }`}
                      onClick={() => navigate(`/level/${levelId}/stages`)}
                    >
                      Back to Stages
                    </button>
                  )}
                  <button
                    disabled={isTutorialActive}
                    className={`px-5 py-3 border-[1.5px] border-border text-text-2 font-semibold text-sm rounded-lg bg-transparent transition-all ${
                      isTutorialActive
                        ? 'opacity-40 cursor-not-allowed'
                        : 'hover:bg-bg hover:border-border-dark cursor-pointer'
                    }`}
                    onClick={executeReset}
                  >
                    Try Again
                  </button>
                </div>

                {/* Review Completed Derivation Button */}
                <button
                  data-tutorial="review-derivation-btn"
                  className="w-full py-2.5 border border-slate-200 text-text-2 font-semibold text-xs rounded-lg bg-slate-50 transition-all hover:bg-slate-100 hover:text-text-1 flex items-center justify-center gap-1.5 cursor-pointer"
                  onClick={() => setShowSuccess(false)}
                >
                  <span>🔍</span> Review Completed Derivation
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── RESET CONFIRMATION MODAL ── */}
      {showResetConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[2px] cursor-pointer"
          onClick={() => setShowResetConfirm(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 flex flex-col shadow-2xl max-w-[380px] w-full border border-border cursor-default"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-lg font-bold shrink-0">
                ↺
              </div>
              <div>
                <h3 className="text-[16px] font-bold text-text-1">Reset this stage?</h3>
                <p className="text-xs text-text-3 mt-0.5">Are you sure you want to reset the stage? This will clear your current derivation so you can solve it from scratch.</p>
              </div>
            </div>

            {/* Don't ask me again checkbox */}
            <label className="flex items-center gap-2.5 mt-2 mb-5 px-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={dontAskResetAgain}
                onChange={e => setDontAskResetAgain(e.target.checked)}
                className="w-4 h-4 rounded border-border text-teal focus:ring-teal cursor-pointer accent-teal"
              />
              <span className="text-xs text-text-2 font-medium">Don't ask me again for this session</span>
            </label>

            {/* Action buttons: Go back & Reset */}
            <div className="flex items-center gap-3 w-full mt-1">
              <button
                type="button"
                className="flex-1 py-2.5 px-4 text-xs font-bold text-text-2 bg-bg hover:bg-border/70 hover:text-text-1 border border-border rounded-xl transition-all shadow-xs"
                onClick={() => setShowResetConfirm(false)}
              >
                Go back
              </button>
              <button
                type="button"
                className="flex-1 py-2.5 px-4 text-xs font-bold text-white bg-red hover:opacity-90 rounded-xl transition-all shadow-sm active:scale-[0.98]"
                style={{ backgroundColor: '#ef4444', color: '#ffffff' }}
                onClick={executeReset}
              >
                Reset Stage
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── INTERACTIVE TUTORIAL OVERLAY ── */}
      {isTutorialActive && (
        <InteractiveTutorial
          stageIdx={stageNum}
          sel={sel}
          steps={steps}
          expr={expr}
          applicableLaws={applicableLaws}
          isComplete={isComplete}
          isPreLawHighlight={isPreLawHighlight}
          isAnimating={isAnimating}
          showSuccess={showSuccess}
          onResetStage={executeReset}
          onNextStage={() => {
            if (stageNum + 1 < (level?.puzzles?.length || 4)) {
              navigate(`/level/0/stage/${stageNum + 1}?tutorial=true`)
            } else {
              setIsTutorialActive(false)
              navigate('/level/0/stages')
            }
          }}
          onFinish={() => {
            setIsTutorialActive(false)
            if (stageNum === 1) {
              setShowStepInspectionTip(true)
            }
            if (stageNum + 1 >= (level?.puzzles?.length || 4)) {
              navigate('/levels')
            }
          }}
          onSkip={() => {
            setIsTutorialActive(false)
            navigate('/level/0/stages')
          }}
        />
      )}
    </div>
  )
}
