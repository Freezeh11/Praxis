import { useState, useEffect } from 'react'
import { supabase } from '../utils/supabase'

let cachedLevels = null
let cachedLaws = null
let fetchAllPromise = null
const levelCache = new Map()
const levelRequestCache = new Map()

export function useApi() {
  const [levels, setLevels] = useState(cachedLevels || [])
  const [laws, setLaws] = useState(cachedLaws || [])
  const [loading, setLoading] = useState(!cachedLevels || !cachedLaws)
  const [error, setError] = useState(null)

  const getAuthHeaders = async (baseHeaders = {}) => {
    const { data } = await supabase.auth.getSession()
    const token = data?.session?.access_token
    return token 
      ? { ...baseHeaders, 'Authorization': `Bearer ${token}` } 
      : baseHeaders
  }

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

  const fetchLevel = async (levelId) => {
    if (levelCache.has(levelId)) {
      return levelCache.get(levelId)
    }

    if (!levelRequestCache.has(levelId)) {
      levelRequestCache.set(levelId, (async () => {
        const res = await fetch(`/api/levels/${levelId}`)
        if (!res.ok) throw new Error(`Level ${levelId} not found`)
        const data = await res.json()
        levelCache.set(levelId, data)
        levelRequestCache.delete(levelId)
        return data
      })().catch(err => {
        levelRequestCache.delete(levelId)
        throw err
      }))
    }

    return levelRequestCache.get(levelId)
  }

  const submitScore = async ({ levelId, stageIdx, stepsUsed, lawsUsed, hintsUsed }) => {
    try {
      const headers = await getAuthHeaders({ 'Content-Type': 'application/json' })
      const res = await fetch('/api/score', {
        method: 'POST',
        headers,
        body: JSON.stringify({ levelId, stageIdx, stepsUsed, lawsUsed, hintsUsed }),
      })
      if (!res.ok) return null
      return res.json()
    } catch {
      return null
    }
  }

  /** Load progress from server for the authenticated user */
  const loadProgress = async () => {
    try {
      const headers = await getAuthHeaders()
      const res = await fetch('/api/progress', { headers })
      if (!res.ok) return null
      return res.json()
    } catch {
      return null
    }
  }

  /** Save progress to server for the authenticated user */
  const saveProgress = async (progressData) => {
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
  }

  return { levels, laws, loading, error, fetchLevel, submitScore, loadProgress, saveProgress }
}
