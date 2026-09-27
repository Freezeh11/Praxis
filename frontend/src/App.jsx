import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider } from './lib/auth-client'
import ErrorBoundary from './components/ErrorBoundary'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import LevelSelectPage from './pages/LevelSelectPage'
import StageSelectorPage from './pages/StageSelectorPage'
import ProblemPage from './pages/ProblemPage'
import SandboxPage from './pages/SandboxPage'
import ProtectedRoute from './components/ProtectedRoute'
import TutorialGate from './components/TutorialGate'
import OrientationGate from './components/OrientationGate'

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          {/* Device/orientation enforcement: phones in portrait get the
              "rotate your device" overlay, small tablets in portrait get the
              dismissible banner. Rendered globally so it also covers the
              public routes. */}
          <OrientationGate />

          {/* Global Toast Notifications */}
          <Toaster position="top-center" richColors />

          <Routes>
            {/* Public routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Protected AND tutorial-gated: a new learner must finish the
                interactive tutorial before Levels 1-3 or the Sandbox.
                The tutorial route below is intentionally outside the gate so
                the redirect target is always reachable. */}
            <Route path="/levels" element={<ProtectedRoute><TutorialGate><LevelSelectPage /></TutorialGate></ProtectedRoute>} />
            <Route path="/level/:levelId/stages" element={<ProtectedRoute><TutorialGate><StageSelectorPage /></TutorialGate></ProtectedRoute>} />
            <Route path="/level/:levelId/stage/:stageIdx" element={<ProtectedRoute><TutorialGate><ProblemPage /></TutorialGate></ProtectedRoute>} />

            {/* Sandbox entry point: the learner types their own Boolean
                expression and it is validated before it can be played.
                Gated behind the tutorial like the graded levels. */}
            <Route path="/sandbox" element={<ProtectedRoute><TutorialGate><SandboxPage /></TutorialGate></ProtectedRoute>} />
            {/* Sandbox workspace: the exact same workspace as a level, but with
                no route params — which is what puts ProblemPage into sandbox
                mode. It is driven either by the expression validated on
                /sandbox (route state, sessionStorage fallback) or by a
                generated random problem. */}
            <Route path="/sandbox/play" element={<ProtectedRoute><TutorialGate><ProblemPage /></TutorialGate></ProtectedRoute>} />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  )
}
