/**
 * useGameContent — the React binding for the content and score services.
 *
 * Levels and laws are bundled (see services/contentApi.js), so `levels` and
 * `laws` are available on first render and `loading`/`error` stay false/null —
 * the shape is kept because the screens render against it. `fetchLevel` and
 * `submitScore` reach the backend through services/apiClient.js only.
 */
import { useCallback, useMemo } from 'react'

import { fetchLevel, getLaws, getLevelSummaries } from '../services/contentApi.js'
import { submitScore } from '../services/scoreApi.js'

export function useGameContent() {
  const submitScoreCallback = useCallback((submission) => submitScore(submission), [])

  return useMemo(() => ({
    levels: getLevelSummaries(),
    laws: getLaws(),
    loading: false,
    error: null,
    fetchLevel,
    submitScore: submitScoreCallback,
  }), [submitScoreCallback])
}
