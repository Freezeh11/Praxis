import { useState, useCallback, useRef } from 'react'
import { parseExpr, cloneN, canonText, nodeText, getNode } from '../lib/expr.js'
import { analyzeSelection, analyzeNot, analyzeProductConst, scanHints } from '../lib/laws.js'

export function useGameState() {
  const [expr, setExpr] = useState(null)
  const [sel, setSel] = useState([])
  const [steps, setSteps] = useState([])
  const [exprHistory, setExprHistory] = useState([])
  const [goalText, setGoalText] = useState('')
  const [goalCanon, setGoalCanon] = useState('')
  const [hintIdx, setHintIdx] = useState(0)
  const [hintsUsed, setHintsUsed] = useState(0)
  const [applicableLaws, setApplicableLaws] = useState([])
  const [status, setStatus] = useState('select') // 'select' | 'laws' | 'success' | 'error'
  const [statusMsg, setStatusMsg] = useState('Select a term or variable to begin')
  const [isComplete, setIsComplete] = useState(false)
  const [earnedXp, setEarnedXp] = useState(0)
  const [activeGuidePaths, setActiveGuidePaths] = useState([])
  const [isAnimating, setIsAnimating] = useState(false)
  const [animationData, setAnimationData] = useState(null)

  // Keep goalCanon in a ref so applyLaw can always read the latest value
  const goalCanonRef = useRef('')

  const loadPuzzle = useCallback((puzzle) => {
    const parsedExpr = parseExpr(puzzle.expr)
    const gCanon = canonText(parseExpr(puzzle.goal))
    goalCanonRef.current = gCanon
    setExpr(parsedExpr)
    setGoalText(puzzle.goal)
    setGoalCanon(gCanon)
    setSel([])
    setSteps([])
    setExprHistory([])
    setHintIdx(0)
    setHintsUsed(0)
    setApplicableLaws([])
    setActiveGuidePaths([])
    setIsComplete(false)
    setIsAnimating(false)
    setAnimationData(null)
    setEarnedXp(0)
    setStatus('select')
    setStatusMsg('Select a term or variable to begin')
  }, [])

  const updateLaws = useCallback((nextSel, exprSnapshot) => {
    if (nextSel.length === 2) {
      const laws = analyzeSelection(exprSnapshot, nextSel)
      setApplicableLaws(laws)
      setStatus(laws.length ? 'laws' : 'error')
      setStatusMsg(laws.length ? 'Choose an applicable law →' : 'No simplification here — try different terms')
    } else {
      setApplicableLaws([])
      setStatus('select')
      setStatusMsg(nextSel.length === 1 ? 'Now select a second term or variable' : 'Select a term or variable to begin')
    }
  }, [])

  /* ---- selection handlers ---- */
  const handleClickLit = useCallback((path, exprSnapshot) => {
    if (isAnimating) return
    const node = getNode(exprSnapshot, path)
    // Special case: const (0 or 1) directly inside a product
    if (node && node.type === 'const') {
      const parts = path.split('.')
      if (parts.length > 1) {
        const parentPath = parts.slice(0, -1).join('.')
        const parent = getNode(exprSnapshot, parentPath)
        if (parent && parent.type === 'prod') {
          const laws = analyzeProductConst(exprSnapshot, path, node.val, parentPath)
          setSel([])
          setApplicableLaws(laws)
          setStatus(laws.length ? 'laws' : 'error')
          setStatusMsg(laws.length ? 'Choose an applicable law →' : 'No law applies here — try different terms')
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
        next = prev.length >= 2
          ? [prev[1], { path, isTermSel: false }]
          : [...prev, { path, isTermSel: false }]
      }
      updateLaws(next, exprSnapshot)
      return next
    })
  }, [])

  const handleClickNot = useCallback((path, exprSnapshot) => {
    if (isAnimating) return
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
      next = prev.length >= 2
        ? [prev[1], { path, isTermSel: false }]
        : [...prev, { path, isTermSel: false }]

      if (next.length === 2) {
        const laws = analyzeSelection(exprSnapshot, next)
        setApplicableLaws(laws)
        setStatus(laws.length ? 'laws' : 'error')
        setStatusMsg(laws.length ? 'Choose an applicable law →' : 'No simplification here — try different terms')
      } else {
        const laws = analyzeNot(exprSnapshot, path)
        setApplicableLaws(laws)
        setStatus(laws.length ? 'laws' : 'error')
        setStatusMsg(laws.length ? 'Choose an applicable law →' : 'No law applies — try a different element')
      }
      return next
    })
  }, [])

  const handleClickTerm = useCallback((path, exprSnapshot) => {
    if (isAnimating) return
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
      next = prev.length >= 2
        ? [prev[1], { path, isTermSel: true }]
        : [...prev, { path, isTermSel: true }]

      updateLaws(next, exprSnapshot)
      return next
    })
  }, [])

  const applyLaw = useCallback((law, currentExpr, currentSteps) => {
    if (isAnimating) return

    const before = nodeText(currentExpr)
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

    // Trigger Animation Phase
    setIsAnimating(true)
    setAnimationData({
      lawId: law.id,
      lawName: law.name,
      paths: sel.map(s => s.path),
      exprBefore: currentExpr,
      exprAfter: newExpr
    })
    setStatus('select')
    setStatusMsg(`Applying ${law.name}...`)

    // Wait 2.5 seconds for animation to play, then update AST
    setTimeout(() => {
      setExprHistory(h => [...h, currentExpr])
      setExpr(newExpr)
      const newSteps = [...currentSteps, { law: law.name, from: before, to: after }]
      setSteps(newSteps)
      setSel([])
      setApplicableLaws([])
      setActiveGuidePaths([])
      setIsAnimating(false)
      setAnimationData(null)

      // Check completion
      if (canonText(newExpr) === goalCanonRef.current) {
        setEarnedXp(10) // Fixed 10 points per completion
        setIsComplete(true)
        setStatus('success')
        setStatusMsg('Expression simplified! 🎉')
      } else {
        setStatus('select')
        setStatusMsg('Step applied. Select next terms to continue.')
      }
    }, 2500) // 2.5s duration
  }, [sel, isAnimating])

  const undoAction = useCallback(() => {
    setExprHistory(h => {
      if (h.length === 0) return h
      const prev = h[h.length - 1]
      setExpr(prev)
      setSteps(s => s.slice(0, -1))
      setSel([])
      setApplicableLaws([])
      setActiveGuidePaths([])
      setIsComplete(false)
      setStatus('select')
      setStatusMsg('Undone. Select terms to continue.')
      return h.slice(0, -1)
    })
  }, [])

  const resetPuzzle = useCallback((puzzle) => {
    if (puzzle) loadPuzzle(puzzle)
  }, [loadPuzzle])

  const useHint = useCallback((puzzle) => {
    if (!puzzle?.hints?.length) return null
    const hint = puzzle.hints[Math.min(hintIdx, puzzle.hints.length - 1)]
    setHintIdx(i => i + 1)
    setHintsUsed(h => h + 1)
    return hint
  }, [hintIdx])

  /** Drag-and-drop term reorder — no law applied, no step recorded */
  const swapTerms = useCallback((sumPath, fromIdx, toIdx) => {
    if (fromIdx === toIdx) return
    setExpr(prevExpr => {
      const tree = cloneN(prevExpr)
      const sn = getNode(tree, sumPath)
      if (!sn || sn.type !== 'sum') return prevExpr
      const tmp = sn.terms[fromIdx]
      sn.terms[fromIdx] = sn.terms[toIdx]
      sn.terms[toIdx] = tmp
      return tree
    })
    setSel([])
    setApplicableLaws([])
    setActiveGuidePaths([])
    setStatus('select')
    setStatusMsg('Terms reordered. Select terms to continue.')
  }, [])

  const activateGuide = useCallback(() => {
    if (!expr) return false
    const hints = scanHints(expr, 'R')
    if (hints.length === 0) {
      setStatus('error')
      setStatusMsg('No simplifications found for the current expression.')
      return false
    }

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
      ? 'Guide: the terms are pre-selected — pick a law to apply!'
      : 'Guide: click the highlighted terms, then choose a law.')
    return true
  }, [expr])

  return {
    expr, sel, steps, exprHistory,
    goalText, goalCanon,
    hintIdx, hintsUsed,
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
