import { useState, useEffect, useRef, useCallback } from 'react'
import { useApi } from './useApi'

const STORAGE_KEY = 'praxis_v1'

const defaultProgress = {
  points: 0,
  streak: 0,
  bestStreak: 0,
  levelsCompleted: [],        // [1, 2, 3]
  stageProgress: {},          // { "1": [0, 1, 2] } → level 1, stages 0,1,2 done
  stageScores: {},            // { "1:0": 87.5, "1:3": 62.0 } → best total score per stage
}

export function useProgress() {
  const { loadProgress, saveProgress } = useApi()
  const [progress, setProgress] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? { ...defaultProgress, ...JSON.parse(saved) } : defaultProgress
    } catch {
      return defaultProgress
    }
  })
  const [serverLoaded, setServerLoaded] = useState(false)
  const saveTimeoutRef = useRef(null)

  // Load progress from server on mount (hydrate from server, fall back to localStorage)
  useEffect(() => {
    const hydrateFromServer = async () => {
      const serverData = await loadProgress()
      if (serverData) {
        setProgress(prev => {
          // Merge: server data takes priority, but keep any local data that's newer
          const merged = {
            ...defaultProgress,
            ...prev,
            points: Math.max(prev.points, serverData.points || 0),
            streak: serverData.streak || prev.streak,
            bestStreak: Math.max(prev.bestStreak, serverData.bestStreak || 0),
          }

          // Merge stageProgress (union of completed stages)
          const mergedStageProgress = { ...prev.stageProgress }
          for (const [key, stages] of Object.entries(serverData.stageProgress || {})) {
            const existing = mergedStageProgress[key] || []
            const combined = [...new Set([...existing, ...stages])]
            mergedStageProgress[key] = combined
          }
          merged.stageProgress = mergedStageProgress

          // Merge stageScores (take the best score)
          const mergedScores = { ...prev.stageScores }
          for (const [key, score] of Object.entries(serverData.stageScores || {})) {
            mergedScores[key] = Math.max(mergedScores[key] || 0, score)
          }
          merged.stageScores = mergedScores

          return merged
        })
      }
      setServerLoaded(true)
    }
    hydrateFromServer()
  }, [])

  // Save to localStorage on every change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
  }, [progress])

  // Debounced save to server (500ms after last change)
  useEffect(() => {
    if (!serverLoaded) return
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      saveProgress(progress)
    }, 500)
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [progress, serverLoaded])

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

  // Save a stage score — only update if new score is better than stored
  const saveScore = (levelId, stageIdx, score) =>
    setProgress(p => {
      const key = `${levelId}:${stageIdx}`
      const existing = p.stageScores[key] ?? -1
      if (score <= existing) return p
      return { ...p, stageScores: { ...p.stageScores, [key]: score } }
    })

  const resetStreak = () => setProgress(p => ({ ...p, streak: 0 }))

  const isStageCompleted = (levelId, stageIdx) =>
    (progress.stageProgress[String(levelId)] || []).includes(stageIdx)

  const isLevelCompleted = (levelId) => progress.levelsCompleted.includes(levelId)

  const getStagesCompleted = (levelId) => progress.stageProgress[String(levelId)] || []

  /**
   * Returns progress info for a given level, used for the lock gate.
   * @param {number} levelId
   * @param {number} totalStages  total number of stages in the level
   * @returns {{ completed: number, avgScore: number, allDone: boolean, unlocked: boolean }}
   */
  const getLevelProgress = (levelId, totalStages) => {
    const scores = []
    for (let i = 0; i < totalStages; i++) {
      const key = `${levelId}:${i}`
      scores.push(progress.stageScores[key] ?? null)
    }
    const completed = scores.filter(s => s !== null).length
    const avgScore = completed === 0
      ? 0
      : Math.round(scores.reduce((sum, s) => sum + (s ?? 0), 0) / totalStages)
    const allDone = completed === totalStages
    const unlocked = allDone && avgScore >= 70
    return { completed, avgScore, allDone, unlocked }
  }

  return {
    progress,
    addPoints,
    deductPoints,
    completeStage,
    completeLevel,
    resetStreak,
    saveScore,
    getLevelProgress,
    isStageCompleted,
    isLevelCompleted,
    getStagesCompleted,
  }
}
