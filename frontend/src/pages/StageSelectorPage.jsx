import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import logoFull from '../assets/logo-full.png'
import { useApi } from '../hooks/useApi'
import { useProgress } from '../hooks/useProgress'
import ExprText from '../components/ExprText'

// Star Rating display helper (subtle, clean)
function StarRating({ stars = 0 }) {
  if (stars <= 0) return null
  return (
    <div className="flex items-center gap-0.5" title={`${stars} of 3 Stars`}>
      {[1, 2, 3].map((s) => (
        <span
          key={s}
          className={`text-xs leading-none select-none ${
            s <= stars
              ? 'text-amber-400'
              : 'text-slate-200'
          }`}
        >
          ★
        </span>
      ))}
    </div>
  )
}

// Pair names for Level 1 and 2 dual pairs
const DUAL_PAIR_NAMES = {
  1: [
    'Absorption Law',
    'Idempotent & Distributive',
    'De Morgan\'s Law (OR)',
    'De Morgan\'s Law (AND)',
    'Distributive Factoring',
    'Full Synthesis Challenge',
  ],
  2: [
    '3-Variable Absorption',
    '3-Variable Distributive',
    '3-Variable De Morgan\'s',
    'Consensus & Elimination',
    'Multi-Term Factoring',
    'Mastery Synthesis',
  ],
}

