/**
 * @deprecated Transitional adapter — prefer services/*Api.js or state/useGameContent.js.
 *
 * Kept only while the progress hook is migrated onto the shared store; it exists
 * so the old import path keeps a valid implementation during that window.
 */
import { useCallback, useMemo } from 'react'

import { fetchLevel, getLaws, getLevelSummaries } from '../services/contentApi.js'
import { submitScore } from '../services/scoreApi.js'
import { loadProgress, saveProgress } from '../services/progressApi.js'

export function useApi() {
  const fetchLevelCallback = useCallback((levelId) => fetchLevel(levelId), [])
  const submitScoreCallback = useCallback((submission) => submitScore(submission), [])
  const loadProgressCallback = useCallback(() => loadProgress(), [])
  const saveProgressCallback = useCallback((progress) => saveProgress(progress), [])

  return useMemo(() => ({
    levels: getLevelSummaries(),
    laws: getLaws(),
    loading: false,
    error: null,
    fetchLevel: fetchLevelCallback,
    submitScore: submitScoreCallback,
    loadProgress: loadProgressCallback,
    saveProgress: saveProgressCallback,
  }), [fetchLevelCallback, submitScoreCallback, loadProgressCallback, saveProgressCallback])
}
