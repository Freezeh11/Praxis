import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import logoFull from '../assets/logo-full.png'
import PracticeWorkspace from '../components/PracticeWorkspace'

const TUTORIAL_PUZZLE = {
  expr: 'x + xy',
  goal: 'x',
  optimalSteps: 1,
  hints: [],
  targetLaws: ['absorption'],
}

const STEPS = [
  {
    id: 0,
    icon: '👋',
    title: 'Welcome to Praxis',
    text: 'Praxis is an interactive trainer for simplifying Boolean expressions using algebra laws. In the next two minutes you will solve your first real problem: simplify x + xy down to x.',
    action: 'start',
  },
  {
    id: 1,
    icon: '👆',
    title: 'Select the term x',
    text: 'Every step starts by SELECTING parts of the expression. Click the BLINKING term x in the workspace — it is highlighted just for you.',
    action: 'wait-sel-1',
  },
  {
    id: 2,
    icon: '✌️',
    title: 'Now select xy',
    text: 'Great! Now click the BLINKING term xy. With two items selected, Praxis shows every law you can apply to them.',
    action: 'wait-sel-2',
  },
  {
    id: 3,
    icon: '⚡',
    title: 'Apply the Absorption Law',
    text: 'Look below the expression: the Absorption Law card is BLINKING. Click it to apply the law and simplify the expression.',
    action: 'wait-step',
  },
  {
    id: 4,
    icon: '🎉',
    title: 'You did it!',
    text: "x + xy became x. That's a full Praxis move: select terms, pick a law, simplify. Each level asks you to chain several of these.",
    action: 'wait-complete',
  },
  {
    id: 5,
    icon: '🎯',
    title: 'Check the Goal',
    text: 'Above the expression you will always see the GOAL chip — the expression you are simplifying toward. Every problem shows it, so you always know what you are aiming at.',
    action: 'next',
  },
  {
    id: 6,
    icon: '↶',
    title: 'Undo your move',
    text: 'Made a mistake? Press the UNDO button in the top bar of the workspace to take back your last step. Try it now — your completed answer will go back to the unsimplified expression.',
    action: 'wait-undo',
  },
  {
    id: 7,
    icon: '💡',
    title: 'Use the Hint button',
    text: 'Stuck? Press the HINT button in the top bar. Praxis scans the current expression and gives you a worded hint about what to do next — without solving it for you.',
    action: 'wait-hint',
  },
  {
    id: 8,
    icon: '↺',
    title: 'Reset the problem',
    text: 'The RESET button restarts the problem from scratch. Press it now to get a clean x + xy, then close the hint bubble if it is still open.',
    action: 'wait-reset',
  },
  {
    id: 9,
    icon: '🏆',
    title: 'Solve it again — by yourself',
    text: 'Now the real test: solve x + xy one more time WITHOUT the blinking hints. Select x, select xy, and apply the Absorption Law.',
    action: 'wait-complete',
  },
  {
    id: 10,
    icon: '🚀',
    title: "You're ready!",
    text: 'Work through the three levels to master every law, revisit the tutorial anytime from the home page, and consult the Law Reference screen during any problem.',
    action: 'done',
  },
]

/**
 * Interactive tutorial: a guided first playthrough of a real problem.
 * Instruction steps auto-advance when the user performs the correct
 * action in the live workspace (select, apply, complete).
 */
