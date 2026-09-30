/**
 * MobileExpressionModal: Modal dialog for entering and validating custom
 * expressions on narrow / mobile viewports where the side panel is collapsed.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { validateSandboxInput } from '../../engine/index.js'
import { SANDBOX, TIMING } from '../../config/gameRules.js'
import ExpressionGuideModal from './ExpressionGuideModal'

const EXAMPLES = [
  "A(B + A')",
  'A + AB',
  "!(A * B) + C'",
  "(A + B)(A + B')",
]

const IDLE_HINT = `Accepted: A, A', AB, A(B + C), !(A · B) (up to ${SANDBOX.maxVariables} variables)`
const BUILD_FALLBACK_ERROR = 'This expression could not be simplified. Try a simpler one.'

export default function MobileExpressionModal({
  show,
  onClose,
  onLoadCustomExpression,
  onRandomize,
}) {
  const inputRef = useRef(null)
  const [rawExpr, setRawExpr] = useState('')
  const [debouncedRaw, setDebouncedRaw] = useState('')
  const [buildError, setBuildError] = useState('')
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [showGuide, setShowGuide] = useState(false)

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
      if (result?.ok) {
        onClose()
      } else {
        setBuildError(result?.error || BUILD_FALLBACK_ERROR)
      }
    }, TIMING.sandboxBusyPaintMs)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      setTouched(true)
      handleValidate()
    }
  }

  if (!show) return null

  return (
    <>
      <AnimatePresence>
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/40 backdrop-blur-[2px]"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="bg-white rounded-2xl flex flex-col shadow-2xl max-w-sm w-full border border-border overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-4 py-3.5 border-b border-border flex items-center justify-between bg-bg/50 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-lg leading-none">✎</span>
                <h3 className="text-sm font-bold text-text-1">Create Expression</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowGuide(true)}
                  className="text-xs font-bold text-teal hover:text-teal-700 flex items-center gap-0.5 cursor-pointer"
                >
                  <span aria-hidden="true">📖</span> Guide
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-text-3 hover:text-text-1 hover:bg-border/60 font-bold text-xs cursor-pointer"
                  title="Close"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-4 flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="mobile-sandbox-input" className="text-xs font-bold text-text-1">
                  Enter a Boolean expression
                </label>
                <input
                  id="mobile-sandbox-input"
                  ref={inputRef}
                  type="text"
                  value={rawExpr}
                  onChange={handleChange}
                  onKeyDown={handleKeyDown}
                  autoFocus
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="go"
                  placeholder="e.g. A(B + A')"
                  aria-invalid={feedback.invalid}
                  className={`w-full px-3 py-2 rounded-xl border bg-bg text-text-1 font-mono text-sm outline-none transition-all ${feedback.field}`}
                />

                <div
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
                  disabled={!canPlay}
                  onClick={handleValidate}
                  className="w-full py-2.5 px-4 rounded-xl bg-accent hover:opacity-95 text-white font-bold text-xs shadow-sm disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {busy ? 'Simplifying...' : 'Validate & Play'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onRandomize?.()
                    onClose()
                  }}
                  className="w-full py-2 px-3 rounded-xl border border-border bg-bg hover:bg-border/50 text-text-1 font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>🎲</span> New Random Problem
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </AnimatePresence>

      <ExpressionGuideModal
        show={showGuide}
        onClose={() => setShowGuide(false)}
        onSelectExample={handleExample}
      />
    </>
  )
}
