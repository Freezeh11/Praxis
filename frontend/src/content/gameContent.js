/**
 * Game content — the single source of truth for laws and levels.
 *
 * The data itself lives in <repo>/content/*.json and is read by BOTH this app
 * (bundled at build time) and the FastAPI backend (served by /api/laws and
 * /api/levels). Nothing here may hardcode a law or a puzzle: add it to the JSON.
 *
 * Public interface:
 *   LAWS             — law reference cards  { id, name, formulas[], desc }
 *   LEVELS           — full levels incl. puzzles
 *   LEVEL_SUMMARIES  — level metadata only (shape of GET /api/levels)
 *   getLevel(id)     — full level by numeric id, or undefined
 */
import lawsData from '@content/laws.json'
import levelsData from '@content/levels.json'

export const LAWS = lawsData

export const LEVELS = levelsData

/** Metadata projection — must stay identical to the backend's /api/levels shape. */
export const LEVEL_SUMMARIES = LEVELS.map(({ id, name, desc, varCount, puzzles }) => ({
  id,
  name,
  desc,
  varCount,
  puzzleCount: puzzles.length,
}))

export function getLevel(levelId) {
  const numericId = Number(levelId)
  return LEVELS.find((level) => level.id === numericId)
}
