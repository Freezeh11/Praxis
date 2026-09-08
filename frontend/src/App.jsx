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
import PracticePage from './pages/PracticePage'
import TutorialPage from './pages/TutorialPage'
import ProtectedRoute from './components/ProtectedRoute'

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          {/* Global Toast Notifications */}
          <Toaster position="top-center" richColors />

          {/* Global Survey Button */}
          <a
            href="https://docs.google.com/forms/d/1P4O0MdbQUAUGz-xNL-neMHX5ukDuLTjCq-nXpEaFdb8/viewform"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              position: 'fixed',
              bottom: '24px',
              right: '24px',
              zIndex: 9999,
              backgroundColor: '#16a34a',
              color: '#ffffff',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              textDecoration: 'none',
              boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
            }}
          >
            Take a Survey
          </a>

          <Routes>
            {/* Public routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Learning modes — sandbox, random practice and interactive tutorial */}
            <Route path="/sandbox" element={<SandboxPage />} />
            <Route path="/practice" element={<PracticePage />} />
            <Route path="/tutorial" element={<TutorialPage />} />

            {/* Protected routes — require authentication */}
            <Route path="/levels" element={<ProtectedRoute><LevelSelectPage /></ProtectedRoute>} />
            <Route path="/level/:levelId/stages" element={<ProtectedRoute><StageSelectorPage /></ProtectedRoute>} />
            <Route path="/level/:levelId/stage/:stageIdx" element={<ProtectedRoute><ProblemPage /></ProtectedRoute>} />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  )
}
