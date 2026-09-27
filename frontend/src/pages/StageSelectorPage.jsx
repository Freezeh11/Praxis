import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import logoFull from '../assets/logo-full.png'
import { useApi } from '../hooks/useApi'
import { useProgress } from '../hooks/useProgress'
import ExprText from '../components/ExprText'

// Star Rating display helper
function StarRating({ stars = 0 }) {
  return (
    <div className="flex items-center gap-0.5" title={`${stars} of 3 Stars`}>
      {[1, 2, 3].map((s) => (
        <span
          key={s}
          className={`text-sm leading-none select-none transition-all ${
            s <= stars
              ? 'text-amber-400 drop-shadow-[0_1px_2px_rgba(245,158,11,0.4)]'
              : 'text-slate-200'
          }`}
        >
          ★
        </span>
      ))}
    </div>
  )
}

/**
 * Placement helper for this screen's overlays.
 *
 * The tutorial-replay prompt used to be a plain centred dialog that covered the
 * header button which opened it on a short viewport, and the law drawer was a
 * full-height panel that hid the whole header rail. Both now measure the
 * control they belong to and stay clear of it:
 *
 *   band   → the free strip below that control (`top` + `maxHeight`)
 *   shift  → a vertical nudge that moves a centred dialog clear of it,
 *            clamped so the dialog can never be pushed off the viewport.
 */
function usePopupPlacement(anchorSelector, active) {
  const [placement, setPlacement] = useState(null)

  useEffect(() => {
    if (!active) return undefined
    let frame = null

    const measure = () => {
      const vh = window.visualViewport?.height ?? window.innerHeight
      const MARGIN = 8
      const anchorEl = document.querySelector(anchorSelector)
      const ar = anchorEl ? anchorEl.getBoundingClientRect() : null
      const anchorBottom = ar ? ar.bottom : 0

      const drawerTop = MARGIN
      // The drawer may be tall, but its left edge must stay clear of the header
      // controls, so a wide viewport gives it a column that starts after them
      // and a narrow one gives it the full width under them.
      const narrow = window.innerWidth <= 640
      const maxWidth = narrow
        ? window.innerWidth - MARGIN * 2
        : Math.max(260, window.innerWidth - Math.max(0, (document.querySelector(anchorSelector)?.getBoundingClientRect().left ?? 0) - 24))
      const aboveTrigger = Math.max(0, anchorBottom + MARGIN - drawerTop)
      const fullHeight = (vh - drawerTop - MARGIN) * 0.9
      const band = {
        top: drawerTop,
        maxHeight: Math.max(96, Math.min(fullHeight, narrow ? aboveTrigger : Math.max(aboveTrigger, fullHeight * 0.7))),
        maxWidth,
      }

      const panel = document.querySelector('[data-popup-panel="centered"]')
      let shift = 0
      if (panel) {
        const naturalH = panel.offsetHeight || 0
        const maxH = Math.max(120, vh - MARGIN * 2)
        const height = Math.min(naturalH, maxH)
        if (naturalH > 0 && anchorBottom + MARGIN > (vh - height) / 2) {
          shift = Math.min(anchorBottom + MARGIN - (vh - height) / 2, Math.max(0, vh - MARGIN - ((vh - height) / 2 + height)))
        }
      }
      publish({ band, shift })
    }

    const publish = (next) => {
      setPlacement(prev => (prev
        && Math.abs(prev.band.top - next.band.top) < 0.6
        && Math.abs(prev.band.maxHeight - next.band.maxHeight) < 0.6
        && Math.abs(prev.shift - next.shift) < 0.6
        ? prev
        : next))
    }
    const schedule = () => {
      if (frame) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }

    schedule()
    window.addEventListener('resize', schedule)
    window.addEventListener('orientationchange', schedule)
    window.visualViewport?.addEventListener('resize', schedule)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('orientationchange', schedule)
      window.visualViewport?.removeEventListener('resize', schedule)
    }
  }, [anchorSelector, active])

  return placement
}

