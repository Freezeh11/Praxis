/**
 * SidePanel: the right column of the wide tiers: level (or sandbox) progress,
 * the points card with the Hint/Guide/Laws actions, the quick stage picker
 * with its review reminder, and in Sandbox mode, the interactive Expression Creator.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'

import AssistanceControls from './AssistanceControls'
import { LawsReferenceButton } from './LawsReferenceSheet'
import ExpressionGuideModal from './ExpressionGuideModal'
import { validateSandboxInput } from '../../engine/index.js'
import { SANDBOX, TIMING } from '../../config/gameRules.js'

const EXAMPLES = [
  "A(B + A')",
  'A + AB',
  "!(A * B) + C'",
  "(A + B)(A + B')",
]

const IDLE_HINT = `Accepted: A, A', AB, A(B + C), !(A · B) (up to ${SANDBOX.maxVariables} variables)`
const BUILD_FALLBACK_ERROR = 'This expression could not be simplified. Try a simpler one.'

export default function SidePanel({
  showRightPanel, lawsInRightColumn, lawsPanel, isSandbox, isCustomSandbox, level,
  stageNum, completedSet, points, steps, optimalSteps, isComplete, showSuccess,
  dismissReviewReminder, onDismissReviewReminder, isTutorialActive, isTutorialLevel, onSelectStage,
  onNavigateStages, assistanceInHeader, guideCost, onHint, onGuide, onOpenLaws,
  onRandomize, onLoadCustomExpression, expressionInputRef, chromeText, chromeHeight,
}) {
  const localInputRef = useRef(null)
  const inputRef = expressionInputRef || localInputRef

  const [rawExpr, setRawExpr] = useState('')
  const [debouncedRaw, setDebouncedRaw] = useState('')
  const [buildError, setBuildError] = useState('')
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [showGuide, setShowGuide] = useState(false)

  // Live debounced validation
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedRaw(rawExpr), TIMING.sandboxValidationDebounceMs)
    return () => window.clearTimeout(timer)
  }, [rawExpr])

  const live = useMemo(() => validateSandboxInput(debouncedRaw), [debouncedRaw])
  const current = useMemo(() => validateSandboxInput(rawExpr), [rawExpr])
  const canPlay = current.valid && !busy

  const tone = buildError
    ? 'error'
    : live.valid
      ? 'ok'
      : touched
        ? 'error'
        : 'idle'

  const feedback = {
    tone,
    invalid: tone === 'error',
    role: tone === 'error' ? 'alert' : 'status',
    glyph: tone === 'ok' ? '✓' : tone === 'error' ? '✕' : 'ⓘ',
    box: tone === 'ok'
      ? 'text-emerald-800 bg-emerald-50 border-emerald-300'
      : tone === 'error'
      ? 'text-red-700 bg-red-50 border-red-300'
      : 'text-text-3 bg-bg border-border',
    field: tone === 'ok'
      ? 'border-emerald-400 focus:border-emerald-500'
      : tone === 'error'
      ? 'border-red-400 focus:border-red-500'
      : 'border-border focus:border-accent',
    text: tone === 'error'
      ? (buildError || live.error || 'Please enter a Boolean expression.')
      : tone === 'ok'
        ? 'Valid expression'
        : IDLE_HINT,
  }

  const handleChange = (e) => {
    setTouched(true)
    setRawExpr(e.target.value)
    setBuildError('')
  }

  const handleExample = (expr) => {
    setTouched(true)
    setRawExpr(expr)
    setBuildError('')
    inputRef.current?.focus()
  }

  const handleValidate = () => {
    if (!canPlay) return
    setBuildError('')
    setBusy(true)

    window.setTimeout(() => {
      let result
      try {
        result = onLoadCustomExpression ? onLoadCustomExpression(rawExpr) : null
      } catch {
        result = { ok: false, error: BUILD_FALLBACK_ERROR }
      }

      setBusy(false)
      if (result && !result.ok) {
        setBuildError(result.error || BUILD_FALLBACK_ERROR)
      }
    }, TIMING.sandboxBusyPaintMs)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      setTouched(true)
      handleValidate()
    }
  }

  return (
    <>
      {/* ── RIGHT PANEL: Level Progress, Points, Assistance & Stages / Expression Creator ──
           Hidden on the tiers that fold it into the header / bottom dock. */}
      {showRightPanel && (
      <aside className={lawsInRightColumn
        ? 'w-[300px] min-w-[260px] bg-white border-l border-border flex flex-col overflow-hidden'
        : isSandbox
        ? 'w-[305px] min-w-[280px] bg-white border-l border-border flex flex-col overflow-hidden'
        : 'w-[280px] min-w-[240px] bg-white border-l border-border flex flex-col overflow-hidden'}>
        {/* Top: Stage / Level Progress (sandbox shows problem stats instead) */}
        {isSandbox ? (
          <div data-tutorial="sandbox-stats" className="border-b border-border p-3.5 pt-4 bg-bg/30">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold tracking-[1px] uppercase text-text-3">SANDBOX</span>
              <span className="text-xs font-bold text-sky-700">{isCustomSandbox ? 'Custom' : 'Free Practice'}</span>
            </div>
            <div className="h-1.5 bg-border rounded-full mb-2 overflow-hidden">
              <div
                className="h-full bg-teal transition-all duration-300 rounded-full"
                style={{ width: `${optimalSteps > 0 ? Math.min(100, (steps.length / optimalSteps) * 100) : (isComplete ? 100 : 0)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10.5px] text-text-3 font-medium">
              <span>{isCustomSandbox ? 'Your expression' : 'Random problem'}</span>
              <span>
                <span className="font-bold text-text-2">{steps.length}</span> steps
                {optimalSteps > 0 && <span> · optimal {optimalSteps}</span>}
              </span>
            </div>
          </div>
        ) : (
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
        )}

        {/* Middle: User Points & Assistance Controls */}
        <div data-tutorial="points-and-assistance" className="p-3.5 border-b border-border flex flex-col gap-2.5 bg-white">
          {/* User Points Card: sandbox play is unscored, so it shows a notice instead */}
          {isSandbox ? (
            <div data-tutorial="sandbox-notice" className="flex items-start gap-2.5 px-3 py-2 bg-sky-50/70 border border-sky-200 rounded-xl">
              <span className="text-base leading-none">🧪</span>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-sky-900/80">SANDBOX MODE</div>
                <div className="text-[11px] text-sky-900/90 leading-snug mt-0.5">
                  Free practice: no points, stars, or progress are recorded.
                </div>
              </div>
            </div>
          ) : (
          <div data-tutorial="points-card" className="flex items-center justify-between px-3.5 py-2.5 bg-amber-50/70 border border-amber/40 rounded-xl gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-lg shrink-0">⭐</span>
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-900/80 truncate">TOTAL POINTS</div>
                <div className="text-base font-extrabold text-amber-600 leading-none mt-0.5">
                  {points ?? 0} <span className="text-[11px] font-semibold text-amber-700">pts</span>
                </div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="inline-flex items-center whitespace-nowrap text-[10px] font-bold text-teal bg-teal/10 border border-teal/30 px-2 py-0.5 rounded-full">
                +10 to +15 on clear
              </span>
            </div>
          </div>
          )}

          {/* Hint & Guide. Folded into the header when there is no side panel. */}
          {!assistanceInHeader && (
            <>
              <AssistanceControls compact={false} isComplete={isComplete} isSandbox={isSandbox} guideCost={guideCost} points={points} onHint={onHint} onGuide={onGuide} chromeText={chromeText} chromeHeight={chromeHeight} />
              <LawsReferenceButton compact={false} chromeText={chromeText} chromeHeight={chromeHeight} onOpen={onOpenLaws} />
            </>
          )}
        </div>

        {/* Level Puzzles List OR Sandbox Expression Creator */}
        {lawsInRightColumn ? lawsPanel : (
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5">
          {isSandbox ? (
            /* Expression Creator Section */
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold tracking-[1px] uppercase text-text-3">CREATE EXPRESSION</span>
                <button
                  type="button"
                  data-testid="expression-guide-btn"
                  onClick={() => setShowGuide(true)}
                  className="text-xs font-bold text-teal hover:text-teal-700 flex items-center gap-1 cursor-pointer transition-colors"
                  title="How to write Boolean expressions"
                >
                  <span aria-hidden="true">📖</span> Guide
                </button>
              </div>

              {/* Expression input */}
              <div className="flex flex-col gap-1.5">
                <input
                  ref={inputRef}
                  data-testid="sandbox-expression-input"
                  type="text"
                  value={rawExpr}
                  onChange={handleChange}
                  onKeyDown={handleKeyDown}
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="go"
                  placeholder="e.g. A(B + A')"
                  aria-invalid={feedback.invalid}
                  aria-describedby="sandbox-panel-feedback"
                  className={`w-full px-3 py-2 rounded-xl border bg-bg text-text-1 font-mono text-sm outline-none transition-all ${feedback.field}`}
                />

                {/* Live validation feedback */}
                <div
                  id="sandbox-panel-feedback"
                  data-testid="sandbox-panel-feedback"
                  data-tone={feedback.tone}
                  role={feedback.role}
                  className={`flex items-start gap-1.5 text-xs font-semibold rounded-lg border px-2.5 py-1.5 leading-snug ${feedback.box}`}
                >
                  <span aria-hidden="true" className="shrink-0">{feedback.glyph}</span>
                  <span className="min-w-0 break-words">{feedback.text}</span>
                </div>
              </div>

              {/* Quick Examples */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-3">Try Quick Examples</span>
                <div className="flex flex-wrap gap-1.5">
                  {EXAMPLES.map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => handleExample(ex)}
                      className="px-2 py-1 rounded-md border border-border bg-bg hover:border-teal hover:text-text-1 font-mono text-[11px] font-semibold text-text-2 transition-all cursor-pointer shadow-2xs"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="button"
                  data-testid="sandbox-play-btn"
                  disabled={!canPlay}
                  onClick={handleValidate}
                  className="w-full py-2.5 px-4 rounded-xl bg-accent hover:opacity-95 text-white font-bold text-xs shadow-sm disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {busy ? 'Simplifying...' : 'Validate & Play'}
                </button>
                <button
                  type="button"
                  data-testid="sandbox-random-btn"
                  onClick={onRandomize}
                  disabled={busy}
                  className="w-full py-2 px-3 rounded-xl border border-border bg-bg hover:bg-border/50 text-text-1 font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>🎲</span> New Random Problem
                </button>
              </div>
            </div>
          ) : (
          <>
          {/* Review Mode Reminder Card: ONLY shown in tutorial stages */}
          {isTutorialLevel && isComplete && !showSuccess && !dismissReviewReminder && level && stageNum + 1 < level.puzzles.length && (
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
                  onClick={() => onDismissReviewReminder()}
                  className="px-3 py-0.5 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-[11px] font-bold transition-all cursor-pointer shadow-2xs"
                >
                  Okay
                </button>
              </div>
            </motion.div>
          )}

          <div className="flex items-center justify-between mb-1.5 px-1">
            <span className="text-[11px] font-bold tracking-[1px] uppercase text-text-3">STAGES</span>
            <button
              type="button"
              onClick={onNavigateStages}
              className="text-xs font-bold text-teal hover:text-teal-600 hover:underline flex items-center gap-0.5 transition-colors cursor-pointer"
              title="View all stages overview"
            >
              All Stages →
            </button>
          </div>
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
                  if (!isLocked && !isTutorialActive) onSelectStage(idx)
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
          </>
          )}
        </div>
        )}
      </aside>
      )}

      {/* Expression Guide Modal */}
      {isSandbox && (
        <ExpressionGuideModal
          show={showGuide}
          onClose={() => setShowGuide(false)}
          onSelectExample={handleExample}
        />
      )}
    </>
  )
}
