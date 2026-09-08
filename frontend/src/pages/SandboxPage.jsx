import { useState } from 'react'
import { Link } from 'react-router-dom'
import logoFull from '../assets/logo-full.png'
import { toast } from 'sonner'
import PracticeWorkspace from '../components/PracticeWorkspace'
import { parseExpr, canonText, nodeText, validateExpr } from '../lib/expr'
import { findOptimalPath, findSimplestForm } from '../lib/solver'

const EXAMPLE_EXPRESSIONS = [
  'x + xy',
  "x'y + xy + xy",
  '(x + y)(x + y\')',
  "wx'y + wxy + wx'yz",
  "(w+x+y+z)' + w'x'",
]

/**
 * Sandbox mode: the user types ANY boolean expression (and optionally a
 * target goal) and plays it through the real law engine.
 */
export default function SandboxPage() {
  const [exprInput, setExprInput] = useState('')
  const [goalInput, setGoalInput] = useState('')
  const [puzzle, setPuzzle] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const handleStart = () => {
    setSubmitting(true)

    const exprCheck = validateExpr(exprInput)
    if (!exprCheck.valid) {
      toast.error(exprCheck.error)
      setSubmitting(false)
      return
    }

    let goalText = null
    let goalCanon = null
    let optimalSteps = 0

    if (goalInput.trim()) {
      const goalCheck = validateExpr(goalInput)
      if (!goalCheck.valid) {
        toast.error(`Target: ${goalCheck.error}`)
        setSubmitting(false)
        return
      }
      const goalTree = parseExpr(goalInput)
      goalCanon = canonText(goalTree)
      goalText = nodeText(goalTree)

      const exprTree = parseExpr(exprInput)
      if (canonText(exprTree) === goalCanon) {
        toast.info('That expression is already equal to the target.')
        setSubmitting(false)
        return
      }
      const res = findOptimalPath(exprTree, goalCanon)
      optimalSteps = res.found ? res.optimalSteps : 0
      if (!res.found) {
        toast.info("Couldn't verify a path to that target — you can still try, or leave the target empty to auto-simplify.")
      }
    } else {
      // No target: auto-compute the fully simplified form
      const exprTree = parseExpr(exprInput)
      const simplest = findSimplestForm(exprTree)
      if (!simplest.found) {
        toast.error("Couldn't compute the simplified form — try a smaller expression.")
        setSubmitting(false)
        return
      }
      if (simplest.optimalSteps === 0) {
        toast.info('That expression is already fully simplified.')
        setSubmitting(false)
        return
      }
      goalText = simplest.text
      goalCanon = simplest.canon
      optimalSteps = simplest.optimalSteps
    }

    setPuzzle({
      expr: nodeText(parseExpr(exprInput)),
      goal: goalText,
      goalCanon,
      optimalSteps,
      hints: [],
      targetLaws: [],
    })
    setSubmitting(false)
  }

  const handleEdit = () => {
    setPuzzle(null)
  }

  if (puzzle) {
    return (
      <div className="h-screen flex flex-col bg-bg p-3 sm:p-4">
        <PracticeWorkspace
          puzzle={puzzle}
          onExit={handleEdit}
          exitLabel="Edit equation"
          title="Sandbox"
          subtitle={`Simplify: ${puzzle.expr}`}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col relative overflow-hidden bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] bg-[size:32px_32px]">
      {/* Header */}
      <header className="relative w-full h-[64px] px-6 md:px-10 flex items-center justify-between bg-bg-card/70 backdrop-blur-md border-b-2 border-border z-20 shrink-0">
        <Link to="/" className="flex items-center hover:opacity-80 transition-opacity">
          <img src={logoFull} alt="Praxis" className="h-8 object-contain" />
        </Link>
        <div className="flex items-center gap-2">
          <Link to="/practice" className="h-9 px-3 rounded-lg flex items-center justify-center text-[13px] font-bold text-text-2 bg-bg hover:bg-border hover:text-text-1 transition-all">
            🎲 Practice
          </Link>
          <Link to="/tutorial" className="h-9 px-3 rounded-lg flex items-center justify-center text-[13px] font-bold text-text-2 bg-bg hover:bg-border hover:text-text-1 transition-all">
            ▶ Tutorial
          </Link>
          <Link to="/" className="h-9 px-3 rounded-lg flex items-center justify-center text-[13px] font-bold text-text-2 bg-bg hover:bg-border hover:text-text-1 transition-all">
            ← Home
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-2xl bg-white rounded-2xl border border-border shadow-lg p-8 flex flex-col gap-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">🧪</span>
              <h1 className="text-2xl font-extrabold text-text-1 tracking-tight">Sandbox Mode</h1>
            </div>
            <p className="text-sm text-text-3 leading-relaxed">
              Type any Boolean expression and Praxis will guide you through simplifying it.
              Leave the target empty and the engine auto-computes the fully simplified form.
            </p>
          </div>

          {/* Notation help */}
          <div className="bg-bg border border-border rounded-xl px-4 py-3 text-xs text-text-2 leading-relaxed">
            <span className="font-bold text-text-1">Notation:</span> variables are single letters (a–z),{' '}
            <code className="font-mono bg-white border border-border rounded px-1">x'</code> means NOT x,{' '}
            <code className="font-mono bg-white border border-border rounded px-1">+</code> means OR, and
            multiplication means AND (<code className="font-mono bg-white border border-border rounded px-1">xy</code> = x AND y).
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold tracking-[1px] uppercase text-text-2">Expression to simplify</span>
            <input
              type="text"
              value={exprInput}
              onChange={e => setExprInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleStart()}
              placeholder="e.g. x'y + xy + xyz"
              className="h-11 px-4 rounded-xl border-[1.5px] border-border bg-white font-mono text-[15px] text-text-1 outline-none focus:border-teal focus:ring-2 focus:ring-teal/20 transition-all placeholder:text-text-3"
              autoFocus
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold tracking-[1px] uppercase text-text-2">
              Target form <span className="text-text-3 font-medium normal-case">(optional — leave empty to auto-simplify)</span>
            </span>
            <input
              type="text"
              value={goalInput}
              onChange={e => setGoalInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleStart()}
              placeholder="e.g. x"
              className="h-11 px-4 rounded-xl border-[1.5px] border-border bg-white font-mono text-[15px] text-text-1 outline-none focus:border-teal focus:ring-2 focus:ring-teal/20 transition-all placeholder:text-text-3"
            />
          </label>

          {/* Example chips */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-text-3 font-semibold">Try:</span>
            {EXAMPLE_EXPRESSIONS.map(ex => (
              <button
                key={ex}
                type="button"
                className="px-3 py-1.5 rounded-full border border-border bg-bg font-mono text-xs text-text-2 hover:border-teal hover:text-teal hover:bg-teal-light transition-all"
                onClick={() => { setExprInput(ex); setGoalInput('') }}
              >
                {ex}
              </button>
            ))}
          </div>

          <button
            className="h-12 rounded-xl bg-accent text-white font-bold text-[15px] shadow-[0_8px_16px_-6px_rgba(37,99,235,0.4)] hover:bg-text-1 hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleStart}
            disabled={submitting || !exprInput.trim()}
          >
            {submitting ? 'Analyzing…' : 'Start simplifying →'}
          </button>
        </div>
      </main>
    </div>
  )
}