export default function StageSelectorPage() {
  const { levelId } = useParams()
  const navigate = useNavigate()
  const { fetchLevel, laws } = useApi()
  const { progress, getStagesCompleted, getLevelProgress, getSavedSolution, resetLevelProgress, hasSeenTutorial } = useProgress()

  const [level, setLevel] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showLawsDrawer, setShowLawsDrawer] = useState(false)
  const [showTutorialPrompt, setShowTutorialPrompt] = useState(false)
  const [dontAskTutorialAgain, setDontAskTutorialAgain] = useState(false)

  // Each overlay belongs to the control that opened it, so its band/shift is
  // measured against that control.
  const popupAnchorSelector = showLawsDrawer ? '[data-popup-anchor="laws"]' : '[data-popup-anchor="tutorial"]'
  const popupPlacement = usePopupPlacement(popupAnchorSelector, showTutorialPrompt || showLawsDrawer)

  const handleTutorialClick = () => {
    const skipPrompt = sessionStorage.getItem('praxis_skip_tutorial_replay_prompt') === 'true'

    if (hasSeenTutorial && !skipPrompt) {
      setDontAskTutorialAgain(false)
      setShowTutorialPrompt(true)
    } else {
      navigate('/level/0/stage/0?tutorial=true')
    }
  }

  const handleRestartTutorial = () => {
    if (dontAskTutorialAgain) {
      sessionStorage.setItem('praxis_skip_tutorial_replay_prompt', 'true')
    }
    resetLevelProgress(0)
    setShowTutorialPrompt(false)
    navigate('/level/0/stage/0?tutorial=true')
  }

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
      if (score >= 90) return 3
      if (score >= 75) return 2
      if (score > 0) return 1
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
  const isMastered = lp.allDone && lp.avgScore >= 80

  return (
    <div className="flex flex-col min-h-screen min-h-[100dvh] bg-bg relative overflow-x-hidden selection:bg-teal selection:text-white">
      <header className="relative w-full h-[64px] [@media(max-height:480px)]:h-[52px] px-3 sm:px-6 md:px-10 flex items-center justify-between bg-bg-card/85 backdrop-blur-md border-b border-border z-20 shrink-0">
        <button
          data-testid="back-to-levels-btn"
          className="flex items-center gap-2 px-3.5 py-1.5 min-h-9 [@media(max-height:480px)]:min-h-11 text-xs sm:text-sm font-bold text-slate-800 bg-white hover:bg-slate-50 border border-slate-300 shadow-xs hover:shadow-sm rounded-xl transition-all cursor-pointer active:scale-95"
          onClick={() => navigate('/levels')}
          title="Return to Level Selection"
        >
          <span className="text-sm font-extrabold text-teal leading-none">←</span>
          <span>All Levels</span>
        </button>

        <Link to="/" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center hover:opacity-85 transition-opacity">
          <img src={logoFull} alt="Praxis" className="h-7 [@media(max-height:480px)]:h-6 object-contain" />
        </Link>

        <div className="flex items-center gap-2 sm:gap-2.5">
          <button
            data-popup-anchor="tutorial"
            onClick={handleTutorialClick}
            className="h-8 [@media(max-height:480px)]:h-11 px-3 rounded-lg flex items-center gap-1.5 text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200 hover:bg-teal hover:text-white transition-all shadow-xs cursor-pointer"
            title="Interactive Tutorial"
          >
            <span>Tutorial</span>
          </button>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-amber-50/80 border border-amber/30 rounded-full text-xs font-bold text-amber-700">
            <span>⭐ {progress.points || 0}</span>
            <span className="opacity-40">•</span>
            <span>🔥 {progress.streak || 0}</span>
          </div>
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
      </header>

      {/* ── LOADING STATE ── */}
      {loading && (
        <div className="flex-1 flex flex-col items-center justify-center p-12 gap-3">
          <svg className="animate-spin h-8 w-8 text-accent" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
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
              <div className="relative w-full h-2.5 bg-border rounded-full overflow-visible my-0.5">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: isTutorialLevel
                      ? `${puzzles.length > 0 ? (completedSet.size / puzzles.length) * 100 : 0}%`
                      : `${Math.min(100, lp.avgScore)}%`,
                    background: isTutorialLevel || lp.unlocked || isMastered ? '#22c55e' : lp.avgScore >= 50 ? '#f59e0b' : '#ef4444',
                  }}
                />
                {!isTutorialLevel && (
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-[2px] h-4 bg-text-1 rounded-full shadow-xs"
                    style={{ left: '80%' }}
                    title="80% Target Gate"
                  />
                )}
              </div>

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

      {/* ── TUTORIAL REPLAY MODAL BEFORE ENTERING LEVEL 0 ── */}
      {showTutorialPrompt && (
        <div 
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs transition-opacity"
          onClick={() => setShowTutorialPrompt(false)}
        >
          <div 
            data-popup-panel="centered"
            className="praxis-modal-panel relative bg-white rounded-3xl pt-9 pb-8 [@media(max-height:480px)]:pt-6 [@media(max-height:480px)]:pb-3 px-6 sm:px-10 max-w-[460px] w-full shadow-2xl border border-border/80 flex flex-col items-center text-center gap-5 [@media(max-height:480px)]:gap-2.5"
            style={{ transform: `translateY(${Math.round(popupPlacement ? popupPlacement.shift : 0)}px)` }}
            onClick={e => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              type="button"
              className="absolute top-2 right-2 w-11 h-11 rounded-full flex items-center justify-center text-text-3 hover:text-text-1 hover:bg-slate-100 transition-all cursor-pointer"
              onClick={() => setShowTutorialPrompt(false)}
            >
              ✕
            </button>

            <div className="flex flex-col items-center gap-2">
              <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-text-3">
                Tutorial Replay
              </span>
              <h3 className="text-xl font-extrabold text-text-1 tracking-tight">
                Restart the Walkthrough?
              </h3>
            </div>

            <p className="text-[13.5px] text-text-2 leading-relaxed max-w-[380px]">
              You've already made progress in the tutorial. Would you like to reset your derivation and experience the full guided walkthrough again?
            </p>

            {/* Don't ask again checkbox */}
            <label className="flex items-center gap-2.5 px-3 py-1 rounded-lg hover:bg-bg cursor-pointer select-none -mt-1">
              <input
                type="checkbox"
                checked={dontAskTutorialAgain}
                onChange={e => setDontAskTutorialAgain(e.target.checked)}
                className="w-4 h-4 rounded border-border text-teal focus:ring-teal cursor-pointer accent-teal"
              />
              <span className="text-xs text-text-2 font-medium">Don't ask me again for this session</span>
            </label>

            {/* Actions */}
            <div className="praxis-modal-actions flex items-center gap-3 w-full mt-1">
              <button
                type="button"
                className="flex-1 min-h-11 py-3 px-4 text-xs font-bold text-text-2 bg-slate-100 hover:bg-slate-200 hover:text-text-1 rounded-xl transition-all cursor-pointer"
                onClick={() => setShowTutorialPrompt(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="flex-1 min-h-11 py-3 px-4 text-xs font-bold text-white bg-teal hover:bg-teal-600 active:scale-[0.98] rounded-xl transition-all shadow-sm cursor-pointer"
                onClick={handleRestartTutorial}
              >
                Restart Walkthrough
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── LAWS DRAWER (SLIDING OVERLAY) ── */}
      <div
        className={`fixed inset-0 bg-accent/30 z-[100] transition-opacity duration-300 ${
          showLawsDrawer ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setShowLawsDrawer(false)}
      />
      <div
        data-testid="laws-drawer"
        className={`praxis-sheet-panel fixed right-0 max-w-[92vw] bg-white shadow-2xl z-[110] flex flex-col transition-transform duration-300 ${
          showLawsDrawer ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{
          top: `${Math.round(popupPlacement ? popupPlacement.band.top : 0)}px`,
          maxHeight: `${Math.round(popupPlacement ? popupPlacement.band.maxHeight : 0)}px`,
          width: `${Math.round(popupPlacement ? popupPlacement.band.maxWidth : 340)}px`,
          opacity: popupPlacement ? 1 : 0,
        }}
      >
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-base font-bold text-text-1">Law Reference</h2>
          <button
            data-testid="laws-close"
            className="praxis-touch-target shrink-0 rounded-full border-none bg-bg text-lg text-text-2 flex items-center justify-center hover:bg-border transition-all"
            onClick={() => setShowLawsDrawer(false)}
          >
            ✕
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 flex flex-col gap-3 praxis-safe-b">
          {laws &&
            laws.map((law) => (
              <div key={law.id} className="bg-bg border border-border rounded-xl p-3.5 text-left">
                <div className="text-[13px] font-bold text-text-1 mb-1">{law.name}</div>
                <div className="flex flex-col gap-1 my-2 bg-white border border-border rounded-lg px-3 py-2 shadow-xs">
                  {law.formulas &&
                    law.formulas.map((f, idx) => (
                      <div key={idx} className="font-mono text-xs font-semibold text-text-1">
                        {f}
                      </div>
                    ))}
                </div>
                <div className="text-[12px] text-text-3 leading-relaxed mt-2">{law.desc}</div>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
