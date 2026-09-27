/**
 * Sandbox entry screen — Feature 1, part 2.
 *
 * The learner types their own Boolean expression, gets a LIVE validity verdict
 * while typing, and is dropped into the exact same workspace as a graded level
 * once the expression is both valid AND actually solvable by the engine
 * (`buildSandboxPuzzle`, owned by engine/sandbox/input.js).
 *
 * Two verdicts exist and they are deliberately separate:
 *
 * 1. The live validator (`validateSandboxInput`) only judges SYNTAX, and it runs
 *    debounced so the message does not flicker on every keystroke.
 * 2. `buildSandboxPuzzle` runs only on submit and judges SOLVABILITY — e.g. "A"
 *    is a perfectly valid expression but there is nothing left to simplify, so
 *    the learner is sent back here with that verdict instead of into an empty
 *    workspace. That is why a build error outranks the live verdict in the
 *    feedback slot: the live validator would still say "Valid expression".
 *
 * VERDICT TIMING (user-reported bug): "Please enter a Boolean expression." is
 * NOT a first-paint verdict. A blank field nobody has edited yet is not a
 * mistake, so the feedback slot shows a neutral helper line instead — and the
 * empty-input error becomes reachable only after the learner has actually
 * touched the field (typed then cleared) or tried to submit while it is empty.
 * The message string itself is part of the product spec: byte-identical.
 *
 * MOBILE: on a landscape phone (390px tall) the whole actionable stack — the
 * input, "Validate & Play" and the first example chip — has to sit above the
 * fold. The hero therefore collapses on short viewports (`.praxis-hide-short`
 * drops the decorative copy) and the example chips live in a `.praxis-rail`,
 * which never widens the page and stays thumb-scrollable. Tap targets keep
 * their minimum sizes rather than being shrunk to fit.
 *
 * Nothing is scored in the sandbox, so this screen has no progress or API of
 * its own — it just hands `{ customPuzzle, exprText }` to /sandbox/play.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { validateSandboxInput, buildSandboxPuzzle } from '../engine/index.js'
import { TIMING } from '../config/gameRules.js'

/** Keep the verdict off every keystroke — ~300ms after the learner stops. */

/**
 * The solver is synchronous, so the button is allowed to paint its "Simplifying…"
 * state before it takes the main thread.
 */

/**
 * One-tap starting points covering the whole accepted notation.
 *
 * Every chip MUST be engine-playable — clicking one and pressing "Validate &
 * Play" has to reach /sandbox/play. A chip whose expression validates but is
 * already terminal (`AB + A'C`, `(x+y)(x'+z)`) bounces the learner back with
 * "already in its simplest form", which reads as "the recommended input does
 * not work". The four below are one absorption/SOP, one factoring/complement,
 * one De Morgan and one POS-dual, and .e2e/sandbox-engine-audit.mjs replays
 * each of them through the real move set.
 */
const EXAMPLES = [
  "A(B + A')",
  'A + AB',
  "!(A * B) + C'",
  "(A + B)(A + B')",
]

/**
 * Shown while the field is still untouched and empty: what CAN be typed, never
 * an accusation about what has not been typed yet.
 */
const IDLE_HINT = "Accepted: A, A', AB, A(B + C), !(A · B)"

const BUILD_FALLBACK_ERROR = 'This expression could not be simplified. Try a simpler one.'

/**
 * The three states of the feedback slot. `idle` is the pre-interaction helper:
 * neutral colours, a neutral glyph, role="status" — nothing is wrong yet.
 * `ok` and `error` are the verdicts the live validator and the puzzle builder
 * have always produced. Every class string is spelled out in full so Tailwind's
 * scanner sees it.
 */
const TONES = {
  idle: {
    role: 'status',
    glyph: 'ⓘ',
    box: 'text-text-2 bg-bg border-border',
    field: 'border-border focus:border-accent',
  },
  ok: {
    role: 'status',
    glyph: '✓',
    box: 'text-green bg-green-light/60 border-green/30',
    field: 'border-green/60 focus:border-green',
  },
  error: {
    role: 'alert',
    glyph: '✗',
    box: 'text-red bg-red/5 border-red/25',
    field: 'border-red/60 focus:border-red',
  },
}

