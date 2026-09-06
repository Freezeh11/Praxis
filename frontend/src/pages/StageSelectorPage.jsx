import { useState, useEffect } from 'react'
import logoFull from '../assets/logo-full.png'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { useProgress } from '../hooks/useProgress'
import ExprText from '../components/ExprText'
import { motion } from 'framer-motion'

export default function StageSelectorPage() {
  const { levelId } = useParams()
  const navigate = useNavigate()
  const { fetchLevel, laws } = useApi()
  const { progress, getStagesCompleted, getLevelProgress } = useProgress()

  const [level, setLevel] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all') // 'all' | 'sop' | 'pos'
  const [showLawsDrawer, setShowLawsDrawer] = useState(false)

  useEffect(() => {
    fetchLevel(Number(levelId))
      .then(data => { setLevel(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [levelId])

  const puzzles = level?.puzzles || []
  const completedSet = new Set(getStagesCompleted(Number(levelId)))

  // A stage is available if it's stage 0 OR the previous stage is completed
  const isAvailable = (idx) => idx === 0 || completedSet.has(idx - 1)

  const getStageStatus = (idx) => {
    if (completedSet.has(idx)) return 'completed'
    if (isAvailable(idx)) return 'available'
    return 'locked'
  }

  const handleStageClick = (idx) => {
    if (!isAvailable(idx)) return
    navigate(`/level/${levelId}/stage/${idx}`)
  }

  const currentLvl = Number(levelId)
  const nextLvl = currentLvl + 1
  const isMaxLevel = currentLvl >= 3
  const lp = getLevelProgress(currentLvl, puzzles.length)
  const pct = Math.min(100, lp.avgScore)
  const isMastered = lp.avgScore >= 70 && lp.completed === puzzles.length
  const barColor = (lp.unlocked || isMastered) ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444'

  // Partition into SOP (0..5) and POS (6..11)
  const sopPuzzles = puzzles.slice(0, 6)
  const posPuzzles = puzzles.slice(6, 12)

  const sopCompletedCount = sopPuzzles.filter((_, i) => completedSet.has(i)).length
  const posCompletedCount = posPuzzles.filter((_, i) => completedSet.has(i + 6)).length

  const renderStageCard = (puz, globalIdx) => {
    const status = getStageStatus(globalIdx)
    const isCompleted = status === 'completed'
    const isAvail = status === 'available'
    const isLocked = status === 'locked'
    const isPos = globalIdx >= 6
    const stageScore = progress.stageScores?.[`${currentLvl}:${globalIdx}`] ?? null

    return (
      <motion.button
        key={globalIdx}
        layout
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        onClick={() => handleStageClick(globalIdx)}
        disabled={isLocked}
        className={`group relative text-left rounded-2xl p-5 transition-all duration-200 flex flex-col justify-between border select-none
          ${isCompleted
            ? 'bg-white border-emerald-200/80 hover:border-emerald-400 hover:shadow-lg hover:-translate-y-0.5'
            : isAvail
              ? 'bg-white border-teal/50 ring-2 ring-teal/20 hover:border-teal hover:shadow-xl hover:-translate-y-1'
              : 'bg-slate-50/70 border-slate-200 opacity-60 cursor-not-allowed'
          }
        `}
      >
        {/* Top bar: Stage Number & Status Badge */}
        <div className="flex items-center justify-between gap-2 mb-3.5">
          <div className="flex items-center gap-2">
            <span className={`w-8 h-8 rounded-xl font-mono text-xs font-black flex items-center justify-center border shadow-xs
              ${isCompleted
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : isAvail
                  ? 'bg-teal text-white border-teal shadow-teal/20 shadow-md'
                  : 'bg-slate-100 text-slate-400 border-slate-200'
              }
            `}>
              {String(globalIdx + 1).padStart(2, '0')}
            </span>
            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border
              ${isPos
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                : 'bg-teal-light text-teal border-teal/20'
              }
            `}>
              {isPos ? 'POS' : 'SOP'}
            </span>
          </div>

          <div>
            {isCompleted && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full shadow-xs">
                <span>✓</span>
                {stageScore !== null ? `${stageScore} pts` : 'Done'}
              </span>
            )}
            {isAvail && (
              <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-teal bg-teal-50 border border-teal/30 px-2.5 py-0.5 rounded-full group-hover:bg-teal group-hover:text-white transition-colors shadow-xs">
                <span>▶</span> PLAY
              </span>
            )}
            {isLocked && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full">
                <span>🔒</span> Locked
              </span>
            )}
          </div>
        </div>

        {/* Expression Box */}
        <div className="bg-slate-50/80 group-hover:bg-white transition-colors border border-slate-100 rounded-xl p-3 mb-3.5 flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between text-[11px]">
            <span className="text-text-3 font-semibold uppercase tracking-wider text-[9px]">Initial</span>
            <span className="font-mono text-[14px] font-bold text-text-1 tracking-wide">
              <ExprText text={puz.expr} />
            </span>
          </div>
          <div className="h-[1px] bg-slate-200/60 w-full" />
          <div className="flex items-baseline justify-between text-[11px]">
            <span className="text-text-3 font-semibold uppercase tracking-wider text-[9px]">Target</span>
            <span className="font-mono text-[13px] font-extrabold text-teal">
              <ExprText text={puz.goal} />
            </span>
          </div>
        </div>

        {/* Footer Meta: Target Laws & Optimal Steps */}
        <div className="flex items-center justify-between text-[11px] pt-1">
          <div className="flex flex-wrap gap-1 items-center">
            {puz.targetLaws && puz.targetLaws.slice(0, 2).map((lawId, lIdx) => (
              <span key={lIdx} className="text-[10px] font-medium text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                {lawId.replace('-pos', '').replace('-', ' ')}
              </span>
            ))}
          </div>
          <span className="text-[10px] font-medium text-text-3 whitespace-nowrap">
            {puz.optimalSteps} {puz.optimalSteps === 1 ? 'step' : 'steps'}
          </span>
        </div>
      </motion.button>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#f8fafc] text-text-1">
      {/* Header */}
      <header className="sticky top-0 w-full h-[70px] px-8 flex items-center justify-between bg-white/80 backdrop-blur-md border-b border-border z-30 shrink-0 shadow-xs">
        <Link
          to="/levels"
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-bold text-text-2 bg-slate-100/80 hover:bg-slate-200/80 rounded-xl transition-all"
        >
          ← Levels
        </Link>
        <div className="flex items-center">
          <img src={logoFull} alt="Praxis" className="h-8 object-contain" />
        </div>
        <div className="flex items-center gap-2.5">
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-text-2 bg-slate-100/80 hover:bg-slate-200/80 transition-all"
            title="Law Reference"
            onClick={() => setShowLawsDrawer(true)}
          >
            <span>📖</span>
            <span className="hidden sm:inline">Laws Reference</span>
          </button>
        </div>
      </header>

      {loading && (
        <div className="flex-1 flex items-center justify-center p-12 text-text-3 text-sm">
          Loading stages…
        </div>
      )}

      {!loading && level && (
        <main className="flex-1 max-w-6xl w-full mx-auto px-5 py-8 flex flex-col gap-8">
          {/* Level Header & Progress Hero */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex flex-col gap-1.5 max-w-xl">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-xs font-black uppercase tracking-widest text-teal bg-teal-50 border border-teal/20 px-3 py-1 rounded-full">
                  Level {level.id}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  {level.varCount} Variables
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {level.name}
              </h1>
              <p className="text-sm text-slate-500 leading-relaxed">
                {level.desc}
              </p>
            </div>

            {/* Level Score & Unlock Metrics */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 min-w-[300px] flex flex-col gap-3.5 shadow-xs">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-700">
                  {isMaxLevel ? `Mastery Progress` : `Level ${nextLvl} Unlock`}
                </span>
                {isMaxLevel ? (
                  isMastered ? (
                    <span className="text-emerald-700 bg-emerald-100/80 px-2.5 py-0.5 rounded-full text-[11px]">🏆 Mastered</span>
                  ) : lp.completed === puzzles.length ? (
                    <span className="text-amber-700 bg-amber-100/80 px-2.5 py-0.5 rounded-full text-[11px]">✓ Completed</span>
                  ) : (
                    <span className="text-slate-500 font-semibold text-[11px]">Target: 70% avg</span>
                  )
                ) : lp.unlocked ? (
                  <span className="text-emerald-700 bg-emerald-100/80 px-2.5 py-0.5 rounded-full text-[11px]">🔓 Unlocked</span>
                ) : (
                  <span className="text-slate-500 font-semibold text-[11px]">Need 70% avg</span>
                )}
              </div>

              {/* Progress Bar with 70% Goal Marker */}
              <div className="flex flex-col gap-1.5">
                <div className="relative w-full h-3 bg-slate-200 rounded-full overflow-visible">
                  <div
                    className="h-full rounded-full transition-all duration-500 shadow-xs"
                    style={{ width: `${pct}%`, background: barColor }}
                  />
                  {/* 70% marker */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-[2.5px] h-5 bg-slate-700 rounded-full shadow-xs"
                    style={{ left: '70%' }}
                    title="70% Unlock Threshold"
                  />
                </div>
                <div className="flex justify-between items-center text-[11px] font-semibold text-slate-500">
                  <span>{lp.completed} / {puzzles.length} completed</span>
                  <span className="text-slate-700 font-bold">{lp.avgScore} / 100 avg score</span>
                </div>
              </div>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-200 pb-4">
            <div className="flex items-center gap-2 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/80">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'all'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Stages ({puzzles.length})
              </button>
              <button
                onClick={() => setActiveTab('sop')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'sop'
                    ? 'bg-white text-teal shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Sum of Products</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-50 text-teal border border-teal/20 font-mono">
                  {sopCompletedCount}/{sopPuzzles.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('pos')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'pos'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Product of Sums</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200 font-mono">
                  {posCompletedCount}/{posPuzzles.length}
                </span>
              </button>
            </div>

            <div className="text-xs text-slate-500 font-medium">
              Click any unlocked stage to begin simplifying
            </div>
          </div>

          {/* Stage Cards Content */}
          <div className="flex flex-col gap-10">
            {/* 1. Sum of Products Track */}
            {(activeTab === 'all' || activeTab === 'sop') && (
              <section className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-teal shadow-xs" />
                    <h2 className="text-lg font-extrabold text-slate-800 tracking-tight flex items-center gap-2.5">
                      Sum of Products (SOP)
                      <span className="text-xs font-bold text-slate-400 font-normal">
                        — Stages 1 to 6
                      </span>
                    </h2>
                  </div>
                  <span className="text-xs font-bold text-teal bg-teal-50 border border-teal/20 px-3 py-1 rounded-full">
                    {sopCompletedCount} / {sopPuzzles.length} Completed
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sopPuzzles.map((puz, idx) => renderStageCard(puz, idx))}
                </div>
              </section>
            )}

            {/* 2. Product of Sums Track */}
            {(activeTab === 'all' || activeTab === 'pos') && (
              <section className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-indigo-600 shadow-xs" />
                    <h2 className="text-lg font-extrabold text-slate-800 tracking-tight flex items-center gap-2.5">
                      Product of Sums (POS)
                      <span className="text-xs font-bold text-slate-400 font-normal">
                        — Stages 7 to 12
                      </span>
                    </h2>
                  </div>
                  <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-full">
                    {posCompletedCount} / {posPuzzles.length} Completed
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {posPuzzles.map((puz, idx) => renderStageCard(puz, idx + 6))}
                </div>
              </section>
            )}
          </div>
        </main>
      )}

      {/* ── LAWS DRAWER (SLIDING OVERLAY) ── */}
      <div
        className={`fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-[100] transition-opacity duration-300 ${
          showLawsDrawer ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setShowLawsDrawer(false)}
      />
      <div
        className={`fixed top-0 right-0 h-full w-[360px] bg-white shadow-2xl z-[110] flex flex-col transition-transform duration-300 ${
          showLawsDrawer ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">Laws Reference</h2>
            <p className="text-xs text-slate-500">Dual Boolean Algebra Laws</p>
          </div>
          <button
            className="w-8 h-8 rounded-full bg-white border border-slate-200 text-sm text-slate-500 flex items-center justify-center hover:bg-slate-100 transition-all"
            onClick={() => setShowLawsDrawer(false)}
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3.5">
          {laws && laws.map(law => (
            <div key={law.id} className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-left shadow-xs">
              <div className="text-[13px] font-extrabold text-slate-800 mb-1.5">{law.name}</div>
              <div className="flex flex-col gap-1.5 my-2 bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 shadow-xs">
                {law.formulas && law.formulas.map((f, idx) => (
                  <div key={idx} className="font-mono text-xs font-bold text-slate-700">
                    <ExprText text={f} />
                  </div>
                ))}
              </div>
              <div className="text-[12px] text-slate-500 leading-relaxed mt-2">{law.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
