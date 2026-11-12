import Icon from '../components/ui/Icon'
import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { m } from 'framer-motion'
import { useGameContent } from '../state/useGameContent.js'
import { useProgress } from '../state/useProgress.js'
import { usePageOverlays } from '../hooks/usePageOverlays'
import { STAR_THRESHOLDS, UNLOCK_AVERAGE_SCORE } from '../config/gameRules.js'
import { playSound, primeAudio } from '../services/soundEffects.js'
import AppHeader from '../components/layout/AppHeader'
import PageOverlays from '../components/layout/PageOverlays'
import ExprText from '../components/ExprText'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import PointsChip from '../components/ui/PointsChip'
import ScoreGateBar from '../components/ui/ScoreGateBar'
import StarRating from '../components/ui/StarRating'
import SurveyButton from '../components/layout/SurveyButton'
import ProfileLink from '../components/layout/ProfileLink.jsx'
import SoundToggle from '../components/ui/SoundToggle'
import useSoundEnabled from '../hooks/useSoundEnabled'

export default function StageSelectorPage() {
  const { levelId } = useParams()
  const navigate = useNavigate()
  const { fetchLevel, laws } = useGameContent()
  const { progress, getStagesCompleted, getLevelProgress, resetLevelProgress, hasSeenTutorial, hasCompletedTutorial, progressHydrated } = useProgress()
  const { enabled: soundEnabled, toggle: toggleSound } = useSoundEnabled()

  const [level, setLevel] = useState(null)
  const [loading, setLoading] = useState(true)

  // Tutorial-replay prompt, laws drawer, and the placement both are measured against.
  const {
    showTutorialPrompt, dontAskTutorialAgain, setDontAskTutorialAgain, handleTutorialClick,
    handleRestartTutorial, closeTutorialPrompt, showLawsDrawer, setShowLawsDrawer, popupPlacement,
  } = usePageOverlays({ navigate, hasSeenTutorial, resetLevelProgress })

  const numLevelId = Number(levelId)

  useEffect(() => {
    if (numLevelId === 1 && !hasCompletedTutorial) {
      navigate('/levels', { replace: true })
    }
  }, [numLevelId, hasCompletedTutorial, navigate])

  useEffect(() => {
    // Reject unknown ids before they reach the API, and mirror the carousel's
    // gates so a typed URL cannot open a locked level.
    if (!progressHydrated) return
    if (!Number.isInteger(numLevelId) || numLevelId < 0 || numLevelId > 3) {
      navigate('/levels', { replace: true })
      return
    }
    if (numLevelId > 1 && !getLevelProgress(numLevelId - 1, 12).unlocked) {
      navigate('/levels', { replace: true })
      return
    }
    fetchLevel(numLevelId)
      .then((data) => {
        if (!data || !Array.isArray(data.puzzles) || data.puzzles.length === 0) {
          navigate('/levels', { replace: true })
          return
        }
        setLevel(data)
        setLoading(false)
      })
      .catch(() => navigate('/levels', { replace: true }))
  }, [numLevelId, fetchLevel, navigate, getLevelProgress, progressHydrated])

  const puzzles = useMemo(() => level?.puzzles || [], [level])
  const completedStages = getStagesCompleted(numLevelId)
  const completedSet = useMemo(() => new Set(completedStages), [completedStages])

  // A stage is available if it's stage 0 OR previous stage is completed
  const isAvailable = (idx) => idx === 0 || completedSet.has(idx - 1)

  const getStageStatus = (idx) => {
    if (completedSet.has(idx)) return 'completed'
    if (isAvailable(idx)) return 'available'
    return 'locked'
  }

  const getStageScore = (idx) => {
    return progress.stageScores?.[`${numLevelId}:${idx}`] ?? null
  }

  const getStageStars = (idx) => {
    const isDone = completedSet.has(idx)
    const score = getStageScore(idx)
    if (!isDone && score === null) return 0
    if (score !== null) {
      if (score >= STAR_THRESHOLDS.three) return 3
      if (score >= STAR_THRESHOLDS.two) return 2
      if (score >= STAR_THRESHOLDS.one) return 1
    }
    return isDone ? 1 : 0
  }

  const handleStageClick = (idx) => {
    if (!isAvailable(idx)) return
    // Picking a stage is the navigate action: one affirmative cue, and this
    // click is the gesture that unlocks audio for it (no puzzle has primed yet).
    primeAudio()
    playSound('enter')
    // Tutorial stages must carry ?tutorial=true or the guided overlay never
    // activates: usePuzzleSession reads the query param, not just the level id.
    const tutParam = numLevelId === 0 ? '?tutorial=true' : ''
    navigate(`/level/${numLevelId}/stage/${idx + 1}${tutParam}`)
  }

  // Level progress metrics
  const isTutorialLevel = numLevelId === 0
  const lp = getLevelProgress(numLevelId, puzzles.length || 12)
  const isMaxLevel = numLevelId >= 3
  const nextLevelId = numLevelId + 1
  const isMastered = lp.allDone && lp.avgScore >= UNLOCK_AVERAGE_SCORE

  return (
    <div className="flex flex-col min-h-screen min-h-[100dvh] bg-transparent relative overflow-x-hidden selection:bg-indigo-600 selection:text-white dark:selection:bg-cyan-500 dark:selection:text-slate-950">
      <AppHeader
        variant="stage"
        crumbs={[
          { label: 'Levels', to: '/levels', testId: 'back-to-levels-btn' },
          { label: isTutorialLevel ? 'Tutorial' : (level?.name || 'Stages') },
        ]}
        right={(
          <div className="flex items-center gap-2 sm:gap-2.5">
            <button
              data-popup-anchor="tutorial"
              onClick={handleTutorialClick}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-[13px] font-bold text-indigo-700 transition-colors hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 dark:border-indigo-400/25 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20 dark:focus-visible:ring-cyan-400/60 [@media(max-height:480px)]:h-11"
              title="Interactive Tutorial"
            >
              <span>Tutorial</span>
            </button>
            <PointsChip variant="header" points={progress.points || 0} />
            <button
              data-popup-anchor="laws"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white/80 px-3 text-[13px] font-bold text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 dark:border-white/10 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-700 dark:focus-visible:ring-cyan-400/60 [@media(max-height:480px)]:h-11"
              title="Open Law Reference"
              onClick={() => { primeAudio(); setShowLawsDrawer(true) }}
            >
              <span><Icon name="book" /></span>
              <span>Law reference</span>
            </button>
            <SoundToggle enabled={soundEnabled} onToggle={toggleSound} compact />
            <SurveyButton compact />
            <ProfileLink />
          </div>
        )}
      />

      {/* ── LOADING STATE ── */}
      {loading && (
        <div className="flex-1 flex flex-col items-center justify-center p-12 gap-3">
          <LoadingSpinner size="h-8 w-8" />
          <span className="text-sm font-semibold text-text-3">Loading stages...</span>
        </div>
      )}

      {/* ── MAIN CONTENT ── */}
      {!loading && level && (
        <main className="flex-1 max-w-5xl w-full mx-auto px-3 sm:px-6 md:px-8 pt-6 [@media(max-height:480px)]:pt-2.5 pb-12 [@media(max-height:480px)]:pb-4 flex flex-col gap-6 [@media(max-height:480px)]:gap-3">
          {/* ── LEVEL HERO BANNER ── */}
          <section className="relative overflow-hidden flex flex-col gap-5 rounded-3xl border border-slate-200/90 bg-white p-6 shadow-panel transition-colors duration-200 sm:p-7 [@media(max-height:480px)]:p-3.5 [@media(max-height:480px)]:gap-2.5 dark:border-white/10 dark:bg-slate-900/65 dark:shadow-[0_8px_32px_rgba(0,0,0,0.45)]">
            {/* Gradient hairline: the one saturated stroke on the page, so the
                hero reads as the top of a stack rather than another white box. */}
            <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-indigo-500 via-indigo-400 to-cyan-400" />
            {/* Top row: Title, Subtitle, Description + Badges */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 [@media(max-height:480px)]:gap-2.5">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-extrabold uppercase bg-accent text-on-accent tracking-wider">
                    {level.name}
                  </span>
                  <span className="text-xs font-semibold text-text-3">
                    {level.varCount}-Variable Logic
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl [@media(max-height:480px)]:text-lg font-extrabold text-text-1 tracking-tight">
                  {isTutorialLevel ? 'Tutorial Stage Overview' : 'Dual-Track Stage Matrix'}
                </h1>
                <p className="praxis-hide-short text-xs sm:text-sm text-text-3 mt-1.5 max-w-2xl leading-relaxed">
                  {isTutorialLevel
                    ? 'Guided walkthrough and orientation for core workspace mechanics, variable selections, drag-and-drop reordering, negation capsules, and efficiency challenges.'
                    : `${level.desc}. Every Boolean theorem exists as a dual pair: practice both Sum of Products (SOP) and Product of Sums (POS).`
                  }
                </p>
                {isTutorialLevel && (
                  <div className="mt-3.5 [@media(max-height:480px)]:mt-1.5 flex items-center gap-3">
                    <button
                      data-popup-anchor="tutorial"
                      onClick={handleTutorialClick}
                      className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl bg-indigo-600 bg-gradient-to-r from-indigo-600 to-cyan-700 px-4 text-[13px] font-bold text-white shadow-md shadow-indigo-500/20 transition-[transform,filter] duration-200 hover:brightness-105 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 dark:bg-indigo-600 dark:from-indigo-600 dark:to-cyan-700 dark:shadow-lg dark:shadow-indigo-500/25 dark:focus-visible:ring-cyan-400/60 [@media(max-height:480px)]:h-11"
                      title="Start or Restart Guided Interactive Tutorial"
                    >
                      <span className="text-xs">▶</span>
                      <span>Interactive Tutorial</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Stat Cards Grid */}
              <div className="grid grid-cols-3 gap-2.5 sm:gap-3 shrink-0">
                {/* Stages Done */}
                <div className="flex min-w-[76px] flex-col items-center justify-center rounded-2xl border border-slate-200/80 bg-white/70 px-3 py-2 text-center shadow-chip transition-colors duration-200 sm:px-4 [@media(max-height:480px)]:py-1 dark:border-white/10 dark:bg-slate-950/40 dark:shadow-none">
                  <span className="text-[10px] font-semibold text-text-3 uppercase tracking-wider">Stages</span>
                  <span className="text-base sm:text-lg font-extrabold text-text-1 mt-0.5">
                    {completedSet.size} <span className="text-[11px] font-semibold text-text-3">/ {puzzles.length}</span>
                  </span>
                </div>

                {/* Stars Done */}
                <div className="flex min-w-[76px] flex-col items-center justify-center rounded-2xl border border-slate-200/80 bg-white/70 px-3 py-2 text-center shadow-chip transition-colors duration-200 sm:px-4 [@media(max-height:480px)]:py-1 dark:border-white/10 dark:bg-slate-950/40 dark:shadow-none">
                  <span className="text-[10px] font-semibold text-text-3 uppercase tracking-wider">Stars</span>
                  <span className="text-base sm:text-lg font-extrabold text-amber-500 mt-0.5 flex items-center gap-0.5">
                    <span><Icon name="star" /></span> {lp.totalStars} <span className="text-[11px] font-semibold text-text-3">/ {lp.maxStars}</span>
                  </span>
                </div>

                {/* Avg Score */}
                <div className="flex min-w-[76px] flex-col items-center justify-center rounded-2xl border border-slate-200/80 bg-white/70 px-3 py-2 text-center shadow-chip transition-colors duration-200 sm:px-4 [@media(max-height:480px)]:py-1 dark:border-white/10 dark:bg-slate-950/40 dark:shadow-none">
                  <span className="text-[10px] font-semibold text-text-3 uppercase tracking-wider">Avg Score</span>
                  <span className={`text-base sm:text-lg font-extrabold mt-0.5 ${
                    lp.avgScore >= 80 ? 'text-green' : lp.avgScore >= 50 ? 'text-amber' : 'text-text-1'
                  }`}>
                    {lp.avgScore}<span className="text-[11px] font-semibold text-text-3">/100</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Target & Lock Gate Progress Bar Container */}
            <div className="flex flex-col gap-2 rounded-2xl border border-slate-200/80 bg-white/60 p-4 shadow-chip [@media(max-height:480px)]:gap-1 [@media(max-height:480px)]:p-2.5 dark:border-white/10 dark:bg-slate-950/40 dark:shadow-none">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs font-bold">
                <div className="flex items-center gap-1.5 text-text-2">
                  <span className="font-extrabold text-text-1">
                    {isTutorialLevel ? 'Level 1 Unlock Gate' : isMaxLevel ? `Level ${numLevelId} Mastery` : `Level ${nextLevelId} Unlock Gate`}
                  </span>
                  <span className="praxis-hide-short text-text-3 font-normal">
                    {isTutorialLevel
                      ? '(Complete the 4 tutorial stages to master fundamentals)'
                      : `(Target: 80% Average Score across all ${puzzles.length} stages)`
                    }
                  </span>
                </div>
                <div>
                  {isTutorialLevel ? (
                    completedSet.size >= puzzles.length ? (
                      <span className="text-xs font-bold text-green bg-green-light px-2.5 py-0.5 rounded-full border border-green/30">
                        <Icon name="check" /> Tutorial Completed!
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-text-3">
                        {completedSet.size} / {puzzles.length} completed
                      </span>
                    )
                  ) : isMaxLevel ? (
                    isMastered ? (
                      <span className="text-xs font-bold text-green bg-green-light px-2.5 py-0.5 rounded-full border border-green/30">
                        <Icon name="trophy" /> Level Mastered!
                      </span>
                    ) : lp.allDone ? (
                      <span className="text-xs font-bold text-amber bg-amber-light px-2.5 py-0.5 rounded-full border border-amber/30">
                        <Icon name="check" /> All Done • Need 80% for Mastery
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-text-3">
                        {lp.completed} / {puzzles.length} completed
                      </span>
                    )
                  ) : lp.unlocked ? (
                    <span className="text-xs font-bold text-green bg-green-light px-2.5 py-0.5 rounded-full border border-green/30">
                      <Icon name="unlock" /> Level {nextLevelId} Unlocked!
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber/30">
                      <Icon name="lock" /> Need 80% avg to unlock Level {nextLevelId}
                    </span>
                  )}
                </div>
              </div>

              {/* Progress bar with 80% threshold notch */}
              <ScoreGateBar
                variant="hero"
                score={lp.avgScore}
                percent={isTutorialLevel ? (puzzles.length > 0 ? (completedSet.size / puzzles.length) * 100 : 0) : Math.min(100, lp.avgScore)}
                success={isTutorialLevel || lp.unlocked || isMastered}
                notch={!isTutorialLevel}
              />

              <div className="praxis-hide-short flex justify-between items-center text-[10px] text-text-3 font-semibold px-0.5">
                <span>0%</span>
                <span className="text-text-2 font-bold">{isTutorialLevel ? 'Tutorial Progress' : '80% Unlock Threshold'}</span>
                <span>100%</span>
              </div>
            </div>
          </section>

          {/* ── STAGES GRID (4 Columns × 3 Rows) ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
            {puzzles.map((puz, idx) => {
              const status = getStageStatus(idx)
              const isLocked = status === 'locked'
              const isCompleted = status === 'completed'
              const isCurrent = status === 'available'
              const score = getStageScore(idx)
              const stars = getStageStars(idx)

              return (
                <m.button
                  key={idx}
                  data-stage-card={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: idx * 0.025 }}
                  onClick={() => handleStageClick(idx)}
                  disabled={isLocked}
                  className={`relative flex min-h-11 select-none flex-col justify-between gap-3 rounded-2xl border p-4 text-left transition-[transform,border-color,box-shadow] duration-200 [@media(max-height:480px)]:gap-2 [@media(max-height:480px)]:p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 dark:focus-visible:ring-cyan-400/60 ${
                    isLocked
                      ? 'cursor-not-allowed border-slate-200/60 bg-slate-100/40 opacity-55 dark:border-white/5 dark:bg-slate-950/30'
                      : isCompleted
                        ? 'group cursor-pointer border-slate-200/80 bg-white shadow-card hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-card-hover dark:border-white/10 dark:bg-slate-900/65 dark:hover:border-indigo-400/50'
                        : 'group cursor-pointer border-amber-300/80 bg-white ring-2 ring-amber-300/30 shadow-[0_2px_4px_rgba(146,64,14,0.06),0_16px_32px_-22px_rgba(180,83,9,0.55)] hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-[0_2px_4px_rgba(146,64,14,0.08),0_20px_38px_-20px_rgba(180,83,9,0.60)] dark:border-amber-400/40 dark:bg-slate-900/70 dark:ring-amber-400/20'
                  }`}
                >
                  {/* Card Top: Stage Number + Stars */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-mono font-extrabold border ${
                          isCompleted
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
                            : isCurrent
                              ? 'border-indigo-600 bg-indigo-600 text-white dark:border-cyan-400 dark:bg-cyan-500 dark:text-slate-950'
                              : 'border-slate-200 bg-slate-100 text-slate-500 dark:border-white/10 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {isCompleted ? <Icon name="check" /> : idx + 1}
                      </span>
                      <span className="text-xs font-bold text-text-1">
                        Stage {idx + 1}
                      </span>
                    </div>

                    <StarRating stars={stars} />
                  </div>

                  {/* Card Middle: Expression Box */}
                  <div className="flex flex-col gap-1 rounded-xl border border-slate-200/80 bg-white/70 p-3 text-center shadow-inset-soft dark:border-white/10 dark:bg-slate-950/40">
                    <div className="font-mono text-base font-bold text-text-1 truncate py-1">
                      <ExprText text={puz?.expr} />
                    </div>
                  </div>

                  {/* Card Bottom: Score or Action Button */}
                  <div className="flex items-center justify-between border-t border-slate-200/70 pt-1 dark:border-white/10">
                    {isCompleted ? (
                      score !== null ? (
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold shadow-chip dark:shadow-none ${
                            score >= 80
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
                              : score >= 50
                                ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300'
                                : 'border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400'
                          }`}
                        >
                          {score} pts
                        </span>
                      ) : (
                        /* Tutorial stages can be completed without a stored score
                           entry; the badge must follow completion, not the score. */
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                          Completed
                        </span>
                      )
                    ) : isCurrent ? (
                      <span className="rounded-full border border-amber-300/70 bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300">
                        ● Available
                      </span>
                    ) : (
                      <span className="px-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        Locked
                      </span>
                    )}

                    {isLocked ? (
                      <span className="text-xs font-semibold text-text-3"><Icon name="lock" /></span>
                    ) : isCompleted ? (
                      <span className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 shadow-chip transition-[background-color,box-shadow] group-hover:bg-indigo-100 group-hover:shadow-sm dark:border-indigo-400/25 dark:bg-indigo-500/10 dark:text-indigo-300 dark:shadow-none dark:group-hover:bg-indigo-500/20">
                        Review →
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 bg-gradient-to-r from-indigo-600 to-cyan-700 px-3 py-1 text-xs font-extrabold text-white shadow-md shadow-indigo-600/25 ring-1 ring-inset ring-white/20 transition-[filter,box-shadow] group-hover:brightness-105 group-hover:shadow-lg group-hover:shadow-indigo-600/30 dark:bg-indigo-600 dark:from-indigo-600 dark:to-cyan-700 dark:text-white">
                        Play →
                      </span>
                    )}
                  </div>
                </m.button>
              )
            })}
          </div>


        </main>
      )}

      {/* ── OVERLAYS: TUTORIAL REPLAY PROMPT + LAWS DRAWER ── */}
      <PageOverlays
        showTutorialPrompt={showTutorialPrompt} onCloseTutorialPrompt={closeTutorialPrompt}
        dontAskTutorialAgain={dontAskTutorialAgain} onDontAskAgainChange={setDontAskTutorialAgain}
        onRestartTutorial={handleRestartTutorial} shift={popupPlacement ? popupPlacement.shift : 0}
        placement={popupPlacement} showLawsDrawer={showLawsDrawer}
        onCloseLawsDrawer={() => setShowLawsDrawer(false)} laws={laws}
      />
    </div>
  )
}
