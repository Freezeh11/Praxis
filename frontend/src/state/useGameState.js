import { useState, useCallback, useRef } from 'react'
import {
  parseExpr, cloneN, canonText, nodeText, getNode,
  analyzeSelection, analyzeNot, analyzeProductConst, analyzeSumConst, scanHints,
  findOptimalPath,
} from '../engine/index.js'
import { STAGE_COMPLETION_XP, TIMING } from '../config/gameRules.js'
import { playSound, primeAudio } from '../services/soundEffects.js'
import { DEAD_END_MSG, buildHintText } from './hintText.js'

export function useGameState(options = {}) {
  // Sandbox-only engine opt-in: enables the gated Distributive-Expand law.
  // Graded levels call useGameState() with no options, so nothing changes there.
  const { allowExpand = false } = options || {}
  const [history, setHistory] = useState([]) // Array of { expr, step }
  const expr = history.length > 0 ? history[history.length - 1].expr : null
  const steps = history.length > 1 ? history.slice(1).map(h => h.step) : []
  const exprHistory = history.length > 1 ? history.slice(0, -1).map(h => h.expr) : []

  const [sel, setSel] = useState([])
  const [goalText, setGoalText] = useState('')
  const [goalCanon, setGoalCanon] = useState('')
  const [hintIdx, setHintIdx] = useState(0)
  const [hintsUsed, setHintsUsed] = useState(0)
  const [guidesUsed, setGuidesUsed] = useState(0)
  const [optimalSteps, setOptimalSteps] = useState(0)
  const [optimalPath, setOptimalPath] = useState([])
  const [applicableLaws, setApplicableLaws] = useState([])
  const [status, setStatus] = useState('select') // 'select' | 'laws' | 'success' | 'error'
  const [statusMsg, setStatusMsg] = useState('Select a term or variable to begin')
  const [isComplete, setIsComplete] = useState(false)
  const [isDeadEnd, setIsDeadEnd] = useState(false)
  const [earnedXp, setEarnedXp] = useState(0)
  const [activeGuidePaths, setActiveGuidePaths] = useState([])
  const [isPreLawHighlight, setIsPreLawHighlight] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [animationData, setAnimationData] = useState(null)

  const preLawTimerRef = useRef(null)
  const animationTimerRef = useRef(null)
  const goalCanonRef = useRef('')
  const currentPuzzleExprRef = useRef('')
  /** Tracks the dead-end transition so its cue fires once, not on every resync. */
  const isDeadEndRef = useRef(false)

  /** Cues follow the dead-end TRANSITION, so a re-derived status stays silent. */
  const markDeadEnd = useCallback((next, { silent = false } = {}) => {
    if (next && !isDeadEndRef.current && !silent) playSound('wrong')
    isDeadEndRef.current = next
    setIsDeadEnd(next)
  }, [])

  const syncDeadEndStatus = useCallback((exprSnapshot, fallbackMsg = 'Select a term or variable to begin', { silent = false } = {}) => {
    if (!exprSnapshot) return false

    if (canonText(exprSnapshot) === goalCanonRef.current) {
      markDeadEnd(false, { silent })
      return false
    }

    const hints = scanHints(exprSnapshot, 'R', { allowExpand })
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
  }, [allowExpand, markDeadEnd])

  const loadPuzzle = useCallback((puzzle, savedSteps = null) => {
    if (animationTimerRef.current) {
      clearTimeout(animationTimerRef.current)
      animationTimerRef.current = null
    }

    const parsedExpr = parseExpr(puzzle.expr)
    const gCanon = canonText(parseExpr(puzzle.goal))
    goalCanonRef.current = gCanon

    // Compute dynamic optimal path via BFS
    try {
      const solverRes = findOptimalPath(parsedExpr, gCanon, { allowExpand })
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
        setStatusMsg('Select a term or variable to begin')
        syncDeadEndStatus(parsedExpr, undefined, { silent: true })
      }
    } else {
      setHistory([{ expr: parsedExpr, step: null }])
      setIsComplete(false)
      setStatus('select')
      setStatusMsg('Select a term or variable to begin')
      // Loading a puzzle never buzzes: a puzzle that starts at a dead end is a
      // property of the problem, not a mistake the learner just made.
      syncDeadEndStatus(parsedExpr, undefined, { silent: true })
    }

    setGoalText(puzzle.goal)
    setGoalCanon(gCanon)
    setSel([])
    const isNewPuzzle = currentPuzzleExprRef.current !== puzzle.expr
    if (isNewPuzzle) {
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
  }, [syncDeadEndStatus, allowExpand, markDeadEnd])

  const updateLaws = useCallback((nextSel, exprSnapshot) => {
    if (isDeadEnd) {
      setApplicableLaws([])
      setStatus('error')
      setStatusMsg(DEAD_END_MSG)
      return
    }

    if (nextSel.length === 2) {
      const laws = analyzeSelection(exprSnapshot, nextSel, { allowExpand })
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
      setStatusMsg('Select a term or variable to begin')
    }
  }, [isDeadEnd, allowExpand])

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
    if (isAnimating) return
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
    if (node && node.type === 'const') {
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
  }, [isAnimating, isDeadEnd, updateLaws, cueSelectionClick])

  const handleClickNot = useCallback((path, exprSnapshot) => {
    if (isAnimating) return
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
        setApplicableLaws([])
        setStatus('select')
        setStatusMsg('Select a term or variable to begin')
        return []
      }

      // Clicking a NOT container focuses solely on this NOT node for De Morgan / Double Negation
      const next = [{ path, isTermSel: false }]
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
  }, [isAnimating, isDeadEnd, cueSelectionClick])

  const handleClickTerm = useCallback((path, exprSnapshot) => {
    if (isAnimating) return
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
        setStatusMsg('Select a term or variable to begin')
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
  }, [isAnimating, isDeadEnd, updateLaws, cueSelectionClick])

  // currentSteps / hintsCount are part of the positional call signature
  // (ProblemPage calls applyLaw(law, expr, steps, hintsUsed, enableTutorialPause)),
  // so they must stay in place even though this body no longer reads them.
  // eslint-disable-next-line no-unused-vars
  const applyLaw = useCallback((law, currentExpr = expr, currentSteps = steps, hintsCount = 0, isTutorial = false) => {
    if (isAnimating) return
    // The law click is a gesture: prime now, because the step cue fires after
    // the law animation, when no gesture of its own exists.
    primeAudio()
    const activeExpr = currentExpr || expr
    if (!activeExpr) return

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

    if (preLawTimerRef.current) {
      clearTimeout(preLawTimerRef.current)
      preLawTimerRef.current = null
    }
    if (animationTimerRef.current) {
      clearTimeout(animationTimerRef.current)
      animationTimerRef.current = null
    }

    const startAnimation = () => {
      setIsPreLawHighlight(false)
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
      setStatus('select')
      setStatusMsg(`Applying ${law.name}...`)

      animationTimerRef.current = setTimeout(() => {
        animationTimerRef.current = null
        setHistory(h => [...h, { expr: newExpr, step: { law: law.name, from: before, to: after } }])
        setSel([])
        setApplicableLaws([])
        setActiveGuidePaths([])
        setIsAnimating(false)
        setAnimationData(null)

        // The step landed: one short click, then either the solve fanfare or the
        // dead-end check for the expression the law produced.
        playSound('step')

        // Check completion
        if (canonText(newExpr) === goalCanonRef.current) {
          markDeadEnd(false)
          setEarnedXp(STAGE_COMPLETION_XP)
          setIsComplete(true)
          setStatus('success')
          setStatusMsg('Expression simplified! 🎉')
          playSound('correct')
        } else {
          syncDeadEndStatus(newExpr, 'Step applied. Select next terms to continue.')
        }
      }, TIMING.lawAnimationMs)
    }

    if (isTutorial) {
      setIsPreLawHighlight(true)
      preLawTimerRef.current = setTimeout(() => {
        preLawTimerRef.current = null
        startAnimation()
      }, TIMING.preLawHighlightMs)
    } else {
      startAnimation()
    }
  }, [expr, steps, isAnimating, sel, syncDeadEndStatus, markDeadEnd])

  const undoAction = useCallback(() => {
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
      if (h.length <= 1) return h
      const nextH = h.slice(0, -1)
      const prevEntry = nextH[nextH.length - 1]
      syncDeadEndStatus(prevEntry.expr, 'Undone. Select terms to continue.')
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

  const requestHint = useCallback((puzzle) => {
    // Always try to generate a contextual hint from the current expression first
    if (expr) {
      const scanResults = scanHints(expr, 'R', { allowExpand })
      if (scanResults.length > 0) {
        const { law, paths } = scanResults[0]
        const contextMsg = buildHintText(law, paths, expr)
        playSound('hint')
        setHintsUsed(h => h + 1)
        return contextMsg
      }
    }
    // Fallback: static puzzle hints (e.g. expression is already at goal)
    if (!puzzle?.hints?.length) return null
    const hint = puzzle.hints[Math.min(hintIdx, puzzle.hints.length - 1)]
    playSound('hint')
    setHintIdx(i => i + 1)
    setHintsUsed(h => h + 1)
    return hint
  }, [expr, hintIdx, allowExpand])

  /** Drag-and-drop term or factor reorder - no law applied, no step recorded */
  const swapTerms = useCallback((parentPath, fromIdx, toIdx) => {
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
      syncDeadEndStatus(nextExpr, 'Elements reordered. Select terms to continue.')
    }
  }, [syncDeadEndStatus])

  const activateGuide = useCallback(() => {
    if (!expr) return false
    const hints = scanHints(expr, 'R', { allowExpand })
    if (hints.length === 0) {
      markDeadEnd(true)
      setStatus('error')
      setStatusMsg(DEAD_END_MSG)
      return false
    }

    markDeadEnd(false)
    playSound('guide')
    setGuidesUsed(g => g + 1)
    const hint = hints[0]
    const paths = hint.paths

    // For single-path hints (not nodes: double-neg, demorgan)
    // highlight it and let user click it (analyzeNot handles single clicks)
    if (paths.length === 1) {
      setActiveGuidePaths(paths)
      setSel([])
      setApplicableLaws([])
      setStatus('select')
      setStatusMsg('Guide: click the highlighted element to see applicable laws.')
      return true
    }

    // For two-path hints: pre-select both items and compute laws immediately
    // Determine if these are term-level selections (whole terms) or literal-level
    const isTermSel = ['idempotent', 'absorption', 'complement', 'annulment', 'identity'].includes(hint.law)
    const nextSel = paths.map(p => ({ path: p, isTermSel }))

    setActiveGuidePaths(paths)
    setSel(nextSel)

    // Compute applicable laws right away so user just has to pick one
    const laws = analyzeSelection(expr, nextSel, { allowExpand })
    setApplicableLaws(laws)
    setStatus(laws.length ? 'laws' : 'select')
    setStatusMsg(laws.length
      ? 'Guide: the terms are pre-selected - pick a law to apply!'
      : 'Guide: click the highlighted terms, then choose a law.')
    return true
  }, [expr, allowExpand, markDeadEnd])

  return {
    expr, sel, steps, exprHistory,
    goalText, goalCanon,
    hintIdx, hintsUsed, guidesUsed,
    optimalSteps, optimalPath,
    applicableLaws,
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
