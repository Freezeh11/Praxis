/**
 * useProgress — the React binding for the shared progress store.
 *
 * Every component that calls this hook observes the SAME state (see
 * state/progressStore.js). The returned shape is the one the screens have always
 * used, so this is a drop-in replacement for the old per-component hook.
 */
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'

import { useSession } from './useSession.js'
import * as store from './progressStore.js'
import { GUEST_USER_ID } from './progressStore.js'

export function useProgress() {
  const { data: session } = useSession()
  const userId = session?.user?.id || GUEST_USER_ID

  // Point the store at the signed-in learner; it hydrates from localStorage and
  // then from the server, once per user.
  useEffect(() => {
    store.setUser(userId)
  }, [userId])

  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const { progress } = snapshot

  const getSavedSolution = useCallback(
    (levelId, stageIdx) => store.getSavedSolution(progress, levelId, stageIdx),
    [progress]
  )
  const getLevelProgress = useCallback(
    (levelId, totalStages) => store.getLevelProgress(progress, levelId, totalStages),
    [progress]
  )
  const isStageCompleted = useCallback(
    (levelId, stageIdx) => store.isStageCompleted(progress, levelId, stageIdx),
    [progress]
  )
  const isLevelCompleted = useCallback(
    (levelId) => store.isLevelCompleted(progress, levelId),
    [progress]
  )
  const getStagesCompleted = useCallback(
    (levelId) => store.getStagesCompleted(progress, levelId),
    [progress]
  )

  return useMemo(() => ({
    progress,
    // actions
    addPoints: store.addPoints,
    deductPoints: store.deductPoints,
    completeStage: store.completeStage,
    completeLevel: store.completeLevel,
    resetStreak: store.resetStreak,
    saveScore: store.saveScore,
    saveSolution: store.saveSolution,
    resetLevelProgress: store.resetLevelProgress,
    markTutorialSeen: store.markTutorialSeen,
    // derived queries
    getSavedSolution,
    getLevelProgress,
    isStageCompleted,
    isLevelCompleted,
    getStagesCompleted,
    // gates
    hasSeenTutorial: store.hasSeenTutorial(progress),
    hasCompletedTutorial: store.hasCompletedTutorial(progress),
    progressHydrated: snapshot.hydrated,
  }), [
    progress,
    snapshot.hydrated,
    getSavedSolution,
    getLevelProgress,
    isStageCompleted,
    isLevelCompleted,
    getStagesCompleted,
  ])
}
