import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import {
  parseExpr, cloneN, canonText, nodeText, getNode,
  analyzeSelection, analyzeNot, analyzeProductConst, analyzeSumConst, getLegalTransitions,
  findOptimalPath,
  findOptimalPathWithLaws,
  evaluateLawChoice, selectionLaws, planGuidance, lawsUsedFromSteps,
} from '../engine/index.js'
import { STAGE_COMPLETION_XP, TIMING, SANDBOX } from '../config/gameRules.js'
import { playSound, primeAudio } from '../services/soundEffects.js'
import { hasLawAnimation } from '../components/animations/index.js'
import { DEAD_END_MSG, buildHintText } from './hintText.js'

export function useGameState(options = {}) {
  // Sandbox-only engine opt-in: enables the gated Distributive-Expand law.
  // Graded levels never enable expansion; independent selection only changes
  // how the learner chooses an existing supported transformation.
  const { allowExpand = false, independent = true, allowedLawIds = null } = options || {}
  const engineOptions = useMemo(() => ({ allowExpand, allowedLawIds }), [allowExpand, allowedLawIds])
  const [history, setHistory] = useState([]) // Array of { expr, step }
  const expr = history.length > 0 ? history[history.length - 1].expr : null
  const steps = useMemo(() => history.slice(1).map(h => h.step), [history])
  // Derived from history only; rebuilt on every render before, including the
  // renders triggered by a selection or a status message.
  const exprHistory = useMemo(
    () => (history.length > 1 ? history.slice(0, -1).map(h => h.expr) : []),
    [history],
  )

  const [sel, setSel] = useState([])
  const [selectedLaw, setSelectedLaw] = useState(null)
  const [goalText, setGoalText] = useState('')
  const [goalCanon, setGoalCanon] = useState('')
  const [hintIdx, setHintIdx] = useState(0)
  const [hintsUsed, setHintsUsed] = useState(0)
  const [guidesUsed, setGuidesUsed] = useState(0)
  const [optimalSteps, setOptimalSteps] = useState(0)
  const [optimalPath, setOptimalPath] = useState([])
  const [applicableLaws, setApplicableLaws] = useState([])
  const [status, setStatus] = useState('select') // 'select' | 'laws' | 'applying' | 'success' | 'error'
  const [statusMsg, setStatusMsg] = useState('Choose a law from the palette to begin')
  const [isComplete, setIsComplete] = useState(false)
  const [isDeadEnd, setIsDeadEnd] = useState(false)
  const [earnedXp, setEarnedXp] = useState(0)
  const [activeGuidePaths, setActiveGuidePaths] = useState([])
  const [isPreLawHighlight, setIsPreLawHighlight] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [animationData, setAnimationData] = useState(null)
  const [choiceAttempts, setChoiceAttempts] = useState([])

  const preLawTimerRef = useRef(null)
  const animationTimerRef = useRef(null)
  const goalCanonRef = useRef('')
  const currentPuzzleExprRef = useRef('')
  const puzzleRef = useRef(null)
  const interactionLockedRef = useRef(false)
  const assistanceRef = useRef(false)
  const guidanceCacheRef = useRef(null)
  const hintLevelRef = useRef({ key: '', level: 0 })

  useEffect(() => () => {
    clearTimeout(preLawTimerRef.current)
    clearTimeout(animationTimerRef.current)
  }, [])
  /** Tracks the dead-end transition so its cue fires once, not on every resync. */
  const isDeadEndRef = useRef(false)

  /** Cues follow the dead-end TRANSITION, so a re-derived status stays silent. */
  const markDeadEnd = useCallback((next, { silent = false } = {}) => {
    if (next && !isDeadEndRef.current && !silent) playSound('wrong')
    isDeadEndRef.current = next
    setIsDeadEnd(next)
  }, [])

  const syncDeadEndStatus = useCallback((exprSnapshot, fallbackMsg = 'Choose a law from the palette to begin', { silent = false } = {}) => {
    if (!exprSnapshot) return false

    if (canonText(exprSnapshot) === goalCanonRef.current) {
      markDeadEnd(false, { silent })
      return false
    }

    const hints = getLegalTransitions(exprSnapshot, engineOptions)
    if (hints.length === 0) {
      markDeadEnd(true, { silent })
      setApplicableLaws([])
      setStatus('error')
      setStatusMsg(DEAD_END_MSG)
      return true
    }

    markDeadEnd(false, { silent })
    setStatus('select')
    setStatusMsg(fallbackMsg)
    return false
  }, [engineOptions, markDeadEnd])

  const loadPuzzle = useCallback((puzzle, savedSteps = null) => {
    clearTimeout(preLawTimerRef.current)
    preLawTimerRef.current = null
    interactionLockedRef.current = false
    setIsPreLawHighlight(false)
    puzzleRef.current = puzzle
    guidanceCacheRef.current = null
    hintLevelRef.current = { key: '', level: 0 }
    setChoiceAttempts([])
    setSelectedLaw(null)
    if (animationTimerRef.current) {
      clearTimeout(animationTimerRef.current)
      animationTimerRef.current = null
    }

    const parsedExpr = parseExpr(puzzle.expr)
    const gCanon = canonText(parseExpr(puzzle.goal))
    goalCanonRef.current = gCanon

    // Compute the optimal derivation by BFS.
    //
    // Graded puzzles are scored against the shortest route that APPLIES EVERY
    // LAW IN `targetLaws`, not the shortest route to the goal. Those differ
    // whenever a shortcut skips a law the puzzle exists to teach, and scoring
    // against the shortcut both punished learners for following the taught
    // route and made a perfect total unreachable on 25 of the 40 puzzles.
    // Puzzles without target laws keep the plain shortest path.
    try {
      const requiredLaws = puzzle.targetLaws || []
      let solverRes = requiredLaws.length
        ? findOptimalPathWithLaws(parsedExpr, gCanon, requiredLaws, engineOptions)
        : findOptimalPath(parsedExpr, gCanon, engineOptions)

      // No route satisfies the objective (or the budget ran out): fall back to
      // the plain optimum rather than refusing to score the puzzle.
      if (!solverRes.found && requiredLaws.length) {
        solverRes = findOptimalPath(parsedExpr, gCanon, engineOptions)
      }

      if (solverRes.found && solverRes.optimalSteps > 0) {
        setOptimalSteps(solverRes.optimalSteps)
        setOptimalPath(solverRes.path)
      } else {
        setOptimalSteps(puzzle.optimalSteps || 0)
        setOptimalPath([])
      }
    } catch {
      setOptimalSteps(puzzle.optimalSteps || 0)
      setOptimalPath([])
    }

    if (savedSteps && Array.isArray(savedSteps) && savedSteps.length > 0) {
      try {
        const hist = [{ expr: parsedExpr, step: null }]
        for (const s of savedSteps) {
          hist.push({ expr: parseExpr(s.to), step: s })
        }
        setHistory(hist)
        setIsComplete(true)
        setStatus('success')
        setStatusMsg('Stage completed! Click steps to review derivation')
      } catch (err) {
        console.warn('Failed to parse saved derivation, resetting to initial expr:', err)
        setHistory([{ expr: parsedExpr, step: null }])
        setIsComplete(false)
        setStatus('select')
        setStatusMsg('Choose a law from the palette to begin')
        syncDeadEndStatus(parsedExpr, undefined, { silent: true })
      }
    } else {
      setHistory([{ expr: parsedExpr, step: null }])
      setIsComplete(false)
      setStatus('select')
      setStatusMsg('Choose a law from the palette to begin')
      // Loading a puzzle never buzzes: a puzzle that starts at a dead end is a
      // property of the problem, not a mistake the learner just made.
      syncDeadEndStatus(parsedExpr, undefined, { silent: true })
    }

    setGoalText(puzzle.goal)
    setGoalCanon(gCanon)
    setSel([])
    const isNewPuzzle = currentPuzzleExprRef.current !== puzzle.expr
    if (isNewPuzzle) {
      assistanceRef.current = false
      currentPuzzleExprRef.current = puzzle.expr
      setHintIdx(0)
      setHintsUsed(0)
      setGuidesUsed(0)
    }
    setApplicableLaws([])
    setActiveGuidePaths([])
    markDeadEnd(false)
    setIsAnimating(false)
    setAnimationData(null)
    setEarnedXp(0)
  }, [syncDeadEndStatus, engineOptions, markDeadEnd])

  const updateLaws = useCallback((nextSel, exprSnapshot) => {
    if (isDeadEnd) {
      setApplicableLaws([])
      setStatus('error')
      setStatusMsg(DEAD_END_MSG)
      return
    }

    if (independent) {
      setApplicableLaws([])
      setStatus(nextSel.length ? 'laws' : 'select')
      setStatusMsg(nextSel.length ? 'Select the target term(s), then press Apply. You can change your selection before applying.' : 'Select the term(s) to transform with your chosen law.')
      return
    }

    if (nextSel.length === 2) {
      const laws = analyzeSelection(exprSnapshot, nextSel, engineOptions)
      setApplicableLaws(laws)
      setStatus(laws.length ? 'laws' : 'error')
      if (laws.length) {
        setStatusMsg(`Applicable: Choose a law below (${laws.map(l => l.name).join(', ')})`)
      } else {
        playSound('wrong')
        setStatusMsg('No simplification for these selected items. Try different terms or variables.')
      }
    } else if (nextSel.length === 1) {
      const item = nextSel[0]
      const node = getNode(exprSnapshot, item.path)

      // If the selected item is a NOT node (either by clicking the NOT capsule or the term handle),
      // check if unary laws (De Morgan / Double Negation) apply immediately!
      if (node?.type === 'not') {
        const laws = analyzeNot(exprSnapshot, item.path)
        if (laws.length > 0) {
          setApplicableLaws(laws)
          setStatus('laws')
          setStatusMsg(`Applicable: Choose a law below (${laws.map(l => l.name).join(', ')}) or select another term`)
          return
        }
      }

      setApplicableLaws([])
      setStatus('select')
      if (item.isTermSel) {
        setStatusMsg(`Selected entire term [${nodeText(node)}]. Now select a second term to combine.`)
      } else if (node?.type === 'lit') {
        const vLabel = node.n ? node.v + "'" : node.v
        setStatusMsg(`Selected variable "${vLabel}". Select another variable to factor or pair.`)
      } else {
        setStatusMsg('Now select a second item to apply a law')
      }
    } else {
      setApplicableLaws([])
      setStatus('select')
      setStatusMsg('Choose a law from the palette to begin')
    }
  }, [isDeadEnd, engineOptions, independent])

  /* ---- selection handlers ---- */

  /**
   * Exactly ONE cue per selection click: a short tick when the clicked item
   * joins the selection, its lower mirror when that same click takes it back
   * out. Because the cue is chosen from the clicked path — not from the shape
   * of the whole new selection — swapping one item for another (a second
   * literal replacing the term it belonged to, or a third selection evicting
   * the oldest) still fires only that one tick and cannot double up.
   *
   * Fired from the click handler, i.e. the gesture itself, so it lands at
   * gesture time and never from a render. Programmatic selection changes
   * (apply, undo, reset, guide pre-selection, reorder) stay silent: they
   * already have their own cue, and stacking a deselect tick on top of them
   * would be noise.
   */
  const cueSelectionClick = useCallback((path) => {
    if (sel.some(s => s.path === path)) {
      playSound('deselect')
    } else {
      playSound('select')
    }
  }, [sel])

  const handleClickLit = useCallback((path, exprSnapshot) => {
    if (interactionLockedRef.current || isComplete) return
    if (independent && !selectedLaw) {
      setStatusMsg('Choose a law from the palette before selecting terms.')
      return
    }
    // Selection clicks are the app's first user gesture on most sessions: unlock
    // audio here so the cue fired by the verdict is actually audible.
    primeAudio()
    cueSelectionClick(path)
    if (isDeadEnd) {
      setSel(prev => {
        const existing = prev.findIndex(s => s.path === path)
        return existing >= 0
          ? prev.filter((_, i) => i !== existing)
          : prev.length >= 2
            ? [prev[1], { path, isTermSel: false }]
            : [...prev, { path, isTermSel: false }]
      })
      setApplicableLaws([])
      return
    }

    const node = getNode(exprSnapshot, path)
    /** Shared verdict for the const-in-product/sum shortcut: a dead selection buzzes. */
    const applyConstLaws = (laws) => {
      setSel([{ path, isTermSel: false }])
      if (independent) {
        updateLaws([{ path, isTermSel: false }], exprSnapshot)
        return
      }
      setApplicableLaws(laws)
      setStatus(laws.length ? 'laws' : 'error')
      if (!laws.length) playSound('wrong')
      setStatusMsg(
        laws.length
          ? `Applicable: Choose a law below (${laws.map(l => l.name).join(', ')})`
          : 'No law applies here. Try different terms.'
      )
    }

    // Special case: const (0 or 1) directly inside a product or sum
    if (!independent && node && node.type === 'const') {
      const parts = path.split('.')
      if (parts.length > 1) {
        const parentPath = parts.slice(0, -1).join('.')
        const parent = getNode(exprSnapshot, parentPath)
        if (parent && parent.type === 'prod') {
          applyConstLaws(analyzeProductConst(exprSnapshot, path, node.val, parentPath))
          return
        }
        if (parent && parent.type === 'sum') {
          applyConstLaws(analyzeSumConst(exprSnapshot, path, node.val, parentPath))
          return
        }
      }
    }

    setSel(prev => {
      const existing = prev.findIndex(s => s.path === path)
      let next
      if (existing >= 0) {
        next = prev.filter((_, i) => i !== existing)
      } else {
        const parts = path.split('.')
        const parentTermPath = parts.length > 1 ? parts.slice(0, -1).join('.') : null
        // If parent term is selected (e.g. 'R.1'), replace it with this specific literal ('R.1.0')
        const cleaned = parentTermPath ? prev.filter(s => s.path !== parentTermPath) : prev
        const hasNotNode = cleaned.some(s => getNode(exprSnapshot, s.path)?.type === 'not')
        if (hasNotNode) {
          next = [{ path, isTermSel: false }]
        } else {
          next = cleaned.length >= 2
            ? [cleaned[1], { path, isTermSel: false }]
            : [...cleaned, { path, isTermSel: false }]
        }
      }
      updateLaws(next, exprSnapshot)
      return next
    })
  }, [isComplete, independent, isDeadEnd, updateLaws, cueSelectionClick, selectedLaw])

  const handleClickNot = useCallback((path, exprSnapshot) => {
    if (interactionLockedRef.current || isComplete) return
    if (independent && !selectedLaw) {
      setStatusMsg('Choose a law from the palette before selecting terms.')
      return
    }
    primeAudio()
    cueSelectionClick(path)
    if (isDeadEnd) {
      setSel(prev => {
        const existing = prev.findIndex(s => s.path === path)
        return existing >= 0 ? [] : [{ path, isTermSel: false }]
      })
      setApplicableLaws([])
      return
    }

    setSel(prev => {
      const existing = prev.findIndex(s => s.path === path)
      if (existing >= 0) {
        updateLaws([], exprSnapshot)
        return []
      }

      // Clicking a NOT container focuses solely on this NOT node for De Morgan / Double Negation
      const next = [{ path, isTermSel: false }]
      if (independent) {
        updateLaws(next, exprSnapshot)
        return next
      }
      const laws = analyzeNot(exprSnapshot, path)
      setApplicableLaws(laws)
      setStatus(laws.length ? 'laws' : 'error')
      if (!laws.length) playSound('wrong')
      setStatusMsg(
        laws.length
          ? `Applicable: Choose a law below (${laws.map(l => l.name).join(', ')})`
          : 'No law applies. Try a different element.'
      )
      return next
    })
  }, [isComplete, independent, updateLaws, isDeadEnd, cueSelectionClick, selectedLaw])

  const handleClickTerm = useCallback((path, exprSnapshot) => {
    if (interactionLockedRef.current || isComplete) return
    if (independent && !selectedLaw) {
      setStatusMsg('Choose a law from the palette before selecting terms.')
      return
    }
    primeAudio()
    cueSelectionClick(path)
    if (isDeadEnd) {
      setSel(prev => {
        const existing = prev.findIndex(s => s.path === path)
        if (existing >= 0) return prev.filter((_, i) => i !== existing)
        const cleaned = prev.filter(s => !s.path.startsWith(path + '.'))
        return cleaned.length >= 2
          ? [cleaned[1], { path, isTermSel: true }]
          : [...cleaned, { path, isTermSel: true }]
      })
      setApplicableLaws([])
      return
    }

    setSel(prev => {
      const existing = prev.findIndex(s => s.path === path)
      let next
      if (existing >= 0) {
        next = prev.filter((_, i) => i !== existing)
        setApplicableLaws([])
        setStatus('select')
        updateLaws(next, exprSnapshot)
        return next
      }
      // If prev contains sub-literals of this term (e.g. 'R.1.0' or 'R.1.1'), replace them with the whole term
      const cleaned = prev.filter(s => !s.path.startsWith(path + '.'))
      const hasNotNode = cleaned.some(s => getNode(exprSnapshot, s.path)?.type === 'not')
      if (hasNotNode) {
        next = [{ path, isTermSel: true }]
      } else {
        next = cleaned.length >= 2
          ? [cleaned[1], { path, isTermSel: true }]
          : [...cleaned, { path, isTermSel: true }]
      }

      updateLaws(next, exprSnapshot)
      return next
    })
  }, [isComplete, isDeadEnd, updateLaws, cueSelectionClick, selectedLaw, independent])

  // currentSteps / hintsCount are part of the positional call signature
  // (ProblemPage calls applyLaw(law, expr, steps, hintsUsed, enableTutorialPause)),
  // so they must stay in place even though this body no longer reads them.
  // eslint-disable-next-line no-unused-vars
  const applyLaw = useCallback((law, currentExpr = expr, currentSteps = steps, hintsCount = 0, isTutorial = false) => {
    if (interactionLockedRef.current || isComplete) return
    // The law click is a gesture: prime now, because the step cue fires after
    // the law animation, when no gesture of its own exists.
    primeAudio()
    if (independent && (!selectedLaw || law?.id !== selectedLaw.id)) return
    const activeExpr = currentExpr || expr
    if (!activeExpr) return

    if (independent) {
      const verdict = evaluateLawChoice(activeExpr, sel, law.id, engineOptions)
      const attempt = {
        lawId: law.id, outcome: verdict.code, assisted: assistanceRef.current,
        expression: nodeText(activeExpr), selection: sel.map(s => ({ ...s })),
      }
      setChoiceAttempts(previous => [...previous, attempt])
      if (!verdict.ok) {
        setStatus('error')
        setStatusMsg(verdict.message)
        playSound('wrong')
        return
      }
      law = verdict.law
    }

    const before = nodeText(activeExpr)
    const newExpr = law.apply()
    const after = nodeText(newExpr)

    // Check if the law actually changed anything
    if (before === after) {
      setSel([])
      setApplicableLaws([])
      setStatus('select')
      setStatusMsg('That law didn\'t change the expression. Try a different one.')
      return
    }

    // Synchronous lock also covers rapid clicks before React re-renders and
    // the tutorial's pre-animation delay.
    interactionLockedRef.current = true

    if (preLawTimerRef.current) {
      clearTimeout(preLawTimerRef.current)
      preLawTimerRef.current = null
    }
    if (animationTimerRef.current) {
      clearTimeout(animationTimerRef.current)
      animationTimerRef.current = null
    }

    // The commit body, shared by the animated path (fired by a timer) and the
    // instant path used for laws that have no animation module.
    const commitStep = () => {
      animationTimerRef.current = null
      interactionLockedRef.current = false
      guidanceCacheRef.current = null
      setHistory(h => [...h, { expr: newExpr, step: {
        law: law.name, lawId: law.id, from: before, to: after,
        selection: sel.map(s => ({ ...s })), explanation: law.desc,
      } }])
      setSel([])
      setSelectedLaw(null)
      setApplicableLaws([])
      setActiveGuidePaths([])
      setIsAnimating(false)
      setAnimationData(null)

      // The step landed: one short click, then either the solve fanfare or the
      // dead-end check for the expression the law produced.
      playSound('step')

      // Check completion
      if (canonText(newExpr) === goalCanonRef.current) {
        interactionLockedRef.current = true
        markDeadEnd(false)
        setEarnedXp(STAGE_COMPLETION_XP)
        setIsComplete(true)
        setStatus('success')
        setStatusMsg('Expression simplified!')
        playSound('correct')
      } else {
        syncDeadEndStatus(newExpr, 'Step applied. Choose a law for your next move.')
      }
    }

    const startAnimation = () => {
      setIsPreLawHighlight(false)

      // Some laws animate nothing: Distributive (Expand) is sandbox-only and the
      // AnimationOverlay registry deliberately has no module for it (its
      // animPaths are empty). Holding the canvas in 'applying' for the whole
      // animation window with no motion on screen reads as a stuck loading
      // state, which is exactly the reported "animation is gone, it just
      // loads" symptom. Commit those laws at once instead.
      if (!hasLawAnimation(law.id)) {
        commitStep()
        return
      }

      setIsAnimating(true)
      setAnimationData({
        lawId: law.id,
        lawName: law.name,
        paths: law.animPaths || sel.map(s => s.path),
        measurePaths: law.measurePaths,
        factoredVar: law.factoredVar,
        rem1: law.rem1,
        rem2: law.rem2,
        outerPrefix: law.outerPrefix,
        outerSuffix: law.outerSuffix,
        survivorPath: law.survivorPath,
        absorbedPath: law.absorbedPath,
        survivorText: law.survivorText,
        absorbedText: law.absorbedText,
        extraText: law.extraText,
        dominantConst: law.dominantConst,
        constPath: law.constPath,
        varPath: law.varPath,
        varText: law.varText,
        lit1Text: law.lit1Text,
        lit2Text: law.lit2Text,
        resultConst: law.resultConst,
        duplicatePath: law.duplicatePath,
        termText: law.termText,
        activeText: law.activeText,
        constText: law.constText,
        coreText: law.coreText,
        rawChildText: law.rawChildText,
        deMorganTerms: law.deMorganTerms,
        isAndToOr: law.isAndToOr,
        exprBefore: activeExpr,
        exprAfter: newExpr
      })
      setStatus('applying')
      setStatusMsg(`Applying ${law.name}...`)

      animationTimerRef.current = setTimeout(commitStep, TIMING.lawAnimationMs)
    }

    if (isTutorial) {
      // The pause that explains the next step has no gesture of its own, so it
      // gets a soft two-note guide tick; the step cue follows after the law
      // animation, keeping the two apart.
      playSound('tutorialStep')
      setIsPreLawHighlight(true)
      preLawTimerRef.current = setTimeout(() => {
        preLawTimerRef.current = null
        startAnimation()
      }, TIMING.preLawHighlightMs)
    } else {
      startAnimation()
    }
  }, [expr, steps, isComplete, independent, engineOptions, sel, selectedLaw, syncDeadEndStatus, markDeadEnd])

  const undoAction = useCallback(() => {
    setSelectedLaw(null)
    interactionLockedRef.current = false
    guidanceCacheRef.current = null
    if (preLawTimerRef.current) {
      clearTimeout(preLawTimerRef.current)
      preLawTimerRef.current = null
    }
    if (animationTimerRef.current) {
      clearTimeout(animationTimerRef.current)
      animationTimerRef.current = null
    }
    setIsPreLawHighlight(false)
    setIsAnimating(false)
    setAnimationData(null)
    setSel([])
    setApplicableLaws([])
    setActiveGuidePaths([])
    setIsComplete(false)

    setHistory(h => {
      if (h.length <= 1) {
        setStatus('select')
        setStatusMsg('Choose a law from the palette to begin')
        return h
      }
      const nextH = h.slice(0, -1)
      const prevEntry = nextH[nextH.length - 1]
      syncDeadEndStatus(prevEntry.expr, 'Undone. Choose a law to continue.')
      return nextH
    })
  }, [syncDeadEndStatus])

  const resetPuzzle = useCallback((puzzle) => {
    if (animationTimerRef.current) {
      clearTimeout(animationTimerRef.current)
      animationTimerRef.current = null
    }
    setIsAnimating(false)
    setAnimationData(null)
    if (puzzle) {
      // Only an actual reset (with a problem to go back to) gets the sweep.
      playSound('reset')
      loadPuzzle(puzzle)
    }
  }, [loadPuzzle])

  const getGuidance = useCallback(() => {
    if (!expr || interactionLockedRef.current || isComplete) return { status: 'busy' }
    const used = lawsUsedFromSteps(steps)
    const key = nodeText(expr) + '|' + used.join(',') + '|' + (allowedLawIds?.join(',') ?? '*') + '|' + allowExpand
    if (guidanceCacheRef.current?.key === key) return guidanceCacheRef.current.result
    const puzzle = puzzleRef.current
    const budget = puzzle?.solutionPath ? SANDBOX.budget.optimalPath : {}
    const result = planGuidance(expr, goalCanonRef.current, puzzle?.targetLaws || [], used, { ...budget, ...engineOptions })
    guidanceCacheRef.current = { key, result }
    return result
  }, [expr, steps, isComplete, engineOptions, allowedLawIds, allowExpand])

  const requestHint = useCallback(() => {
    const result = getGuidance()
    if (result.status === 'busy' || result.status === 'complete') return null
    if (result.status !== 'verified') return 'A route to the target could not be verified within the search limit. Undo to explore another route; no assistance penalty was added.'
    const { transition } = result
    const paths = transition.selection.map(s => s.path)
    const key = nodeText(expr)
    const level = hintLevelRef.current.key === key ? hintLevelRef.current.level + 1 : 0
    hintLevelRef.current = { key, level }
    const location = paths.map(p => nodeText(getNode(expr, p))).join(' and ')
    const hint = level === 0 ? buildHintText(transition.lawId, paths, expr)
      : level === 1 ? `Consider ${transition.law} for ${location}.`
        : `Choose ${transition.law}, select ${location}, then press Apply. Next expression: ${transition.to}.`
    assistanceRef.current = true
    playSound('hint')
    setHintIdx(i => i + 1)
    setHintsUsed(h => h + 1)
    return result.objective ? hint : `${hint} This route reaches the target, but does not demonstrate every remaining target law.`
  }, [getGuidance, expr])

  /** Drag-and-drop term or factor reorder - no law applied, no step recorded */
  const swapTerms = useCallback((parentPath, fromIdx, toIdx) => {
    if (interactionLockedRef.current || isComplete) return
    if (fromIdx === toIdx) return
    let nextExpr = null

    setHistory(prev => {
      if (!prev || prev.length === 0) return prev
      const currentEntry = prev[prev.length - 1]
      const tree = cloneN(currentEntry.expr)
      const node = getNode(tree, parentPath)
      if (!node) return prev

      if (node.type === 'sum') {
        const tmp = node.terms[fromIdx]
        node.terms[fromIdx] = node.terms[toIdx]
        node.terms[toIdx] = tmp
      } else if (node.type === 'prod') {
        const tmp = node.factors[fromIdx]
        node.factors[fromIdx] = node.factors[toIdx]
        node.factors[toIdx] = tmp
      } else {
        return prev
      }

      nextExpr = tree
      const nextH = [...prev]
      nextH[nextH.length - 1] = { ...currentEntry, expr: tree }
      return nextH
    })

    setSel([])
    setApplicableLaws([])
    setActiveGuidePaths([])
    if (nextExpr) {
      syncDeadEndStatus(nextExpr, 'Elements reordered. Choose a law, then select its target terms.')
    }
  }, [syncDeadEndStatus, isComplete])

  const activateGuide = useCallback(() => {
    const result = getGuidance()
    if (result.status === 'busy' || result.status === 'complete') return false
    if (result.status !== 'verified') {
      setStatus('error')
      setStatusMsg('A route to the target could not be verified within the search limit. No guide points were spent. Try Undo to explore another route.')
      return false
    }

    markDeadEnd(false)
    playSound('guide')
    setGuidesUsed(g => g + 1)
    assistanceRef.current = true
    const nextSel = result.transition.selection
    const paths = nextSel.map(s => s.path)

    setActiveGuidePaths(paths)
    setSel(nextSel)
    // One analysis feeds both the guided law and the palette. This ran
    // selectionLaws() twice with identical arguments on every guide activation.
    const laws = selectionLaws(expr, nextSel, engineOptions)
    const guidedLaw = laws.find(l => l.id === result.transition.lawId)
    setSelectedLaw(guidedLaw)

    // Guide supplies both the law and targets; applying remains an explicit action.
    setApplicableLaws(independent ? [] : laws)
    setStatus(laws.length ? 'laws' : 'select')
    setStatusMsg(`Guide: press Apply to use ${result.transition.law} on the highlighted selection. ${independent ? 'This decision is assisted. ' : ''}${result.objective ? '' : 'This route reaches the target but skips a remaining target law.'}`)
    return true
  }, [expr, engineOptions, independent, getGuidance, markDeadEnd])

  const chooseLaw = useCallback((law) => {
    if (interactionLockedRef.current || isComplete) return
    if (allowedLawIds && !allowedLawIds.includes(law.id)) {
      setStatus('error')
      setStatusMsg("Choose a law available in this stage's palette.")
      return
    }
    primeAudio()
    setSelectedLaw(law)
    setSel([])
    setApplicableLaws([])
    setActiveGuidePaths([])
    setStatus('select')
    setStatusMsg(`${law.name} selected. Select the target term(s), then press Apply.`)
  }, [isComplete, allowedLawIds])

  return {
    expr, sel, steps, exprHistory,
    selectedLaw, chooseLaw,
    goalText, goalCanon,
    hintIdx, hintsUsed, guidesUsed,
    optimalSteps, optimalPath,
    applicableLaws,
    choiceAttempts,
    isComplete, earnedXp,
    status, statusMsg,
    activeGuidePaths,
    isPreLawHighlight,
    isAnimating, animationData,
    loadPuzzle,
    handleClickLit, handleClickNot, handleClickTerm,
    applyLaw, undoAction, resetPuzzle, requestHint, swapTerms, activateGuide,
  }
}
