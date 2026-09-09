import { useState, useCallback, useRef } from 'react'
import { parseExpr, cloneN, canonText, nodeText, getNode, findCommonProd } from '../lib/expr.js'
import { analyzeSelection, analyzeNot, analyzeProductConst, analyzeSumConst, scanHints } from '../lib/laws.js'
import { findOptimalPath } from '../lib/solver.js'

const DEAD_END_MSG = 'This expression is simplified, but it is not the final target. A different law path can still reach the required answer.'

/**
 * Converts a scanHints result into a human-readable hint string.
 * @param {string} law - law id from scanHints
 * @param {string[]} paths - node paths from scanHints
 * @param {object} expr - current expression tree
 */
function buildHintText(law, paths, expr) {
  try {
    const n1 = paths[0] ? getNode(expr, paths[0]) : null
    const n2 = paths[1] ? getNode(expr, paths[1]) : null

    let isProdContext = false
    if (paths.length >= 2) {
      const cp = findCommonProd(expr, paths[0], paths[1])
      if (cp) isProdContext = true
    } else if (paths.length === 1) {
      const parts = paths[0].split('.')
      if (parts.length > 1) {
        const parentPath = parts.slice(0, -1).join('.')
        const parent = getNode(expr, parentPath)
        if (parent?.type === 'prod') isProdContext = true
      }
    }

    switch (law) {
      case 'double-neg':
        return `There's a term with two negations stacked on top of each other. Double Negation can clean that up: (A')' = A.`
      case 'demorgan':
      case 'demorgan-and':
      case 'demorgan-or':
        return `There's a negated group in the expression. Try applying De Morgan's Law to expand it.`
      case 'absorption':
        return isProdContext
          ? `One clause absorbs another: A(A + B) = A. Absorption Law eliminates the longer clause.`
          : `One term absorbs another: A + AB = A. Absorption Law eliminates the longer term.`
      case 'idempotent':
        return isProdContext
          ? `Duplicate clauses appear in a product: (A)(A) = A. Idempotent Law removes the duplicate.`
          : `Duplicate terms appear in a sum: A + A = A. Idempotent Law removes the duplicate.`
      case 'complement':
        return isProdContext
          ? `A variable meets its complement in a product: A · A' = 0.`
          : `A variable meets its complement in a sum: A + A' = 1.`
      case 'annulment': {
        const hasOne = (n1?.type === 'const' && n1.val === 1) || (n2?.type === 'const' && n2.val === 1)
        return hasOne
          ? `There's a 1 in a sum. Annulment Law says A + 1 = 1 — the whole sum collapses to 1.`
          : `There's a 0 in a product. Annulment Law says A · 0 = 0 — the product collapses to 0.`
      }
      case 'identity': {
        const hasZero = (n1?.type === 'const' && n1.val === 0) || (n2?.type === 'const' && n2.val === 0)
        return hasZero
          ? `There's a 0 in a sum that has no effect. Identity Law says A + 0 = A.`
          : `There's a 1 in a product that has no effect. Identity Law says A · 1 = A.`
      }
      case 'distributive':
        return isProdContext
          ? `Two clauses share a common variable. Try POS Distributive Law: (A+B)(A+C) = A + BC.`
          : `Two terms share a common variable. Try Distributive Law to factor it out: AB + AC = A(B+C).`
      default:
        return `Look at the current expression — a simplification is available.`
    }
  } catch {
    return `A simplification is available in the current expression — look carefully.`
  }
}

