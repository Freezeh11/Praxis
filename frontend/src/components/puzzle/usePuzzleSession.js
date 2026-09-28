/**
 * usePuzzleSession — the orchestration of the puzzle workspace.
 *
 * Owns the route identity (levelId / stageIdx / sandbox), loads the puzzle
 * being played (fetched, restored from a saved solution, or generated in the
 * sandbox), binds the shared game-state machine, and runs the completion +
 * scoring flow. The page above it stays a composition root: tier layout,
 * popups and presentational wiring.
 *
 * Scoring goes through engine/scoring.js — the ONE client-side implementation
 * of the weights; this hook only decides WHEN a solution is scored.
 */
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { TIMING, TUTORIAL } from '../../config/gameRules.js'
import { effectiveOptimalSteps, estimateScore, lawsUsedFromSteps } from '../../engine/index.js'
import { playSound } from '../../services/soundEffects.js'
import { useGameContent } from '../../state/useGameContent.js'
import { useGameState } from '../../state/useGameState.js'
import { useProgress } from '../../state/useProgress.js'

import { SANDBOX_LEVEL, buildSandboxState, resolveCustomPuzzle, useStoredCustomPuzzleSlot } from './sandboxPuzzle.js'

/**
 * @param onPuzzleChange    a different problem was loaded → drop the stale hint
 * @param onWorkspaceReset  the sandbox swapped the problem → drop every transient popup
 */
