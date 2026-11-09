import { STAR_THRESHOLDS } from '../config/gameRules.js'

/** Count authored stages once, including older progress that has scores only. */
export function summarizeProfile(progress, levels) {
  const scores = []
  const solutions = []
  let completed = 0
  let stars = 0
  const levelProgress = levels.map(level => {
    const done = new Set(progress.stageProgress?.[level.id] || [])
    let count = 0
    level.puzzles.forEach((puzzle, stageIdx) => {
      const key = `${level.id}:${stageIdx}`
      const score = progress.stageScores?.[key]
      const hasScore = Number.isFinite(score)
      if (done.has(stageIdx) || hasScore) {
        count++
        stars += hasScore && score >= STAR_THRESHOLDS.three ? 3 : hasScore && score >= STAR_THRESHOLDS.two ? 2 : 1
      }
      if (hasScore) scores.push(score)
      const steps = progress.stageSolutions?.[key]
      if (Array.isArray(steps) && steps.length) solutions.push({ key, levelId: level.id, levelName: level.name, stageIdx, puzzle, steps, score: hasScore ? score : null })
    })
    completed += count
    return { ...level, completed: count, total: level.puzzles.length }
  })
  return { completed, stars, total: levels.reduce((sum, level) => sum + level.puzzles.length, 0), average: scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null, levelProgress, solutions }
}
