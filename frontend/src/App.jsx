import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import LevelSelectPage from './pages/LevelSelectPage'
import StageSelectorPage from './pages/StageSelectorPage'
import ProblemPage from './pages/ProblemPage'
import ProtectedRoute from './components/ProtectedRoute'

export default function App() {
  return (
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

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
