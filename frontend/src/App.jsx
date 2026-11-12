import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider } from './state/AuthProvider.jsx'
import ErrorBoundary from './components/ErrorBoundary'
import LogicCircuitBackdrop from './components/layout/LogicCircuitBackdrop.jsx'
import LandingPage from './pages/LandingPage'
import ProtectedRoute from './components/ProtectedRoute'
import TutorialGate from './components/TutorialGate'
import OrientationGate from './components/OrientationGate'
import LoadingSpinner from './components/ui/LoadingSpinner'

/**
 * Route-level code splitting.
 *
 * Only the landing page is part of the entry bundle: it is the page a cold
 * visitor paints, so keeping it eager avoids an extra request waterfall on the
 * first screen. Every other page — including the workspace, which carries the
 * solver/law engine — lives in its own chunk and is fetched on first
 * navigation. The route tree, paths and guards below are unchanged.
 */
/**
 * Route chunk + motion boundary in one loader.
 *
 * The framer-motion feature bundle is the single biggest async dependency a
 * page can have, so it must never be part of the entry graph: importing
 * `MotionProvider` at the top of this module pulled LazyMotion (and through it
 * the whole motion core) into the landing page's preload list. Importing it
 * here instead makes it a dependency of the page chunk, so a visitor who never
 * leaves the landing page never downloads it. Each page still gets exactly one
 * LazyMotion boundary above its own dialogs and portals.
 */
const withMotion = (loadPage) =>
  lazy(async () => {
    const [{ default: MotionProvider }, { default: Page }] = await Promise.all([
      import('./components/motion/MotionProvider.jsx'),
      loadPage(),
    ])
    function MotionRoute(props) {
      return (
        <MotionProvider>
          <Page {...props} />
        </MotionProvider>
      )
    }
    return { default: MotionRoute }
  })

const LoginPage = withMotion(() => import('./pages/LoginPage'))
const RegisterPage = withMotion(() => import('./pages/RegisterPage'))
const ForgotPasswordPage = withMotion(() => import('./pages/ForgotPasswordPage'))
const ResetPasswordPage = withMotion(() => import('./pages/ResetPasswordPage'))
const LevelSelectPage = withMotion(() => import('./pages/LevelSelectPage'))
const StageSelectorPage = withMotion(() => import('./pages/StageSelectorPage'))
const ProblemPage = withMotion(() => import('./pages/ProblemPage'))
const ProfilePage = withMotion(() => import('./pages/ProfilePage'))

/**
 * One backdrop instance for the whole app, keyed off the route so the expression
 * workspace can step its animation back without any page having to know the
 * backdrop exists. It sits above the canvas paint and below every page, which is
 * why the page roots along this route family are transparent.
 */
function RouteBackdrop() {
  const { pathname } = useLocation()
  const subtle = /^\/level\/[^/]+\/stage\//.test(pathname) || pathname.startsWith('/sandbox')
  return <LogicCircuitBackdrop subtle={subtle} />
}

/**
 * Fallback while a route chunk is in flight. Tokens only — the backdrop stays
 * visible behind it, so a chunk fetch looks like the app breathing, not a blank
 * screen. aria-live keeps the wait announceable for screen readers.
 */
function RouteFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-screen min-h-[100dvh] items-center justify-center bg-transparent"
    >
      <div className="flex flex-col items-center gap-3">
        <LoadingSpinner size="h-9 w-9" />
        <span className="text-[13px] font-medium text-text-2">Loading…</span>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
          <BrowserRouter>
            <RouteBackdrop />

            {/* Keyboard users land here first: the header rail has many controls
                on every route, so offer a way past it. The target wrapper below
                is focusable programmatically and wraps only the routed page. */}
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[200] focus:rounded-lg focus:bg-slate-900 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg dark:focus:bg-cyan-400 dark:focus:text-slate-950"
            >
              Skip to content
            </a>

            {/* Device/orientation enforcement: phones in portrait get the
                "rotate your device" overlay, small tablets in portrait get the
                dismissible banner. Rendered globally so it also covers the
                public routes. */}
            <OrientationGate />

            {/* Global Toast Notifications */}
            <Toaster position="top-center" richColors />

            <Suspense fallback={<RouteFallback />}>
              <div id="main-content" tabIndex={-1} className="flex min-h-screen min-h-[100dvh] flex-col outline-none">
              <Routes>
                {/* Public routes */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                {/* Password recovery: the email step, and the link landing page that
                    carries Supabase's short-lived recovery session. */}
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

                {/* Protected AND tutorial-gated: a new learner must finish the
                    interactive tutorial before Levels 1-3 or the Sandbox.
                    The tutorial route below is intentionally outside the gate so
                    the redirect target is always reachable. */}
                <Route path="/levels" element={<ProtectedRoute><TutorialGate><LevelSelectPage /></TutorialGate></ProtectedRoute>} />
                <Route path="/level/:levelId/stages" element={<ProtectedRoute><TutorialGate><StageSelectorPage /></TutorialGate></ProtectedRoute>} />
                <Route path="/level/:levelId/stage/:stageIdx" element={<ProtectedRoute><TutorialGate><ProblemPage /></TutorialGate></ProtectedRoute>} />

                {/* Sandbox unified play area: the learner enters expressions directly
                    in the play area's right panel, or solves random problems. */}
                <Route path="/sandbox" element={<ProtectedRoute><TutorialGate><ProblemPage /></TutorialGate></ProtectedRoute>} />
                {/* Direct sandbox play route kept for backward compatibility */}
                <Route path="/sandbox/play" element={<ProtectedRoute><TutorialGate><ProblemPage /></TutorialGate></ProtectedRoute>} />

                {/* Catch-all */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              </div>
            </Suspense>
          </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  )
}
