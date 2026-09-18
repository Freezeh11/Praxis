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

            {/* Protected routes — require authentication */}
            <Route path="/levels" element={<ProtectedRoute><LevelSelectPage /></ProtectedRoute>} />
            <Route path="/level/:levelId/stages" element={<ProtectedRoute><StageSelectorPage /></ProtectedRoute>} />
            <Route path="/level/:levelId/stage/:stageIdx" element={<ProtectedRoute><ProblemPage /></ProtectedRoute>} />
            {/* Sandbox: same workspace as a level, driven by generated problems.
                Reached from the always-unlocked Sandbox card on /levels and
                deliberately free of route params, which is what puts
                ProblemPage into sandbox mode. */}
            <Route path="/sandbox" element={<ProtectedRoute><ProblemPage /></ProtectedRoute>} />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  )
}