export default function usePuzzleSession({ onPuzzleChange, onWorkspaceReset }) {
  const { levelId, stageIdx } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { fetchLevel, laws, submitScore } = useGameContent()
  const { progress, addPoints, deductPoints, completeStage, saveScore, getStagesCompleted, saveSolution, getSavedSolution } = useProgress()

  // Sandbox mode: reached via /sandbox, which supplies no route params. It
  // reuses this exact workspace but drives it from a locally generated puzzle
  // and never writes progress.
  const isSandbox = !levelId && !stageIdx

  /**
   * Custom sandbox puzzle: /sandbox validates the typed expression and hands it
   * over as route state, while sessionStorage keeps the same expression across a
   * refresh. A bare /sandbox/play with neither signal keeps the pre-existing
   * generated-problem behaviour (RANDOM mode).
   */
  const [customPuzzle] = useState(() => resolveCustomPuzzle(isSandbox, location.state))
  const isCustomSandbox = isSandbox && Boolean(customPuzzle)

  // First sandbox problem. The sandbox has no level metadata to fetch, so the
  // synthetic stub below is all the workspace ever needs for `level`.
  const [levelPuzzle, setLevelPuzzle] = useState(() => {
    if (!isSandbox) return null
    // A typed expression is already a solved-by-construction puzzle: no need to
    // generate (and discard) a random one before showing it.
    if (customPuzzle) return customPuzzle
    try {
      return buildSandboxState().puzzle
    } catch (err) {
      console.error('Failed to generate the first sandbox problem:', err)
      return null
    }
  })
  const [level, setLevel] = useState(() => (isSandbox ? SANDBOX_LEVEL : null))
  // Bumping the nonce remounts the workspace so no selection/history survives
  // a randomize — the same pattern the removed PracticeWorkspace used.
  const [sandboxNonce, setSandboxNonce] = useState(0)
  const [showSuccess, setShowSuccess] = useState(false)
  const [scoreResult, setScoreResult] = useState(null)
  const loadedAsSavedRef = useRef(false)

  useStoredCustomPuzzleSlot(isSandbox, customPuzzle)

  const stageNum = isSandbox ? 0 : parseInt(stageIdx)
  const completedSet = new Set(isSandbox ? [] : getStagesCompleted(Number(levelId)))

  /** The puzzle currently being played — generated in sandbox, fetched otherwise. */
  const puzzle = levelPuzzle

  // Custom sandbox puzzles can need the complement-guarded Distributive
  // (Expand) law to be solvable (A(B + A') has to reach AB). Graded levels never
  // carry the flag, so their law engine stays exactly as it was.
  const allowExpand = Boolean(puzzle && puzzle.allowExpand)

  const {
    expr, sel, steps,
    applicableLaws,
    isComplete, earnedXp,
    status, statusMsg,
    activeGuidePaths,
    isPreLawHighlight,
    isAnimating, animationData,
    loadPuzzle,
    handleClickLit, handleClickNot, handleClickTerm,
    applyLaw, undoAction, resetPuzzle, requestHint, swapTerms, activateGuide,
    hintsUsed,
    guidesUsed,
    optimalSteps,
  } = useGameState({ allowExpand })

  // 1. Fetch level and set current puzzle (skipped entirely in sandbox mode)
  useEffect(() => {
    if (isSandbox) return

    let isCancelled = false
    setShowSuccess(false)
    onPuzzleChange?.()
    setScoreResult(null)

    fetchLevel(Number(levelId)).then(data => {
      if (isCancelled || !data) return
      setLevel(data)
      const puz = data.puzzles?.[stageNum]
      if (puz) {
        setLevelPuzzle(puz)
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
  }, [levelId, stageNum, navigate, isSandbox])

  // 2. Synchronize puzzle derivation with saved solution (reactive to auth hydration).
  //    Sandbox problems are never saved, so they always start from scratch.
  useEffect(() => {
    if (!puzzle) return

    if (isSandbox) {
      loadedAsSavedRef.current = false
      loadPuzzle(puzzle, null)
      return
    }

    const isTutorial = Number(levelId) === TUTORIAL.levelId && new URLSearchParams(window.location.search).get('tutorial') === 'true'
    const savedSteps = isTutorial ? null : getSavedSolution(Number(levelId), stageNum)
    loadedAsSavedRef.current = Boolean(savedSteps && savedSteps.length > 0)
    loadPuzzle(puzzle, savedSteps)
  }, [puzzle, levelId, stageNum, isSandbox])

  // Handle stage completion
  useEffect(() => {
    if (!isComplete) return

    // If this stage was simply preloaded from an existing saved solution on visit, do NOT auto-popup
    if (loadedAsSavedRef.current) {
      return
    }

    const isFirstTime = !completedSet.has(stageNum)

    // Solve fanfare. Only when the learner actually earned it — a stage merely
    // re-opened from its saved solution is not news, and stays silent.
    playSound('complete')

    // Derive lawsUsed from step history at this moment
    const lawsUsed = lawsUsedFromSteps(steps)
    const effectiveOptimal = effectiveOptimalSteps({
      optimalSteps,
      puzzleOptimalSteps: puzzle?.optimalSteps,
      stepsUsed: steps.length,
    })

    // Compute immediate local score result so UI renders instant 0ms breakdown
    const immediateScore = estimateScore({
      stepsUsed: steps.length,
      optimalSteps: effectiveOptimal,
      targetLaws: puzzle?.targetLaws || [],
      lawsUsed,
      hintsUsed,
      guidesUsed,
    })

    // ── SANDBOX: free practice. Nothing is awarded or persisted — the modal
    // derives its summary from `steps`/`optimalSteps`/`hintsUsed` directly, so
    // there is no score result to store.
    if (isSandbox) {
      const sandboxTimer = setTimeout(() => setShowSuccess(true), TIMING.successModalDelayMs)
      return () => clearTimeout(sandboxTimer)
    }

    if (isFirstTime) {
      addPoints(earnedXp + immediateScore.earnedPoints)
    }
    completeStage(Number(levelId), stageNum)
    saveSolution(Number(levelId), stageNum, steps)

    setScoreResult(immediateScore)
    saveScore(Number(levelId), stageNum, immediateScore.total)

    // Submit score in background to sync with server/database
    submitScore({
      levelId: Number(levelId),
      stageIdx: stageNum,
      stepsUsed: steps.length,
      lawsUsed,
      hintsUsed,
      guidesUsed,
      optimalSteps: effectiveOptimal,
    }).then(result => {
      if (result) {
        saveScore(Number(levelId), stageNum, result.total)
        setScoreResult(result)
      }
    })

    // Auto-pop the complete modal promptly after solving
    const timer = setTimeout(() => setShowSuccess(true), TIMING.successModalDelayMs)
    return () => clearTimeout(timer)
    // Intentionally keyed only on completion: the surrounding values are read
    // at the moment the puzzle is solved. isSandbox is route-derived and stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete])

  const handleOpenScoreSummary = () => {
    // Sandbox is unscored: never submit to the server, just show the breakdown.
    if (isSandbox) {
      setShowSuccess(true)
      return
    }

    if (!scoreResult && isComplete) {
      const lawsUsed = lawsUsedFromSteps(steps)
      const effectiveOptimal = effectiveOptimalSteps({
        optimalSteps,
        puzzleOptimalSteps: puzzle?.optimalSteps,
        stepsUsed: steps.length,
      })
      submitScore({
        levelId: Number(levelId),
        stageIdx: stageNum,
        stepsUsed: steps.length,
        lawsUsed,
        hintsUsed,
        guidesUsed,
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

  /**
   * Sandbox only: swap in a freshly generated, solver-verified problem.
   * Bumping the nonce remounts the workspace so the previous derivation,
   * selection, hint and animation state are all discarded.
   */
  const handleRandomize = () => {
    try {
      const next = buildSandboxState(puzzle?.expr || null)
      setLevel(next.level)
      setLevelPuzzle(next.puzzle)
      setSandboxNonce(n => n + 1)
      setShowSuccess(false)
      onWorkspaceReset?.()
      setScoreResult(null)
      loadedAsSavedRef.current = false
    } catch {
      toast.error('Could not generate a new problem — try again.')
    }
  }

  /** A solution the learner derives themselves is no longer "loaded as saved". */
  const clearLoadedAsSaved = () => {
    loadedAsSavedRef.current = false
  }

  return {
    levelId, stageIdx, isSandbox, isCustomSandbox, customPuzzle,
    level, puzzle, sandboxNonce, stageNum, completedSet,
    showSuccess, setShowSuccess, scoreResult, setScoreResult,
    handleOpenScoreSummary, handleRandomize, clearLoadedAsSaved,
    progress, deductPoints, laws,
    expr, sel, steps,
    applicableLaws,
    isComplete, earnedXp,
    status, statusMsg,
    activeGuidePaths,
    isPreLawHighlight,
    isAnimating, animationData,
    handleClickLit, handleClickNot, handleClickTerm,
    applyLaw, undoAction, resetPuzzle, requestHint, swapTerms, activateGuide,
    hintsUsed,
    guidesUsed,
    optimalSteps,
  }
}