export function useGameState() {
  const [history, setHistory] = useState([]) // Array of { expr, step }
  const expr = history.length > 0 ? history[history.length - 1].expr : null
  const steps = history.length > 1 ? history.slice(1).map(h => h.step) : []
  const exprHistory = history.length > 1 ? history.slice(0, -1).map(h => h.expr) : []

  const [sel, setSel] = useState([])
  const [goalText, setGoalText] = useState('')
  const [goalCanon, setGoalCanon] = useState('')
  const [hintIdx, setHintIdx] = useState(0)
  const [hintsUsed, setHintsUsed] = useState(0)
  const [optimalSteps, setOptimalSteps] = useState(0)
  const [optimalPath, setOptimalPath] = useState([])
  const [applicableLaws, setApplicableLaws] = useState([])
  const [status, setStatus] = useState('select') // 'select' | 'laws' | 'success' | 'error'
  const [statusMsg, setStatusMsg] = useState('Select a term or variable to begin')
  const [isComplete, setIsComplete] = useState(false)
  const [isDeadEnd, setIsDeadEnd] = useState(false)
  const [earnedXp, setEarnedXp] = useState(0)
  const [activeGuidePaths, setActiveGuidePaths] = useState([])
  const [isAnimating, setIsAnimating] = useState(false)
  const [animationData, setAnimationData] = useState(null)

  const animationTimerRef = useRef(null)
  const goalCanonRef = useRef('')

  const syncDeadEndStatus = useCallback((exprSnapshot, fallbackMsg = 'Select a term or variable to begin') => {
    if (!exprSnapshot) return false

    if (canonText(exprSnapshot) === goalCanonRef.current) {
      setIsDeadEnd(false)
      return false
    }

    const hints = scanHints(exprSnapshot, 'R')
    if (hints.length === 0) {
      setIsDeadEnd(true)
      setApplicableLaws([])
      setStatus('error')
      setStatusMsg(DEAD_END_MSG)
      return true
    }

    setIsDeadEnd(false)
    setStatus('select')
    setStatusMsg(fallbackMsg)
    return false
  }, [])

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
      const solverRes = findOptimalPath(parsedExpr, gCanon)
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
        syncDeadEndStatus(parsedExpr)
      }
    } else {
      setHistory([{ expr: parsedExpr, step: null }])
      setIsComplete(false)
      setStatus('select')
      setStatusMsg('Select a term or variable to begin')
      syncDeadEndStatus(parsedExpr)
    }

    setGoalText(puzzle.goal)
    setGoalCanon(gCanon)
    setSel([])
    setHintIdx(0)
    setHintsUsed(0)
    setApplicableLaws([])
    setActiveGuidePaths([])
    setIsDeadEnd(false)
    setIsAnimating(false)
    setAnimationData(null)
    setEarnedXp(0)
  }, [syncDeadEndStatus])

  const updateLaws = useCallback((nextSel, exprSnapshot) => {
    if (isDeadEnd) {
      setApplicableLaws([])
      setStatus('error')
      setStatusMsg(DEAD_END_MSG)
      return
    }

    if (nextSel.length === 2) {
      const laws = analyzeSelection(exprSnapshot, nextSel)
      setApplicableLaws(laws)
      setStatus(laws.length ? 'laws' : 'error')
      if (laws.length) {
        setStatusMsg(`Applicable: Choose a law below (${laws.map(l => l.name).join(', ')})`)
      } else {
        setStatusMsg('No simplification for these selected items — try different terms or variables')
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
  }, [isDeadEnd])

  /* ---- selection handlers ---- */
  const handleClickLit = useCallback((path, exprSnapshot) => {
    if (isAnimating) return
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
    // Special case: const (0 or 1) directly inside a product or sum
    if (node && node.type === 'const') {
      const parts = path.split('.')
      if (parts.length > 1) {
        const parentPath = parts.slice(0, -1).join('.')
        const parent = getNode(exprSnapshot, parentPath)
        if (parent && parent.type === 'prod') {
          const laws = analyzeProductConst(exprSnapshot, path, node.val, parentPath)
          setSel([{ path, isTermSel: false }])
          setApplicableLaws(laws)
          setStatus(laws.length ? 'laws' : 'error')
          setStatusMsg(
            laws.length
              ? `Applicable: Choose a law below (${laws.map(l => l.name).join(', ')})`
              : 'No law applies here — try different terms'
          )
          return
        }
        if (parent && parent.type === 'sum') {
          const laws = analyzeSumConst(exprSnapshot, path, node.val, parentPath)
          setSel([{ path, isTermSel: false }])
          setApplicableLaws(laws)
          setStatus(laws.length ? 'laws' : 'error')
          setStatusMsg(
            laws.length
              ? `Applicable: Choose a law below (${laws.map(l => l.name).join(', ')})`
              : 'No law applies here — try different terms'
          )
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
        const hasNotNode = prev.some(s => getNode(exprSnapshot, s.path)?.type === 'not')
        if (hasNotNode) {
          next = [{ path, isTermSel: false }]
        } else {
          next = prev.length >= 2
            ? [prev[1], { path, isTermSel: false }]
            : [...prev, { path, isTermSel: false }]
        }
      }
      updateLaws(next, exprSnapshot)
      return next
    })
  }, [isAnimating, isDeadEnd, updateLaws])

  const handleClickNot = useCallback((path, exprSnapshot) => {
    if (isAnimating) return
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
      setStatusMsg(
        laws.length
          ? `Applicable: Choose a law below (${laws.map(l => l.name).join(', ')})`
          : 'No law applies — try a different element'
      )
      return next
    })
  }, [isAnimating, isDeadEnd])

  const handleClickTerm = useCallback((path, exprSnapshot) => {
    if (isAnimating) return
    if (isDeadEnd) {
      setSel(prev => {
        const existing = prev.findIndex(s => s.path === path)
        return existing >= 0
          ? prev.filter((_, i) => i !== existing)
          : prev.length >= 2
            ? [prev[1], { path, isTermSel: true }]
            : [...prev, { path, isTermSel: true }]
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
      const hasNotNode = prev.some(s => getNode(exprSnapshot, s.path)?.type === 'not')
      if (hasNotNode) {
        next = [{ path, isTermSel: true }]
      } else {
        next = prev.length >= 2
          ? [prev[1], { path, isTermSel: true }]
          : [...prev, { path, isTermSel: true }]
      }

      updateLaws(next, exprSnapshot)
      return next
    })
  }, [isAnimating, isDeadEnd, updateLaws])

  const applyLaw = useCallback((law, currentExpr = expr, currentSteps = steps) => {
    if (isAnimating) return
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

    if (animationTimerRef.current) {
      clearTimeout(animationTimerRef.current)
    }

    // Trigger Animation Phase
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

      // Check completion
      if (canonText(newExpr) === goalCanonRef.current) {
        setIsDeadEnd(false)
        setEarnedXp(10) // Fixed 10 points per completion
        setIsComplete(true)
        setStatus('success')
        setStatusMsg('Expression simplified! 🎉')
      } else {
        syncDeadEndStatus(newExpr, 'Step applied. Select next terms to continue.')
      }
    }, 1350) // 1.35s duration
  }, [expr, steps, isAnimating, sel, syncDeadEndStatus])

  const undoAction = useCallback(() => {
    if (animationTimerRef.current) {
      clearTimeout(animationTimerRef.current)
      animationTimerRef.current = null
    }
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
    if (puzzle) loadPuzzle(puzzle)
  }, [loadPuzzle])

  const useHint = useCallback((puzzle) => {
    // Always try to generate a contextual hint from the current expression first
    if (expr) {
      const scanResults = scanHints(expr, 'R')
      if (scanResults.length > 0) {
        const { law, paths } = scanResults[0]
        const contextMsg = buildHintText(law, paths, expr)
        setHintsUsed(h => h + 1)
        return contextMsg
      }
    }
    // Fallback: static puzzle hints (e.g. expression is already at goal)
    if (!puzzle?.hints?.length) return null
    const hint = puzzle.hints[Math.min(hintIdx, puzzle.hints.length - 1)]
    setHintIdx(i => i + 1)
    setHintsUsed(h => h + 1)
    return hint
  }, [expr, hintIdx])

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
    const hints = scanHints(expr, 'R')
    if (hints.length === 0) {
      setIsDeadEnd(true)
      setStatus('error')
      setStatusMsg(DEAD_END_MSG)
      return false
    }

    setIsDeadEnd(false)
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
    const laws = analyzeSelection(expr, nextSel)
    setApplicableLaws(laws)
    setStatus(laws.length ? 'laws' : 'select')
    setStatusMsg(laws.length
      ? 'Guide: the terms are pre-selected - pick a law to apply!'
      : 'Guide: click the highlighted terms, then choose a law.')
    return true
  }, [expr])

  return {
    expr, sel, steps, exprHistory,
    goalText, goalCanon,
    hintIdx, hintsUsed,
    optimalSteps, optimalPath,
    applicableLaws,
    isComplete, earnedXp,
    status, statusMsg,
    activeGuidePaths,
    isAnimating, animationData,
    loadPuzzle,
    handleClickLit, handleClickNot, handleClickTerm,
    applyLaw, undoAction, resetPuzzle, useHint, swapTerms, activateGuide,
  }
}
