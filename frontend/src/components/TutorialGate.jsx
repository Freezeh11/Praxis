import { Navigate, useLocation, useParams } from 'react-router-dom'
import { useProgress } from '../state/useProgress.js'

/** Where a learner who has not finished the tutorial gets sent. */
const TUTORIAL_ENTRY = '/level/0/stage/0?tutorial=true'

/** Tutorial lives at level 0 (see content/levels.json). */
const TUTORIAL_LEVEL_ID = 0

/**
 * Blocks the graded levels and the Sandbox until the interactive tutorial has
 * been finished.
 *
 * New learners must complete the walkthrough first, because it is the only
 * place that teaches the two selection modes (click a term grip vs click a
 * literal), drag-to-reorder, and the negation capsules. Without it a first-time
 * user hits Level 1 with no idea how the interface reacts.
 *
 * Two details are load-bearing:
 *
 * 1. The tutorial level itself is exempt. For a learner who has not started the
 *    tutorial the redirect target IS the tutorial, so gating it would navigate
 *    to the URL already in the address bar. React Router treats that as a
 *    no-op, the Navigate renders nothing, and the user faces a blank page.
 *
 * 2. The decision waits for `progressHydrated`. Progress is seeded from
 *    localStorage and then merged with the server asynchronously, so deciding
 *    immediately would bounce a returning learner to the tutorial on every
 *    fresh device — they would appear to have lost all progress.
 *
 * Note: this is a UX gate, not a security boundary. It reads client-side
 * progress; it is not meant to stop a determined user.
 */
export default function TutorialGate({ children }) {
  const { levelId } = useParams()
  const location = useLocation()
  const { hasCompletedTutorial, progressHydrated, getStagesCompleted } = useProgress()

  // The tutorial is always reachable, in either route shape:
  //   /level/0/stage/:stageIdx  (and /level/0/stages)
  const isTutorialLevel = levelId !== undefined && Number(levelId) === TUTORIAL_LEVEL_ID

  if (isTutorialLevel) return children

  // Hold the screen until progress is fully known, so the redirect is never
  // decided on a half-loaded snapshot.
  if (!progressHydrated) return <TutorialGateLoading />

  // Level selection screen (/levels):
  // Learners can always browse the level selection screen.
  // Level 1 and Sandbox remain locked in LevelSelectPage until all 4 tutorial stages are complete.
  const isLevelSelectRoute = location.pathname === '/levels'
  if (isLevelSelectRoute) return children

  // Graded levels (1-3) and Sandbox strictly require full tutorial completion.
  if (!hasCompletedTutorial) {
    const completed = getStagesCompleted(TUTORIAL_LEVEL_ID)
    const nextIncomplete = [0, 1, 2, 3].find((idx) => !completed.includes(idx)) ?? 0
    const entry = `/level/0/stage/${nextIncomplete}?tutorial=true`
    // Carry the intended destination along, so finishing the tutorial lands the
    // learner where they were actually trying to go instead of back at /levels.
    const returnTo = `${location.pathname}${location.search}`
    const to = returnTo && returnTo !== '/' && returnTo !== entry && !returnTo.startsWith('/level/0/stage/')
      ? `${entry}&returnTo=${encodeURIComponent(returnTo)}`
      : entry
    return <Navigate to={to} replace />
  }

  return children
}

/** Minimal hold screen shown while progress hydrates (usually a blink). */
function TutorialGateLoading() {
  return (
    <div
      data-testid="tutorial-gate-loading-root"
      className="min-h-screen min-h-[100dvh] w-full bg-bg flex items-center justify-center praxis-page-x"
    >
      <div data-testid="tutorial-gate-loading" className="flex flex-col items-center gap-3 text-center">
        <svg className="animate-spin h-6 w-6 text-accent" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-sm font-medium text-text-3">Loading your progress...</span>
      </div>
    </div>
  )
}
