/**
 * Progress store — the single source of truth for the learner's state.
 *
 * Before this module `useProgress()` was a hook holding its own `useState`, so
 * the level screen, the stage screen, the puzzle screen and the tutorial gate
 * each had a private copy of points, streak, scores and completed stages. They
 * only agreed with each other by accident (each wrote localStorage on change,
 * none re-read it), which meant earning points on the puzzle screen did not
 * update the points chip behind it until a reload.
 *
 * The state now lives here, outside React, and every consumer subscribes to the
 * same instance:
 *
 *   getSnapshot()   current immutable snapshot (for useSyncExternalStore)
 *   subscribe(fn)   change notifications
 *   setUser(id)     switch learner: re-read localStorage, hydrate from server
 *   actions         the only way to change progress
 *   selectors       pure derivations (level progress, stars, gates)
 *
 * Persistence: localStorage on every change (fast path), plus a debounced push
 * to /api/progress/save for signed-in learners. Hydration merges rather than
 * overwrites, so a learner who played offline does not lose local progress.
 */
import { TIMING, TUTORIAL, UNLOCK_AVERAGE_SCORE, MAX_STARS_PER_STAGE, STAR_THRESHOLDS } from '../config/game-rules.js'
import { PROGRESS_KEY_PREFIX, progressKey } from '../config/storageKeys.js'
import * as progressApi from '../services/progressApi.js'

export const GUEST_USER_ID = 'guest'

const defaultProgress = {
  points: 0,
  streak: 0,
  bestStreak: 0,
  levelsCompleted: [],        // [1, 2, 3]
  stageProgress: {},          // { "1": [0, 1, 2] } → level 1, stages 0,1,2 done
  stageScores: {},            // { "1:0": 87.5 } → best total score per stage
  stageSolutions: {},         // { "1:0": [{ law, from, to }] } → saved derivation
  hasSeenTutorial: false,
}

let userId = GUEST_USER_ID
let progress = defaultProgress
let serverLoaded = false
let snapshot = { userId, progress, serverLoaded, hydrated: false }
let saveTimer = null

const listeners = new Set()

function publish() {
  snapshot = {
    userId,
    progress,
    serverLoaded,
    hydrated: serverLoaded && userId !== GUEST_USER_ID,
  }
  for (const listener of listeners) listener()
}

/** Replaces progress immutably and persists. */
function update(updater) {
  const next = updater(progress)
  if (next === progress) return
  progress = next
  persistLocal()
  scheduleServerSave()
  publish()
}

function persistLocal() {
  try {
    localStorage.setItem(progressKey(userId), JSON.stringify(progress))
  } catch {
    // Storage unavailable (private mode / quota) — progress stays in memory.
  }
}

function readLocal(id) {
  try {
    const saved = localStorage.getItem(progressKey(id))
    if (saved) return { ...defaultProgress, ...JSON.parse(saved) }
  } catch {
    // Corrupt or unavailable storage — fall back to a fresh profile.
  }
  return defaultProgress
}

function scheduleServerSave() {
  if (!serverLoaded || userId === GUEST_USER_ID) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    progressApi.saveProgress(progress)
  }, TIMING.progressSaveDebounceMs)
}

/** Merges a server snapshot into local progress without ever losing a best value. */
function mergeServerProgress(local, server) {
  const merged = {
    ...defaultProgress,
    ...local,
    points: Math.max(local.points, server.points || 0),
    streak: server.streak || local.streak,
    bestStreak: Math.max(local.bestStreak, server.bestStreak || 0),
  }

  const stageProgress = { ...local.stageProgress }
  for (const [key, stages] of Object.entries(server.stageProgress || {})) {
    stageProgress[key] = [...new Set([...(stageProgress[key] || []), ...stages])]
  }
  merged.stageProgress = stageProgress

  const stageScores = { ...local.stageScores }
  for (const [key, score] of Object.entries(server.stageScores || {})) {
    stageScores[key] = Math.max(stageScores[key] || 0, score)
  }
  merged.stageScores = stageScores

  // Local solutions win: they are the ones this device can replay offline.
  merged.stageSolutions = { ...(server.stageSolutions || {}), ...(local.stageSolutions || {}) }

  return merged
}

/* ── store API ─────────────────────────────────────────────────────────── */

export function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getSnapshot() {
  return snapshot
}

/**
 * Points the store at a learner. Called by useProgress() when the session
 * changes; safe to call repeatedly with the same id.
 */
export function setUser(nextUserId) {
  const id = nextUserId || GUEST_USER_ID
  if (id === userId) return

  userId = id
  progress = readLocal(id)
  serverLoaded = id === GUEST_USER_ID
  publish()

  if (serverLoaded) return

  progressApi.loadProgress().then((serverProgress) => {
    // A newer setUser() won the race — drop this response.
    if (userId !== id) return
    if (serverProgress) progress = mergeServerProgress(progress, serverProgress)
    serverLoaded = true
    persistLocal()
    publish()
  })
}

/* ── actions ───────────────────────────────────────────────────────────── */

export const addPoints = (amount) =>
  update((p) => ({
    ...p,
    points: p.points + amount,
    streak: p.streak + 1,
    bestStreak: Math.max(p.bestStreak, p.streak + 1),
  }))

export const deductPoints = (amount) =>
  update((p) => ({ ...p, points: Math.max(0, p.points - amount) }))

