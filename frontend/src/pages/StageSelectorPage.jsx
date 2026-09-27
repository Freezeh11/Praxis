import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useGameContent } from '../state/useGameContent.js'
import { useProgress } from '../state/useProgress.js'
import { usePageOverlays } from '../hooks/usePageOverlays'
import { STAR_THRESHOLDS, UNLOCK_AVERAGE_SCORE } from '../config/gameRules.js'
import AppHeader from '../components/layout/AppHeader'
import BackNav from '../components/layout/BackNav'
import PageOverlays from '../components/layout/PageOverlays'
import ExprText from '../components/ExprText'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import PointsChip from '../components/ui/PointsChip'
import ScoreGateBar from '../components/ui/ScoreGateBar'
import StarRating from '../components/ui/StarRating'

export default function StageSelectorPage() {
  const { levelId } = useParams()
  const navigate = useNavigate()
  const { fetchLevel, laws } = useGameContent()
  const { progress, getStagesCompleted, getLevelProgress, resetLevelProgress, hasSeenTutorial } = useProgress()

  const [level, setLevel] = useState(null)
  const [loading, setLoading] = useState(true)

  // Tutorial-replay prompt, laws drawer, and the placement both are measured against.
  const {
    showTutorialPrompt, dontAskTutorialAgain, setDontAskTutorialAgain, handleTutorialClick,
    handleRestartTutorial, closeTutorialPrompt, showLawsDrawer, setShowLawsDrawer, popupPlacement,
  } = usePageOverlays({ navigate, hasSeenTutorial, resetLevelProgress })

  const numLevelId = Number(levelId)

  useEffect(() => {
    fetchLevel(numLevelId)
      .then((data) => {
        setLevel(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [numLevelId, fetchLevel])

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
    navigate(`/level/${numLevelId}/stage/${idx}`)
  }

  // Level progress metrics
  const isTutorialLevel = numLevelId === 0
  const lp = getLevelProgress(numLevelId, puzzles.length || 12)
  const isMaxLevel = numLevelId >= 3
  const nextLevelId = numLevelId + 1
  const isMastered = lp.allDone && lp.avgScore >= UNLOCK_AVERAGE_SCORE

  return (
    <div className="flex flex-col min-h-screen min-h-[100dvh] bg-bg relative overflow-x-hidden selection:bg-teal selection:text-white">
      <AppHeader
        variant="stage"
        left={(
          <BackNav
            variant="levels"
            label="All Levels"
            onClick={() => navigate('/levels')}
            title="Return to Level Selection"
            testId="back-to-levels-btn"
          />
        )}
        right={(
          <div className="flex items-center gap-2 sm:gap-2.5">
            <button
              data-popup-anchor="tutorial"
              onClick={handleTutorialClick}
              className="h-8 [@media(max-height:480px)]:h-11 px-3 rounded-lg flex items-center gap-1.5 text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200 hover:bg-teal hover:text-white transition-all shadow-xs cursor-pointer"
              title="Interactive Tutorial"
            >
              <span>Tutorial</span>
            </button>
            <PointsChip variant="header" points={progress.points || 0} streak={progress.streak || 0} />
            <button
              data-popup-anchor="laws"
              className="h-8 [@media(max-height:480px)]:h-11 px-3 rounded-lg flex items-center gap-1.5 text-xs font-bold text-text-2 bg-white border border-border hover:border-text-1 hover:text-text-1 transition-all shadow-xs"
              title="Open Law Reference"
              onClick={() => setShowLawsDrawer(true)}
            >
              <span>📖</span>
              <span className="hidden sm:inline">Laws</span>
            </button>
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
          <section className="bg-bg-card border border-border rounded-3xl p-6 sm:p-7 [@media(max-height:480px)]:p-3.5 shadow-xs flex flex-col gap-5 [@media(max-height:480px)]:gap-2.5 relative overflow-hidden">
            {/* Top row: Title, Subtitle, Description + Badges */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 [@media(max-height:480px)]:gap-2.5">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-extrabold uppercase bg-accent text-white tracking-wider">
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
                    : `${level.desc}. Every Boolean theorem exists as a dual pair — practice both Sum of Products (SOP) and Product of Sums (POS).`
                  }
                </p>
                {isTutorialLevel && (
                  <div className="mt-3.5 [@media(max-height:480px)]:mt-1.5 flex items-center gap-3">
                    <button
                      data-popup-anchor="tutorial"
                      onClick={handleTutorialClick}
                      className="h-9 [@media(max-height:480px)]:h-11 px-4 rounded-xl flex items-center gap-2 text-xs font-bold text-white bg-teal hover:bg-teal-600 active:scale-[0.98] transition-all shadow-xs cursor-pointer"
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
                <div className="bg-bg rounded-2xl px-3 sm:px-4 py-2 [@media(max-height:480px)]:py-1 border border-border flex flex-col items-center justify-center text-center min-w-[76px]">
                  <span className="text-[10px] font-semibold text-text-3 uppercase tracking-wider">Stages</span>
                  <span className="text-base sm:text-lg font-extrabold text-text-1 mt-0.5">
                    {completedSet.size} <span className="text-[11px] font-semibold text-text-3">/ {puzzles.length}</span>
                  </span>
                </div>

                {/* Stars Done */}
                <div className="bg-bg rounded-2xl px-3 sm:px-4 py-2 [@media(max-height:480px)]:py-1 border border-border flex flex-col items-center justify-center text-center min-w-[76px]">
                  <span className="text-[10px] font-semibold text-text-3 uppercase tracking-wider">Stars</span>
                  <span className="text-base sm:text-lg font-extrabold text-amber-500 mt-0.5 flex items-center gap-0.5">
                    <span>★</span> {lp.totalStars} <span className="text-[11px] font-semibold text-text-3">/ {lp.maxStars}</span>
                  </span>
                </div>

                {/* Avg Score */}
                <div className="bg-bg rounded-2xl px-3 sm:px-4 py-2 [@media(max-height:480px)]:py-1 border border-border flex flex-col items-center justify-center text-center min-w-[76px]">
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
            <div className="bg-bg rounded-2xl p-4 [@media(max-height:480px)]:p-2.5 border border-border flex flex-col gap-2 [@media(max-height:480px)]:gap-1">
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
                        ✓ Tutorial Completed!
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-text-3">
                        {completedSet.size} / {puzzles.length} completed
                      </span>
                    )
                  ) : isMaxLevel ? (
                    isMastered ? (
                      <span className="text-xs font-bold text-green bg-green-light px-2.5 py-0.5 rounded-full border border-green/30">
                        🏆 Level Mastered!
                      </span>
                    ) : lp.allDone ? (
                      <span className="text-xs font-bold text-amber bg-amber-light px-2.5 py-0.5 rounded-full border border-amber/30">
                        ✓ All Done • Need 80% for Mastery
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-text-3">
                        {lp.completed} / {puzzles.length} completed
                      </span>
                    )
                  ) : lp.unlocked ? (
                    <span className="text-xs font-bold text-green bg-green-light px-2.5 py-0.5 rounded-full border border-green/30">
                      🔓 Level {nextLevelId} Unlocked!
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber/30">
                      🔒 Need 80% avg to unlock Level {nextLevelId}
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
                <motion.button
                  key={idx}
                  data-stage-card={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: idx * 0.025 }}
                  onClick={() => handleStageClick(idx)}
                  disabled={isLocked}
                  className={`relative rounded-2xl p-4 min-h-11 [@media(max-height:480px)]:p-3 border text-left flex flex-col justify-between gap-3 [@media(max-height:480px)]:gap-2 transition-all select-none ${
                    isLocked
                      ? 'bg-bg/40 border-border/70 opacity-45 cursor-not-allowed'
                      : isCompleted
                        ? 'bg-white border-border hover:border-teal hover:shadow-md hover:-translate-y-0.5 cursor-pointer group'
                        : 'bg-white border-amber/50 hover:border-amber hover:shadow-md hover:-translate-y-0.5 ring-2 ring-amber/20 cursor-pointer group'
                  }`}
                >
                  {/* Card Top: Stage Number + Stars */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-mono font-extrabold border ${
                          isCompleted
                            ? 'bg-green-light text-green border-green/40'
                            : isCurrent
                              ? 'bg-accent text-white border-accent'
                              : 'bg-bg text-text-3 border-border'
                        }`}
                      >
                        {isCompleted ? '✓' : idx + 1}
                      </span>
                      <span className="text-xs font-bold text-text-1">
                        Stage {idx + 1}
                      </span>
                    </div>

                    <StarRating stars={stars} />
                  </div>

                  {/* Card Middle: Expression Box */}
                  <div className="bg-bg/80 rounded-xl p-3 border border-border/80 flex flex-col gap-1 text-center">
                    <div className="font-mono text-base font-bold text-text-1 truncate py-1">
                      <ExprText text={puz?.expr} />
                    </div>
                  </div>

                  {/* Card Bottom: Score or Action Button */}
                  <div className="flex items-center justify-between pt-1 border-t border-border/60">
                    {isCompleted && score !== null ? (
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                          score >= 80
                            ? 'bg-green-light text-green border-green/30'
                            : score >= 50
                              ? 'bg-amber-light text-amber border-amber/30'
                              : 'bg-red-50 text-red-600 border-red-200'
                        }`}
                      >
                        {score} pts
                      </span>
                    ) : isCurrent ? (
                      <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber/30">
                        ● Available
                      </span>
                    ) : (
                      <span className="text-[11px] text-text-3 font-semibold px-1">
                        Locked
                      </span>
                    )}

                    {isLocked ? (
                      <span className="text-xs font-semibold text-text-3">🔒</span>
                    ) : isCompleted ? (
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200 group-hover:bg-teal group-hover:text-white transition-all shadow-2xs flex items-center gap-1">
                        Review →
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-lg text-xs font-extrabold text-white bg-accent group-hover:bg-slate-800 shadow-xs transition-all flex items-center gap-1">
                        Play →
                      </span>
                    )}
                  </div>
                </motion.button>
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
