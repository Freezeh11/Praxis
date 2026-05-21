import { useState, useEffect } from 'react'

const STORAGE_KEY = 'booleanquest_v1_points'

const defaultProgress = {
  points: 0,
  streak: 0,
  bestStreak: 0,
  levelsCompleted: [],        // [1, 2, 3]
  stageProgress: {},          // { "1": [0, 1, 2] } → level 1, stages 0,1,2 done
}

export function useProgress() {
  const [progress, setProgress] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? { ...defaultProgress, ...JSON.parse(saved) } : defaultProgress
    } catch {
      return defaultProgress
    }
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
  }, [progress])

  const addPoints = (amount) =>
    setProgress(p => ({
      ...p,
      points: p.points + amount,
      streak: p.streak + 1,
      bestStreak: Math.max(p.bestStreak, p.streak + 1),
    }))

  const deductPoints = (amount) =>
    setProgress(p => ({
      ...p,
      points: Math.max(0, p.points - amount)
    }))

  const completeStage = (levelId, stageIdx) =>
    setProgress(p => {
      const key = String(levelId)
      const existing = p.stageProgress[key] || []
      if (existing.includes(stageIdx)) return p
      return { ...p, stageProgress: { ...p.stageProgress, [key]: [...existing, stageIdx] } }
    })

  const completeLevel = (levelId) =>
    setProgress(p => ({
      ...p,
      levelsCompleted: p.levelsCompleted.includes(levelId)
        ? p.levelsCompleted
        : [...p.levelsCompleted, levelId],
    }))

  const resetStreak = () => setProgress(p => ({ ...p, streak: 0 }))

  const isStageCompleted = (levelId, stageIdx) =>
    (progress.stageProgress[String(levelId)] || []).includes(stageIdx)

  const isLevelCompleted = (levelId) => progress.levelsCompleted.includes(levelId)

  const getStagesCompleted = (levelId) => progress.stageProgress[String(levelId)] || []

  return {
    progress,
    addPoints,
    deductPoints,
    completeStage,
    completeLevel,
    resetStreak,
    isStageCompleted,
    isLevelCompleted,
    getStagesCompleted,
  }
}
