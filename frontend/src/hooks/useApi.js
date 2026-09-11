import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../utils/supabase'
import { STATIC_LAWS, STATIC_LEVELS, STATIC_LEVEL_SUMMARIES } from '../lib/gameData'

let cachedLevels = STATIC_LEVEL_SUMMARIES
let cachedLaws = STATIC_LAWS
let fetchAllPromise = null
const levelCache = new Map()

// Prepopulate levelCache with static bundled levels for 0ms loads
for (const lv of STATIC_LEVELS) {
  levelCache.set(lv.id, lv)
  levelCache.set(String(lv.id), lv)
}

const levelRequestCache = new Map()

export function useApi() {
  const [levels, setLevels] = useState(cachedLevels || STATIC_LEVEL_SUMMARIES)
  const [laws, setLaws] = useState(cachedLaws || STATIC_LAWS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const getAuthHeaders = useCallback(async (baseHeaders = {}) => {
    const { data } = await supabase.auth.getSession()
    const token = data?.session?.access_token
    return token 
      ? { ...baseHeaders, 'Authorization': `Bearer ${token}` } 
      : baseHeaders
  }, [])

  useEffect(() => {
    if (cachedLevels && cachedLaws) {
      setLevels(cachedLevels)
      setLaws(cachedLaws)
      setLoading(false)
      return
    }

    const fetchAll = async () => {
      try {
        if (!fetchAllPromise) {
          fetchAllPromise = Promise.all([
            fetch('/api/levels'),
            fetch('/api/laws'),
          ]).then(async ([lvRes, lwRes]) => {
            if (!lvRes.ok || !lwRes.ok) throw new Error('API request failed')
            const [lvData, lwData] = await Promise.all([lvRes.json(), lwRes.json()])
            cachedLevels = lvData
            cachedLaws = lwData
            return { lvData, lwData }
          })
        }

        const { lvData, lwData } = await fetchAllPromise
        setLevels(lvData)
        setLaws(lwData)
      } catch (err) {
        setError(err.message)
        fetchAllPromise = null
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  const fetchLevel = useCallback(async (levelId) => {
    const numId = Number(levelId)
    if (levelCache.has(numId)) {
      return levelCache.get(numId)
    }
    if (levelCache.has(levelId)) {
      return levelCache.get(levelId)
    }

    if (!levelRequestCache.has(levelId)) {
      levelRequestCache.set(levelId, (async () => {
        const res = await fetch(`/api/levels/${levelId}`)
        if (!res.ok) throw new Error(`Level ${levelId} not found`)
        const data = await res.json()
        levelCache.set(levelId, data)
        levelCache.set(numId, data)
        levelRequestCache.delete(levelId)
        return data
      })().catch(err => {
        levelRequestCache.delete(levelId)
        throw err
      }))
    }

    return levelRequestCache.get(levelId)
  }, [])

  const submitScore = useCallback(async ({ levelId, stageIdx, stepsUsed, lawsUsed, hintsUsed, optimalSteps }) => {
    try {
      const headers = await getAuthHeaders({ 'Content-Type': 'application/json' })
      const res = await fetch('/api/score', {
        method: 'POST',
        headers,
        body: JSON.stringify({ levelId, stageIdx, stepsUsed, lawsUsed, hintsUsed, optimalSteps }),
      })
      if (!res.ok) return null
      return res.json()
    } catch {
      return null
    }
  }, [getAuthHeaders])

  /** Load progress from server for the authenticated user */
  const loadProgress = useCallback(async () => {
    try {
      const headers = await getAuthHeaders()
      const res = await fetch('/api/progress', { headers })
      if (!res.ok) return null
      return res.json()
    } catch {
      return null
    }
  }, [getAuthHeaders])

  /** Save progress to server for the authenticated user */
  const saveProgress = useCallback(async (progressData) => {
    try {
      const headers = await getAuthHeaders({ 'Content-Type': 'application/json' })
      const res = await fetch('/api/progress/save', {
        method: 'POST',
        headers,
        body: JSON.stringify({ progress: progressData }),
      })
      if (!res.ok) return null
      return res.json()
    } catch {
      return null
    }
  }, [getAuthHeaders])

  return { levels, laws, loading, error, fetchLevel, submitScore, loadProgress, saveProgress }
}