export default function StageSelectorPage() {
  const { levelId } = useParams()
  const navigate = useNavigate()
  const { fetchLevel, laws } = useApi()
  const { progress, getStagesCompleted, getLevelProgress, resetLevelProgress, hasSeenTutorial } = useProgress()

  const [level, setLevel] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showLawsDrawer, setShowLawsDrawer] = useState(false)
  const [showTutorialPrompt, setShowTutorialPrompt] = useState(false)
  const [dontAskTutorialAgain, setDontAskTutorialAgain] = useState(false)

  const numLevelId = Number(levelId)

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
    const isTutLevel = numLevelId === 0
    const tutParam = isTutLevel ? '?tutorial=true' : ''
    navigate(`/level/${numLevelId}/stage/${idx}${tutParam}`)
  }

  // Level progress metrics
  const isTutorialLevel = numLevelId === 0
  const lp = getLevelProgress(numLevelId, puzzles.length || 12)
  const isMaxLevel = numLevelId >= 3
  const nextLevelId = numLevelId + 1
  const isMastered = lp.allDone && lp.avgScore >= 80
  const isDualTrack = (numLevelId === 1 || numLevelId === 2) && puzzles.length === 12

  // Group puzzles into pairs if dual track
  const dualPairs = useMemo(() => {
    if (!isDualTrack) return []
    const pairs = []
    for (let i = 0; i < puzzles.length; i += 2) {
      pairs.push({
        pairIndex: i / 2,
        title: DUAL_PAIR_NAMES[numLevelId]?.[i / 2] || `Dual Pair ${(i / 2) + 1}`,
        sop: { puzzle: puzzles[i], index: i },
        pos: { puzzle: puzzles[i + 1], index: i + 1 },
      })
    }
    return pairs
  }, [isDualTrack, puzzles, numLevelId])

  return (
    <div className="flex flex-col min-h-screen bg-bg relative overflow-x-hidden selection:bg-teal selection:text-white">
      {/* ── HEADER ── */}
      <header className="relative w-full h-[64px] px-6 md:px-10 flex items-center justify-between bg-bg-card/85 backdrop-blur-md border-b border-border z-20 shrink-0">
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-text-2 hover:text-text-1 bg-transparent hover:bg-border/60 rounded-xl transition-all cursor-pointer"
          onClick={() => navigate('/levels')}
        >
          <span>←</span>
          <span>Levels</span>
        </button>

        <Link to="/" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center hover:opacity-85 transition-opacity">
          <img src={logoFull} alt="Praxis" className="h-7 object-contain" />
        </Link>

        <div className="flex items-center gap-2.5">
          {isTutorialLevel && (
            <button
              onClick={handleTutorialClick}
              className="h-8 px-3 rounded-lg flex items-center gap-1.5 text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200 hover:bg-teal hover:text-white transition-all shadow-xs cursor-pointer"
              title="Restart Interactive Tutorial"
            >
              <span>Tutorial</span>
            </button>
          )}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-amber-50/80 border border-amber/30 rounded-full text-xs font-bold text-amber-700">
            <span>⭐ {progress.points || 0}</span>
            <span className="opacity-40">•</span>
            <span>🔥 {progress.streak || 0}</span>
          </div>
          <button
            className="h-8 px-3 rounded-lg flex items-center gap-1.5 text-xs font-bold text-text-2 bg-white border border-border hover:border-text-1 hover:text-text-1 transition-all shadow-xs cursor-pointer"
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
        <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 md:px-8 pt-8 pb-16 flex flex-col gap-8">
          
          {/* ── STREAMLINED HERO HEADER ── */}
          <section className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2 border-b border-border/70">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-extrabold uppercase bg-accent text-white tracking-wider">
                  {level.name}
                </span>
                <span className="text-xs font-semibold text-text-3">
                  {level.varCount}-Variable Logic
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-text-1 tracking-tight">
                {isTutorialLevel ? 'Tutorial Stage Overview' : isDualTrack ? 'Dual-Track Stage Matrix' : 'Stage Overview'}
              </h1>
              <p className="text-xs sm:text-sm text-text-3 mt-1 max-w-xl leading-relaxed">
                {isTutorialLevel
                  ? 'Guided walkthrough for core workspace mechanics, variable selections, drag-and-drop reordering, and efficiency challenges.'
                  : `${level.desc}. Every Boolean theorem exists as a dual pair: practice both Sum of Products (SOP) and Product of Sums (POS).`
                }
              </p>
              {isTutorialLevel && (
                <div className="mt-3.5 flex items-center gap-3">
                  <button
                    onClick={handleTutorialClick}
                    className="h-9 px-4 rounded-xl flex items-center gap-2 text-xs font-bold text-white bg-teal hover:bg-teal-600 active:scale-[0.98] transition-all shadow-xs cursor-pointer"
                    title="Start or Restart Guided Interactive Tutorial"
                  >
                    <span className="text-xs">▶</span>
                    <span>Play Interactive Tutorial</span>
                  </button>
                </div>
              )}
            </div>

            {/* Minimalist Progress Summary Pill / Box */}
            <div className="flex flex-col gap-2 shrink-0 sm:min-w-[240px]">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-text-2">
                  {completedSet.size} of {puzzles.length} completed
                </span>
                {!isTutorialLevel && lp.avgScore > 0 && (
                  <span className={`text-xs font-bold ${lp.avgScore >= 80 ? 'text-green' : 'text-amber'}`}>
                    Avg: {lp.avgScore}%
                  </span>
                )}
              </div>

              {/* Progress bar */}
              <div className="relative w-full h-2 bg-border/80 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: isTutorialLevel
                      ? `${puzzles.length > 0 ? (completedSet.size / puzzles.length) * 100 : 0}%`
                      : `${Math.min(100, (completedSet.size / puzzles.length) * 100)}%`,
                    background: isTutorialLevel || lp.unlocked || isMastered ? '#22c55e' : '#f59e0b',
                  }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-text-3 font-medium">
                <span>
                  {isTutorialLevel
                    ? (completedSet.size >= puzzles.length ? '✓ Completed' : 'In Progress')
                    : isMaxLevel
                      ? (isMastered ? '🏆 Mastered' : '80% Avg for Mastery')
                      : (lp.unlocked ? `🔓 Level ${nextLevelId} Unlocked` : `🔒 80% avg to unlock Level ${nextLevelId}`)
                  }
                </span>
                {lp.totalStars > 0 && (
                  <span className="text-amber-500 font-bold flex items-center gap-0.5">
                    <span>★</span> {lp.totalStars}/{lp.maxStars}
                  </span>
                )}
              </div>
            </div>
          </section>

          {/* ── STAGES VIEW ── */}
          {isDualTrack ? (
            /* ── DUAL TRACK ROWS (SOP vs POS Side-by-Side Pairs) ── */
            <div className="flex flex-col gap-6">
              {dualPairs.map((pair) => (
                <div key={pair.pairIndex} className="flex flex-col gap-2.5">
                  {/* Pair Header Label */}
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-text-3">
                      Pair {pair.pairIndex + 1}
                    </span>
                    <span className="text-text-3 text-xs">•</span>
                    <span className="text-xs font-semibold text-text-2">
                      {pair.title}
                    </span>
                  </div>

                  {/* Pair Cards Grid (SOP on Left, POS on Right) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    {[
                      { item: pair.sop, label: 'SOP', badge: 'Sum of Products' },
                      { item: pair.pos, label: 'POS', badge: 'Product of Sums' },
                    ].map(({ item, label }) => {
                      const idx = item.index
                      const puz = item.puzzle
                      const status = getStageStatus(idx)
                      const isLocked = status === 'locked'
                      const isCompleted = status === 'completed'
                      const isCurrent = status === 'available'
                      const score = getStageScore(idx)
                      const stars = getStageStars(idx)
                      const stageNumberStr = String(idx + 1).padStart(2, '0')

                      return (
                        <motion.button
                          key={idx}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2, delay: idx * 0.02 }}
                          onClick={() => handleStageClick(idx)}
                          disabled={isLocked}
                          className={`relative rounded-2xl p-4.5 sm:p-5 border text-left flex flex-col justify-between min-h-[130px] transition-all select-none ${
                            isLocked
                              ? 'bg-slate-50/50 border-slate-200/60 opacity-40 cursor-not-allowed'
                              : isCompleted
                                ? 'bg-white border-slate-200 hover:border-teal hover:shadow-md hover:-translate-y-0.5 cursor-pointer group'
                                : 'bg-white border-amber/50 hover:border-amber hover:shadow-md hover:-translate-y-0.5 ring-2 ring-amber/20 cursor-pointer group'
                          }`}
                        >
                          {/* Card Header: Stage Number & Status Badge */}
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-2">
                              <span className={`text-[11px] font-mono font-extrabold px-2 py-0.5 rounded-md ${
                                isCompleted
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                                  : isCurrent
                                    ? 'bg-accent/10 text-accent border border-accent/20'
                                    : 'bg-slate-100 text-slate-500'
                              }`}>
                                {stageNumberStr} · {label}
                              </span>
                            </div>

                            {/* Status or Score */}
                            <div className="flex items-center gap-1.5">
                              {isCompleted && score !== null ? (
                                <div className="flex items-center gap-1.5">
                                  <StarRating stars={stars} />
                                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/70">
                                    ✓ {score}
                                  </span>
                                </div>
                              ) : isCurrent ? (
                                <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber/30">
                                  Ready
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400">
                                  🔒
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Card Center: Hero Expression */}
                          <div className="py-3 sm:py-3.5 flex items-center justify-center text-center">
                            <div className="font-mono text-base sm:text-lg font-bold text-text-1 group-hover:text-teal transition-colors tracking-wide">
                              <ExprText text={puz?.expr} />
                            </div>
                          </div>

                          {/* Card Footer: Goal Target Info */}
                          <div className="flex items-center justify-between text-[11px] text-text-3 font-medium pt-1 border-t border-slate-100">
                            <span>Goal: <span className="font-mono font-bold text-text-2">{puz?.goal}</span></span>
                            <span className="text-[11px] text-slate-400 group-hover:text-teal transition-colors">
                              {isCompleted ? 'Review' : isCurrent ? 'Start →' : 'Locked'}
                            </span>
                          </div>
                        </motion.button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* ── STANDARD GRID (Tutorial 4 Stages or Boss Challenge) ── */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {puzzles.map((puz, idx) => {
                const status = getStageStatus(idx)
                const isLocked = status === 'locked'
                const isCompleted = status === 'completed'
                const isCurrent = status === 'available'
                const score = getStageScore(idx)
                const stars = getStageStars(idx)
                const stageNumberStr = String(idx + 1).padStart(2, '0')

                return (
                  <motion.button
                    key={idx}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: idx * 0.03 }}
                    onClick={() => handleStageClick(idx)}
                    disabled={isLocked}
                    className={`relative rounded-2xl p-5 border text-left flex flex-col justify-between min-h-[140px] transition-all select-none ${
                      isLocked
                        ? 'bg-slate-50/50 border-slate-200/60 opacity-40 cursor-not-allowed'
                        : isCompleted
                          ? 'bg-white border-slate-200 hover:border-teal hover:shadow-md hover:-translate-y-0.5 cursor-pointer group'
                          : 'bg-white border-amber/50 hover:border-amber hover:shadow-md hover:-translate-y-0.5 ring-2 ring-amber/20 cursor-pointer group'
                    }`}
                  >
                    {/* Top Row: Stage Number & Status Badge */}
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] font-mono font-extrabold px-2 py-0.5 rounded-md ${
                          isCompleted
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                            : isCurrent
                              ? 'bg-accent/10 text-accent border border-accent/20'
                              : 'bg-slate-100 text-slate-500'
                        }`}>
                          Stage {stageNumberStr}
                        </span>
                      </div>

                      {/* Status */}
                      <div className="flex items-center gap-1.5">
                        {isCompleted ? (
                          <div className="flex items-center gap-1.5">
                            {stars > 0 && <StarRating stars={stars} />}
                            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/70">
                              ✓ {score !== null ? score : 'Done'}
                            </span>
                          </div>
                        ) : isCurrent ? (
                          <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber/30">
                            Ready
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">
                            🔒
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Middle: Expression */}
                    <div className="py-4 flex items-center justify-center text-center">
                      <div className="font-mono text-lg font-bold text-text-1 group-hover:text-teal transition-colors tracking-wide">
                        <ExprText text={puz?.expr} />
                      </div>
                    </div>

                    {/* Bottom: Goal / Target */}
                    <div className="flex items-center justify-between text-[11px] text-text-3 font-medium pt-1 border-t border-slate-100">
                      <span>Goal: <span className="font-mono font-bold text-text-2">{puz?.goal}</span></span>
                      <span className="text-[11px] text-slate-400 group-hover:text-teal transition-colors">
                        {isCompleted ? 'Review' : isCurrent ? 'Start →' : 'Locked'}
                      </span>
                    </div>
                  </motion.button>
                )
              })}
            </div>
          )}

        </main>
      )}

      {/* ── TUTORIAL REPLAY MODAL BEFORE ENTERING LEVEL 0 ── */}
      {showTutorialPrompt && (
        <div 
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs transition-opacity"
          onClick={() => setShowTutorialPrompt(false)}
        >
          <div 
            className="relative bg-white rounded-3xl pt-9 pb-8 px-8 sm:px-10 max-w-[460px] w-full shadow-2xl border border-border/80 flex flex-col items-center text-center gap-5"
            onClick={e => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              type="button"
              className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-text-3 hover:text-text-1 hover:bg-slate-100 transition-all cursor-pointer"
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
              You have already made progress in the tutorial. Would you like to reset your derivation and experience the full guided walkthrough again?
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
            <div className="flex items-center gap-3 w-full mt-1">
              <button
                type="button"
                className="flex-1 py-3 px-4 text-xs font-bold text-text-2 bg-slate-100 hover:bg-slate-200 hover:text-text-1 rounded-xl transition-all cursor-pointer"
                onClick={() => setShowTutorialPrompt(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="flex-1 py-3 px-4 text-xs font-bold text-white bg-teal hover:bg-teal-600 active:scale-[0.98] rounded-xl transition-all shadow-sm cursor-pointer"
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
        className={`fixed top-0 right-0 h-full w-[340px] max-w-[90vw] bg-white shadow-2xl z-[110] flex flex-col transition-transform duration-300 ${
          showLawsDrawer ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-base font-bold text-text-1">Law Reference</h2>
          <button
            className="w-8 h-8 rounded-full border-none bg-bg text-lg text-text-2 flex items-center justify-center hover:bg-border transition-all cursor-pointer"
            onClick={() => setShowLawsDrawer(false)}
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
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
