/**
 * Game content access — levels and laws.
 *
 * The same JSON is served by GET /api/levels, /api/levels/{id} and /api/laws, so
 * the app reads the bundled copy and is usable instantly (and offline), with the
 * API kept as the fallback for ids that are not bundled.
 *
 * Caches are module-level on purpose: every component shares one fetch.
 */
import { LEVELS, LEVEL_SUMMARIES, LAWS, getLevel as findBundledLevel } from '../content/game-content.js'
import { apiRequest } from './apiClient.js'

const levelCache = new Map()
for (const level of LEVELS) {
  levelCache.set(level.id, level)
  levelCache.set(String(level.id), level)
}

const pendingLevelRequests = new Map()

/** Level metadata for the level-select screen (never blocks on the network). */
export function getLevelSummaries() {
  return LEVEL_SUMMARIES
}

/** Law reference cards (never blocks on the network). */
export function getLaws() {
  return LAWS
}

/**
 * Full level with puzzle data.
 * @param {number|string} levelId
 * @returns {Promise<object>}
 */
export async function fetchLevel(levelId) {
  const numericId = Number(levelId)
  if (levelCache.has(numericId)) return levelCache.get(numericId)
  if (levelCache.has(levelId)) return levelCache.get(levelId)

  const bundled = findBundledLevel(numericId)
  if (bundled) {
    levelCache.set(levelId, bundled)
    return bundled
  }

  if (!pendingLevelRequests.has(levelId)) {
    pendingLevelRequests.set(levelId, (async () => {
      const level = await apiRequest(`/api/levels/${levelId}`, { auth: false })
      levelCache.set(levelId, level)
      levelCache.set(numericId, level)
      pendingLevelRequests.delete(levelId)
      return level
    })().catch((error) => {
      pendingLevelRequests.delete(levelId)
      throw error
    }))
  }

  return pendingLevelRequests.get(levelId)
}
