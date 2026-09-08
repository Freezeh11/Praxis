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
    text: 'Praxis is a game about simplifying Boolean expressions using algebra laws. In the next two minutes you will solve your first real problem: simplify x + xy down to x.',
    action: 'start',
  },
  {
    id: 1,
    icon: '👆',
    title: 'Select the term x',
    text: 'Every step starts by SELECTING parts of the expression. Click the letter x in the expression on the left — it will highlight.',
    action: 'wait-sel-1',
  },
  {
    id: 2,
    icon: '✌️',
    title: 'Now select xy',
    text: 'Great! Now click the term xy. With two items selected, Praxis shows every law you can apply to them.',
    action: 'wait-sel-2',
  },
  {
    id: 3,
    icon: '⚡',
    title: 'Apply the Absorption Law',
    text: 'Look below the expression: the Absorption Law card just appeared. Click it to apply the law and simplify the expression.',
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
    icon: '🚀',
    title: "You're ready!",
    text: 'Play through the levels to learn every law, drill random problems in Practice mode, or type your own equations in the Sandbox.',
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

    // Completion: jump to the "you did it" step, then to the finale.
    // (Completion is the last snapshot the workspace emits, so schedule the
    // final advance here rather than waiting for another state change.)
    if (snapshot.isComplete) {
      if (stepIdx < 4) goToStep(4)
      if (stepIdx < 5) {
        setAdvanceTimer(setTimeout(() => {
          markCompleted()
          goToStep(5)
        }, 1500))
      }
      return
    }

    // Catch-up: user already applied a law before the tutorial expected it
    if (snapshot.stepsCount >= 1 && stepIdx < 4) {
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
          <span className="px-2.5 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-[11px] font-bold">
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

      {/* Body: workspace + instruction panel */}
      <main className="flex-1 min-h-0 flex gap-4 p-3 sm:p-4">
        <div className="flex-1 min-w-0">
          <PracticeWorkspace
            key={TUTORIAL_PUZZLE.expr}
            puzzle={TUTORIAL_PUZZLE}
            onStateChange={handleStateChange}
            onExit={() => navigate('/')}
            exitLabel="Home"
            title="Tutorial Problem"
            subtitle="Simplify: x + xy"
          />
        </div>

        {/* Instruction panel */}
        <aside className="w-[340px] shrink-0 bg-white border border-border rounded-xl shadow-sm flex flex-col overflow-hidden">
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
                F = <span className={stepIdx >= 1 ? 'text-teal font-bold' : ''}>x</span> +{' '}
                <span className={stepIdx >= 2 ? 'text-teal font-bold' : ''}>xy</span>
                <div className="font-sans text-[11px] text-text-3 mt-1.5">Goal: x</div>
              </div>
            )}

            {/* Current action checklist */}
            {stepIdx >= 1 && stepIdx <= 4 && (
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
                <div className="flex gap-2">
                  <Link
                    to="/practice"
                    className="flex-1 py-2.5 rounded-xl border-[1.5px] border-border text-text-2 font-bold text-xs hover:bg-bg transition-all text-center"
                  >
                    🎲 Practice
                  </Link>
                  <Link
                    to="/sandbox"
                    className="flex-1 py-2.5 rounded-xl border-[1.5px] border-border text-text-2 font-bold text-xs hover:bg-bg transition-all text-center"
                  >
                    🧪 Sandbox
                  </Link>
                </div>
                <button
                  className="w-full py-2 text-text-3 text-xs font-semibold hover:text-text-1 transition-all"
                  onClick={() => { setStarted(false); goToStep(0) }}
                >
                  ↺ Replay tutorial
                </button>
              </div>
            )}
            {(step.action === 'wait-sel-1' || step.action === 'wait-sel-2' || step.action === 'wait-step' || step.action === 'wait-complete') && (
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