export default function SandboxPage() {
  const navigate = useNavigate()
  const inputRef = useRef(null)

  const [raw, setRaw] = useState('')
  const [debouncedRaw, setDebouncedRaw] = useState('')
  // Set by buildSandboxPuzzle AND by its failure paths; cleared on any edit.
  const [buildError, setBuildError] = useState('')
  /* True only after a real edit (or an explicit submit attempt). This is what
     keeps the empty-input error off the first paint. */
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)

  /* Live validation, debounced: a learner mid-word is told nothing yet. */
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedRaw(raw), TIMING.sandboxValidationDebounceMs)
    return () => window.clearTimeout(timer)
  }, [raw])

  const live = useMemo(() => validateSandboxInput(debouncedRaw), [debouncedRaw])
  /* The button follows the raw text, so a valid expression is playable at once. */
  const current = useMemo(() => validateSandboxInput(raw), [raw])

  const canPlay = current.valid && !busy

  /* Priority: a build verdict wins over the live one; the live verdict wins over
     nothing at all — an untouched empty field is simply idle. */
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
    role: TONES[tone].role,
    glyph: TONES[tone].glyph,
    text: tone === 'error'
      ? (buildError || live.error || 'Please enter a Boolean expression.')
      : tone === 'ok'
        ? 'Valid expression'
        : IDLE_HINT,
  }

  const handleChange = (event) => {
    setTouched(true)
    setRaw(event.target.value)
    setBuildError('')
  }

  const handleExample = (expression) => {
    setTouched(true)
    setRaw(expression)
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
        result = buildSandboxPuzzle(raw)
      } catch {
        result = { ok: false, error: BUILD_FALLBACK_ERROR }
      }

      if (result?.ok) {
        // Keep the busy state — this screen is about to unmount.
        navigate('/sandbox/play', {
          state: { customPuzzle: result.puzzle, exprText: result.exprText },
        })
        return
      }

      setBusy(false)
      setBuildError(result?.error || BUILD_FALLBACK_ERROR)
    }, TIMING.sandboxBusyPaintMs)
  }

  /**
   * Enter inside the input submits, exactly like pressing the button. It is also
   * an explicit submit attempt WHILE the field is empty — the CTA is disabled
   * then, so the keystroke is the only signal, and it counts as touching.
   */
  const handleKeyDown = (event) => {
    if (event.key === 'Enter') setTouched(true)
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    /* Submitting an empty field IS an explicit request for the verdict, so it
       counts as touching the field even though nothing was typed. */
    setTouched(true)
    handleValidate()
  }

  const handleRandom = () => {
    navigate('/sandbox/play', { state: { random: true } })
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col relative overflow-x-hidden bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] bg-[size:32px_32px]">
      {/* Header — back link + the screen title, fluid at any width. Tighter on a
          landscape phone, where every vertical pixel belongs to the form, but the
          back link keeps a 44px tap target everywhere except a pointer-fine
          desktop window. */}
      <header className="relative w-full px-4 py-3 sm:px-8 [@media(max-height:480px)]:!py-1 flex items-center justify-between gap-3 bg-bg-card/70 backdrop-blur-md border-b-2 border-border z-20 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/levels"
            aria-label="Back to levels"
            className="h-9 max-[1023px]:!h-11 [@media(max-height:480px)]:!h-11 px-3 rounded-lg flex items-center gap-1.5 text-[13px] font-bold text-text-2 bg-bg border border-border hover:bg-border hover:text-text-1 transition-all shrink-0"
          >
            <span aria-hidden="true">←</span>
            <span>Levels</span>
          </Link>
          <h1 className="text-[20px] font-bold text-accent tracking-tight truncate">Sandbox</h1>
        </div>
        <span className="hidden sm:inline-flex text-[11px] font-bold text-text-3 bg-bg border border-border rounded-full px-3 py-1 shrink-0">
          No points awarded
        </span>
      </header>

      {/* `.praxis-page-x` keeps the gutters clear of landscape notches,
          `.praxis-safe-b` keeps the last row clear of the home indicator. */}
      <main className="praxis-page-x praxis-safe-b relative flex-1 w-full max-w-2xl mx-auto py-8 sm:py-12 flex flex-col gap-4 sm:gap-6 [@media(max-height:480px)]:!py-1.5 [@media(max-height:480px)]:!gap-2">
        <div className="flex flex-col items-center text-center gap-2 [@media(max-height:480px)]:!gap-0">
          <span className="praxis-hide-short text-[11px] font-bold tracking-[0.2em] uppercase text-text-3">
            Free Practice
          </span>
          <h2 className="text-[26px] sm:text-[32px] font-bold tracking-tight text-accent [@media(max-height:480px)]:!text-[17px] [@media(max-height:480px)]:!leading-tight">
            Solve Your Own Expression
          </h2>
          <p className="praxis-hide-short text-[14px] sm:text-[15px] text-text-2 font-medium max-w-lg leading-relaxed">
            Type any Boolean expression — we check it as you write, simplify it, and hand you the
            same workspace the levels use.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="w-full bg-bg-card border-[1.5px] border-border rounded-[20px] shadow-md p-4 sm:p-7 flex flex-col gap-3 [@media(max-height:480px)]:!p-3 [@media(max-height:480px)]:!gap-2"
        >
          <label
            htmlFor="sandbox-expression"
            className="text-[13px] font-bold text-text-1 [@media(max-height:480px)]:!leading-none"
          >
            Enter a Boolean expression
          </label>

          <input
            id="sandbox-expression"
            ref={inputRef}
            data-testid="sandbox-input"
            type="text"
            value={raw}
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
            aria-describedby="sandbox-feedback"
            className={`w-full px-4 py-3.5 rounded-xl border-[1.5px] bg-bg text-text-1 font-mono text-[16px] sm:text-[18px] outline-none transition-all [@media(max-height:480px)]:!py-2
              ${TONES[feedback.tone].field}`}
          />

          {/* Live verdict — directly under the input, never a toast. Idle (nothing
              typed yet) is a neutral helper, not an error. */}
          <div
            id="sandbox-feedback"
            data-testid="sandbox-feedback"
            data-tone={feedback.tone}
            role={feedback.role}
            className={`flex items-start gap-2 text-[13px] font-semibold rounded-lg border px-3 py-2 leading-snug [@media(max-height:480px)]:!py-1
              ${TONES[feedback.tone].box}`}
          >
            <span aria-hidden="true" className="shrink-0 leading-snug">
              {feedback.glyph}
            </span>
            <span className="min-w-0 break-words">{feedback.text}</span>
          </div>

          {/* Example chips fill the input, so the accepted notation is discoverable.
              A rail at every width: it can never push the page sideways, and on a
              phone it is thumb-scrollable instead of wrapping into extra rows. */}
          <div className="flex items-center gap-2 pt-0.5 min-w-0">
            <span className="text-[11px] font-bold uppercase tracking-wide text-text-3 shrink-0">
              Try
            </span>
            <div className="praxis-rail flex-1 min-w-0" role="group" aria-label="Example expressions">
              {EXAMPLES.map((expression) => (
                <button
                  key={expression}
                  type="button"
                  data-example={expression}
                  onClick={() => handleExample(expression)}
                  className="praxis-touch-target px-3 rounded-lg border border-border bg-bg font-mono text-[12.5px] font-semibold text-text-2 whitespace-nowrap hover:border-accent hover:text-text-1 hover:bg-white transition-all cursor-pointer"
                >
                  {expression}
                </button>
              ))}
            </div>
          </div>

          {/* Side by side as soon as there is room for both; stacked only on a
              narrow portrait phone, where the thumb reach matters more. */}
          <div className="flex flex-col min-[481px]:flex-row gap-2 sm:gap-2.5 pt-0.5">
            <button
              type="submit"
              data-testid="sandbox-validate-btn"
              disabled={!canPlay}
              className="w-full min-[481px]:w-auto min-[481px]:flex-1 min-h-[48px] bg-accent text-white text-[15px] font-bold px-6 rounded-xl shadow-md transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:not:disabled:scale-[1.02] hover:not:disabled:shadow-lg cursor-pointer"
            >
              {busy ? 'Simplifying…' : 'Validate & Play'}
            </button>
            <button
              type="button"
              data-testid="sandbox-random-btn"
              onClick={handleRandom}
              disabled={busy}
              className="w-full min-[481px]:w-auto min-h-[48px] bg-bg-card border-[1.5px] border-border text-text-1 text-[15px] font-bold px-6 rounded-xl shadow-sm transition-all hover:border-accent hover:shadow-md disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              🎲 Random problem
            </button>
          </div>
        </form>

        {/* Notation cheat sheet — keeps the validator's rules visible up front. */}
        <div className="w-full bg-bg-card/70 border border-border rounded-2xl px-4 py-3.5 flex flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wide text-text-3">Notation</span>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[12.5px] text-text-2 font-medium">
            <span>AND: <code className="font-mono text-text-1">AB</code> <code className="font-mono text-text-1">A·B</code> <code className="font-mono text-text-1">A*B</code> <code className="font-mono text-text-1">A&amp;B</code></span>
            <span>OR: <code className="font-mono text-text-1">A+B</code> <code className="font-mono text-text-1">A|B</code></span>
            <span>NOT: <code className="font-mono text-text-1">A&apos;</code> <code className="font-mono text-text-1">!A</code></span>
            <span>Constants: <code className="font-mono text-text-1">0</code> <code className="font-mono text-text-1">1</code></span>
            <span>Up to 6 variables</span>
          </div>
        </div>
      </main>
    </div>
  )
}
