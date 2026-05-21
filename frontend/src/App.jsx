import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LevelSelectPage from './pages/LevelSelectPage'
import StageSelectorPage from './pages/StageSelectorPage'
import ProblemPage from './pages/ProblemPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LevelSelectPage />} />
        <Route path="/level/:levelId/stages" element={<StageSelectorPage />} />
        <Route path="/level/:levelId/stage/:stageIdx" element={<ProblemPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
