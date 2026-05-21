import { useState, useEffect } from 'react'

export function useApi() {
  const [levels, setLevels] = useState([])
  const [laws, setLaws] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [lvRes, lwRes] = await Promise.all([
          fetch('/api/levels'),
          fetch('/api/laws'),
        ])
        if (!lvRes.ok || !lwRes.ok) throw new Error('API request failed')
        const [lvData, lwData] = await Promise.all([lvRes.json(), lwRes.json()])
        setLevels(lvData)
        setLaws(lwData)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  const fetchLevel = async (levelId) => {
    const res = await fetch(`/api/levels/${levelId}`)
    if (!res.ok) throw new Error(`Level ${levelId} not found`)
    return res.json()
  }

  return { levels, laws, loading, error, fetchLevel }
}