export const completeStage = (levelId, stageIdx) =>
  update((p) => {
    const key = String(levelId)
    const existing = p.stageProgress[key] || []
    const isTutorialLevel = Number(levelId) === TUTORIAL.levelId
    if (existing.includes(stageIdx)) {
      return isTutorialLevel ? { ...p, hasSeenTutorial: true } : p
    }
    return {
      ...p,
      stageProgress: { ...p.stageProgress, [key]: [...existing, stageIdx] },
      hasSeenTutorial: isTutorialLevel ? true : p.hasSeenTutorial,
    }
  })

export const completeLevel = (levelId) =>
  update((p) => ({
    ...p,
    levelsCompleted: p.levelsCompleted.includes(levelId)
      ? p.levelsCompleted
      : [...p.levelsCompleted, levelId],
  }))

/** Only a strictly better score replaces the stored one. */
export const saveScore = (levelId, stageIdx, score) =>
  update((p) => {
    const key = `${levelId}:${stageIdx}`
    const existing = p.stageScores[key] ?? -1
    if (score <= existing) return p
    return { ...p, stageScores: { ...p.stageScores, [key]: score } }
  })

export const saveSolution = (levelId, stageIdx, steps) =>
  update((p) => {
    const key = `${levelId}:${stageIdx}`
    const isTutorialLevel = Number(levelId) === TUTORIAL.levelId
    return {
      ...p,
      stageSolutions: { ...(p.stageSolutions || {}), [key]: steps },
      hasSeenTutorial: isTutorialLevel ? true : p.hasSeenTutorial,
    }
  })

export const resetStreak = () => update((p) => ({ ...p, streak: 0 }))

export const markTutorialSeen = () => update((p) => ({ ...p, hasSeenTutorial: true }))

export const resetLevelProgress = (levelId) =>
  update((p) => {
    const key = String(levelId)
    const stageProgress = { ...p.stageProgress }
    delete stageProgress[key]

    const stageScores = { ...p.stageScores }
    const stageSolutions = { ...p.stageSolutions }
    for (const scoreKey of Object.keys(stageScores)) {
      if (scoreKey.startsWith(`${levelId}:`)) delete stageScores[scoreKey]
    }
    for (const solutionKey of Object.keys(stageSolutions)) {
      if (solutionKey.startsWith(`${levelId}:`)) delete stageSolutions[solutionKey]
    }

    return {
      ...p,
      stageProgress,
      stageScores,
      stageSolutions,
      levelsCompleted: p.levelsCompleted.filter((id) => id !== levelId),
      hasSeenTutorial: Number(levelId) === TUTORIAL.levelId ? true : p.hasSeenTutorial,
    }
  })

/* ── selectors (pure; take a progress object) ──────────────────────────── */

export function getStagesCompleted(state, levelId) {
  return state.stageProgress[String(levelId)] || []
}

export function isStageCompleted(state, levelId, stageIdx) {
  return getStagesCompleted(state, levelId).includes(stageIdx)
}

export function isLevelCompleted(state, levelId) {
  return state.levelsCompleted.includes(levelId)
}

export function getSavedSolution(state, levelId, stageIdx) {
  return state.stageSolutions?.[`${levelId}:${stageIdx}`] || null
}

/** Stars a single stage score is worth. */
export function starsForScore(score) {
  if (score >= STAR_THRESHOLDS.three) return 3
  if (score >= STAR_THRESHOLDS.two) return 2
  return STAR_THRESHOLDS.one
}

/**
 * Level progress, used for the lock gate and the mastery bar.
 * @returns {{ completed:number, avgScore:number, allDone:boolean, unlocked:boolean, totalStars:number, maxStars:number }}
 */
export function getLevelProgress(state, levelId, totalStages) {
  const scores = []
  let totalStars = 0
  for (let i = 0; i < totalStages; i++) {
    const score = state.stageScores[`${levelId}:${i}`] ?? null
    scores.push(score)
    const done = isStageCompleted(state, levelId, i) || score !== null
    if (done) totalStars += score === null ? 1 : starsForScore(score)
  }
  const completed = scores.filter((score) => score !== null).length
  const avgScore = completed === 0
    ? 0
    : Math.round(scores.reduce((sum, score) => sum + (score ?? 0), 0) / totalStages)
  const allDone = completed === totalStages
  return {
    completed,
    avgScore,
    allDone,
    unlocked: allDone && avgScore >= UNLOCK_AVERAGE_SCORE,
    totalStars,
    maxStars: totalStages * MAX_STARS_PER_STAGE,
  }
}

/** True as soon as the learner has touched the tutorial (looser than the gate). */
export function hasSeenTutorial(state) {
  return Boolean(
    state.hasSeenTutorial ||
    (state.stageProgress?.[String(TUTORIAL.levelId)] || []).length > 0 ||
    Object.keys(state.stageScores || {}).some((key) => key.startsWith(`${TUTORIAL.levelId}:`)) ||
    Object.keys(state.stageSolutions || {}).some((key) => key.startsWith(`${TUTORIAL.levelId}:`))
  )
}

/**
 * Whether the whole tutorial is finished — the gate in front of levels 1-3 and
 * the sandbox. Server-synced stage completion counts, so a learner who finished
 * the tutorial on another device still passes.
 */
export function hasCompletedTutorial(state) {
  if (state.hasSeenTutorial) return true
  const completed = getStagesCompleted(state, TUTORIAL.levelId)
  return TUTORIAL.stageIndexes.every((idx) => completed.includes(idx))
}

/** True once the server round-trip has settled for a signed-in learner. */
export function isHydrated(state) {
  return state.serverLoaded && state.userId !== GUEST_USER_ID
}

export { PROGRESS_KEY_PREFIX }