export default function TutorialPage() {
  const navigate = useNavigate()
  const [stepIdx, setStepIdx] = useState(0)
  const [started, setStarted] = useState(false)
  const [advanceTimer, setAdvanceTimer] = useState(null)

  const step = STEPS[stepIdx]

  const markCompleted = useCallback(() => {
    try {
      localStorage.setItem('praxis_tutorial_completed', 'true')
    } catch {
      // localStorage unavailable — ignore
    }
  }, [])

  const goToStep = useCallback((idx) => {
    setStepIdx(Math.max(0, Math.min(STEPS.length - 1, idx)))
  }, [])

  const handleStart = () => {
    setStarted(true)
    goToStep(1)
  }

  const handleSkip = () => {
    if (advanceTimer) clearTimeout(advanceTimer)
    markCompleted()
    navigate('/')
  }

  // React to workspace state: advance when the current step's goal is met
  const handleStateChange = useCallback((snapshot) => {
    if (!started) return

    // Step 9: the final unassisted solve → finish the tutorial
    if (stepIdx === 9 && snapshot.isComplete) {
      setAdvanceTimer(setTimeout(() => {
        markCompleted()
        goToStep(10)
      }, 900))
      return
    }

    // First completion → show the "you did it" step, then advance to the
    // goal-info step. (Completion is the last snapshot the workspace emits,
    // so the second advance is scheduled right here.)
    if (snapshot.isComplete) {
      if (stepIdx < 4) goToStep(4)
      if (stepIdx < 5) {
        setAdvanceTimer(setTimeout(() => goToStep(5), 1200))
      }
      return
    }

    // Step 6: user pressed Undo → steps back to zero
    if (stepIdx === 6 && snapshot.stepsCount === 0) {
      setAdvanceTimer(setTimeout(() => goToStep(7), 500))
      return
    }

    // Step 7: user pressed Hint → hint bubble is visible
    if (stepIdx === 7 && snapshot.hintShown) {
      setAdvanceTimer(setTimeout(() => goToStep(8), 600))
      return
    }

    // Step 8: user pressed Reset → reset counter bumped
    if (stepIdx === 8 && snapshot.resetCount >= 1) {
      setAdvanceTimer(setTimeout(() => goToStep(9), 500))
      return
    }

    // Catch-up: user already applied a law before the tutorial expected it
    if (stepIdx < 4 && snapshot.stepsCount >= 1) {
      goToStep(4)
      return
    }

    if (stepIdx === 1 && snapshot.selCount >= 1) {
      setAdvanceTimer(setTimeout(() => goToStep(2), 500))
    } else if (stepIdx === 2 && snapshot.selCount >= 2) {
      setAdvanceTimer(setTimeout(() => goToStep(3), 500))
    } else if (stepIdx === 3 && snapshot.stepsCount >= 1) {
      setAdvanceTimer(setTimeout(() => goToStep(4), 600))
    }
  }, [started, stepIdx, goToStep, markCompleted])

  // Cleanup timers on unmount
  useEffect(() => () => {
    if (advanceTimer) clearTimeout(advanceTimer)
  }, [advanceTimer])

  return (
    <div className="h-screen flex flex-col bg-bg relative overflow-hidden">
      {/* Header */}
      <header className="relative w-full h-[60px] px-6 md:px-10 flex items-center justify-between bg-bg-card/85 backdrop-blur-md border-b border-border z-20 shrink-0">
        <Link to="/" className="shrink-0 hover:opacity-80 transition-opacity">
          <img src={logoFull} alt="Praxis" className="h-7 object-contain" />
        </Link>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-[11px] font-bold">
            Interactive Tutorial
          </span>
          <button
            className="h-9 px-3 rounded-lg flex items-center justify-center text-[13px] font-bold text-text-2 bg-bg hover:bg-border hover:text-text-1 transition-all"
            onClick={handleSkip}
          >
            Skip
          </button>
        </div>
      </header>

      {/* Body: workspace + instruction panel — stacked on phones/tablets,
          side-by-side on large screens */}
      <main className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3 p-2 sm:p-4">
        <div className="flex-1 min-w-0 min-h-[45vh] lg:min-h-0">
          <PracticeWorkspace
            key={TUTORIAL_PUZZLE.expr}
            puzzle={TUTORIAL_PUZZLE}
            onStateChange={handleStateChange}
            onExit={() => navigate('/')}
            exitLabel="Home"
            title="Tutorial Problem"
            subtitle="Simplify: x + xy"
            guidePaths={stepIdx === 1 ? ['R.0'] : stepIdx === 2 ? ['R.1'] : []}
            highlightLaw={stepIdx === 3 ? 'absorption' : null}
          />
        </div>

        {/* Instruction panel */}
        <aside className="w-full lg:w-[340px] shrink-0 bg-white border border-border rounded-xl shadow-sm flex flex-col overflow-hidden max-h-[42vh] lg:max-h-none">
          {/* Progress bar */}
          <div className="h-1.5 bg-border shrink-0">
            <div
              className="h-full bg-teal transition-all duration-500"
              style={{ width: `${(stepIdx / (STEPS.length - 1)) * 100}%` }}
            />
          </div>

          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
            <div className="text-[10px] font-bold tracking-[1px] uppercase text-text-3">
              Step {stepIdx + 1} of {STEPS.length}
            </div>

            <div className="w-12 h-12 rounded-xl bg-teal-light border border-teal/30 flex items-center justify-center text-2xl">
              {step.icon}
            </div>

            <h2 className="text-xl font-extrabold text-text-1 tracking-tight">{step.title}</h2>
            <p className="text-sm text-text-2 leading-relaxed">{step.text}</p>

            {/* Mini expression reference for the selection steps */}
            {stepIdx >= 1 && stepIdx <= 3 && (
              <div className="bg-bg border border-border rounded-xl px-4 py-3 font-mono text-sm text-text-1">
                F ={' '}
                <span className={stepIdx === 1 ? 'text-teal font-bold animate-pulse' : stepIdx > 1 ? 'text-teal font-bold' : ''}>x</span> +{' '}
                <span className={stepIdx === 2 ? 'text-teal font-bold animate-pulse' : stepIdx > 2 ? 'text-teal font-bold' : ''}>xy</span>
                <div className="font-sans text-[11px] text-text-3 mt-1.5">Goal: x</div>
              </div>
            )}

            {/* Current action checklist */}
            {stepIdx >= 1 && stepIdx <= 9 && (
              <ul className="flex flex-col gap-1.5 text-xs font-semibold">
                <li className={`flex items-center gap-2 ${stepIdx >= 2 ? 'text-green line-through opacity-60' : 'text-text-1'}`}>
                  {stepIdx >= 2 ? '✓' : '①'} Select the term x
                </li>
                <li className={`flex items-center gap-2 ${stepIdx >= 3 ? 'text-green line-through opacity-60' : 'text-text-1'}`}>
                  {stepIdx >= 3 ? '✓' : '②'} Select the term xy
                </li>
                <li className={`flex items-center gap-2 ${stepIdx >= 4 ? 'text-green line-through opacity-60' : 'text-text-1'}`}>
                  {stepIdx >= 4 ? '✓' : '③'} Apply Absorption Law
                </li>
                <li className={`flex items-center gap-2 ${stepIdx >= 5 ? 'text-green line-through opacity-60' : 'text-text-1'}`}>
                  {stepIdx >= 5 ? '✓' : '④'} Reach the goal x
                </li>
                <li className={`flex items-center gap-2 ${stepIdx >= 7 ? 'text-green line-through opacity-60' : stepIdx === 6 ? 'text-teal font-bold' : 'text-text-1'}`}>
                  {stepIdx >= 7 ? '✓' : '⑤'} Undo your move
                </li>
                <li className={`flex items-center gap-2 ${stepIdx >= 8 ? 'text-green line-through opacity-60' : stepIdx === 7 ? 'text-teal font-bold' : 'text-text-1'}`}>
                  {stepIdx >= 8 ? '✓' : '⑥'} Use the Hint button
                </li>
                <li className={`flex items-center gap-2 ${stepIdx >= 9 ? 'text-green line-through opacity-60' : stepIdx === 8 ? 'text-teal font-bold' : 'text-text-1'}`}>
                  {stepIdx >= 9 ? '✓' : '⑦'} Reset the problem
                </li>
                <li className={`flex items-center gap-2 ${stepIdx >= 10 ? 'text-green line-through opacity-60' : stepIdx === 9 ? 'text-teal font-bold' : 'text-text-1'}`}>
                  {stepIdx >= 10 ? '✓' : '⑧'} Solve it again by yourself
                </li>
              </ul>
            )}
          </div>

          {/* Panel actions */}
          <div className="p-4 border-t border-border shrink-0 flex flex-col gap-2">
            {step.action === 'start' && (
              <button
                className="w-full py-3 bg-accent text-white rounded-xl font-bold text-sm shadow-sm hover:bg-text-1 transition-all"
                onClick={handleStart}
              >
                Start the tutorial →
              </button>
            )}
            {step.action === 'done' && (
              <div className="flex flex-col gap-2">
                <button
                  className="w-full py-3 bg-accent text-white rounded-xl font-bold text-sm shadow-sm hover:bg-text-1 transition-all"
                  onClick={() => navigate('/levels')}
                >
                  Go to Levels →
                </button>
                <button
                  className="w-full py-2 text-text-3 text-xs font-semibold hover:text-text-1 transition-all"
                  onClick={() => { setStarted(false); goToStep(0) }}
                >
                  ↺ Replay tutorial
                </button>
              </div>
            )}
            {step.action === 'next' && (
              <button
                className="w-full py-3 bg-accent text-white rounded-xl font-bold text-sm shadow-sm hover:bg-text-1 transition-all"
                onClick={() => goToStep(stepIdx + 1)}
              >
                Next →
              </button>
            )}
            {(step.action === 'wait-sel-1' || step.action === 'wait-sel-2' || step.action === 'wait-step' || step.action === 'wait-complete' || step.action === 'wait-undo' || step.action === 'wait-hint' || step.action === 'wait-reset') && (
              <div className="flex items-center justify-center gap-2 text-xs text-text-3 font-semibold py-1">
                <span className="w-2 h-2 rounded-full bg-teal animate-pulse" />
                Waiting for your move…
              </div>
            )}
          </div>
        </aside>
      </main>
    </div>
  )
}
