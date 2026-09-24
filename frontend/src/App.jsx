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
import ProtectedRoute from './components/ProtectedRoute'
import TutorialGate from './components/TutorialGate'

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
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
            {/* Sandbox: same workspace as a level, driven by generated problems.
                Reached from the always-unlocked Sandbox card on /levels and
                deliberately free of route params, which is what puts
                ProblemPage into sandbox mode. Gated behind the tutorial. */}
            <Route path="/sandbox" element={<ProtectedRoute><TutorialGate><ProblemPage /></TutorialGate></ProtectedRoute>} />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  )
}
