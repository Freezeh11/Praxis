import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { useProgress } from '../hooks/useProgress'

// Level 3+ are permanently "coming soon" (no puzzles yet)
const COMING_SOON = [3]

export default function LevelSelectPage() {
  const navigate = useNavigate()
  const { levels, loading, error } = useApi()
  const { progress, isLevelCompleted, getLevelProgress } = useProgress()
  const [selected, setSelected] = useState(0) // index into levels array

  /**
   * A level is locked if it's "coming soon" OR it requires a prerequisite
   * that hasn't been satisfied yet.
   * Level 2 requires Level 1 avg score >= 70% across all 6 stages.
   */
  const getLockState = (lv) => {
    if (!lv) return { locked: true, reason: '' }
    if (COMING_SOON.includes(lv.id)) return { locked: true, reason: 'Coming Soon' }

    if (lv.id === 2) {
      // Find Level 1 in the levels array to get its stage count
      const lvl1 = levels.find(l => l.id === 1)
      const totalStages = lvl1?.puzzles?.length ?? 6
      const p = getLevelProgress(1, totalStages)
      if (p.unlocked) return { locked: false, reason: '' }
      return {
        locked: true,
        reason: 'score-gate',
        progress: p,
        totalStages,
      }
    }

    return { locked: false, reason: '' }
  }

  const handleStart = () => {
    const lv = levels[selected]
    if (!lv) return
    const { locked } = getLockState(lv)
    if (locked) return
    navigate(`/level/${lv.id}/stages`)
  }

  const prev = () => setSelected(s => Math.max(0, s - 1))
  const next = () => setSelected(s => Math.min((levels.length || 1) - 1, s + 1))

  return (
    <div className="min-h-screen bg-bg flex flex-col relative overflow-hidden bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] bg-[size:32px_32px]">
      {/* Header */}
      <header className="w-full h-[72px] px-8 flex items-center justify-between bg-bg-card/70 backdrop-blur-md border-b-2 border-border z-10 shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 bg-accent text-white rounded-md flex items-center justify-center font-bold text-lg">⊕</span>
          <span className="font-bold text-[19px] tracking-tight text-accent">Praxis</span>
        </div>
        <div className="flex items-center gap-3">
          <button className="w-9 h-9 rounded-full flex items-center justify-center text-lg text-text-2 bg-transparent hover:bg-border transition-all" title="Law Reference">📖</button>
          <button className="w-9 h-9 rounded-full flex items-center justify-center text-lg text-text-2 bg-transparent hover:bg-border transition-all" title="Progress">◈</button>
          <button className="w-9 h-9 rounded-full flex items-center justify-center text-lg text-text-2 bg-transparent hover:bg-border transition-all" title="Settings">⚙</button>
        </div>
      </header>

      {/* Title */}
      <div className="mt-10 flex flex-col items-center gap-1.5">
        <h1 className="font-bold text-[32px] tracking-tight text-accent">Choose Your Level</h1>
        <p className="text-[15px] text-text-3 font-medium">Each level introduces more variables and complexity</p>
      </div>

      {/* Carousel */}
      <div className="flex items-center justify-center gap-8 mt-10 flex-1">
        <button className="w-10 h-10 rounded-full border-[1.5px] border-border bg-white flex items-center justify-center text-[22px] text-text-2 shadow-sm transition-all shrink-0 hover:not:disabled:border-text-1 hover:not:disabled:text-text-1 hover:not:disabled:shadow-md disabled:opacity-30 disabled:cursor-not-allowed" onClick={prev} disabled={selected === 0}>
          <span>‹</span>
        </button>

        <div className="flex items-center justify-center gap-5 [perspective:1000px]">
          {loading && <div className="text-text-2 font-medium">Loading levels…</div>}
          {error && <div className="text-red font-bold">⚠ Could not connect to server</div>}
          {!loading && !error && levels.map((lv, i) => {
            const offset = i - selected
            const lockState = getLockState(lv)
            const { locked } = lockState
            const done = isLevelCompleted(lv.id)
            const isActive = offset === 0
            const isComingSoon = COMING_SOON.includes(lv.id)
            const isScoreGated = lockState.reason === 'score-gate'

            return (
              <div
                key={lv.id}
                className={`w-[240px] bg-bg-card rounded-[20px] px-7 py-9 flex flex-col items-center gap-2.5 transition-all duration-250 ease-out select-none
                  ${isActive ? 'border-[2.5px] border-text-1 scale-100 translate-y-0 opacity-100 shadow-md' : 'border-[1.5px] border-border scale-[0.92] translate-y-1 opacity-70 shadow-sm'}
                  ${locked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  ${!locked && !isActive ? 'hover:opacity-90 hover:scale-95 hover:translate-y-0.5' : ''}
                `}
                onClick={() => !locked && setSelected(i)}
              >
                {/* Icon */}
                <div className={`w-16 h-16 rounded-[14px] border-[1.5px] flex items-center justify-center font-extrabold transition-all
                  ${isActive ? 'bg-text-1 text-white border-text-1 text-[28px]' : 'border-border text-[26px]'}
                  ${done && !isActive ? 'bg-green-light text-green' : ''}
                  ${locked ? 'bg-bg text-text-3' : (!isActive && !done ? 'bg-bg text-text-2' : '')}
                `}>
                  {isComingSoon ? '🔒' : locked ? '🔒' : done ? '✓' : lv.id}
                </div>

                <div className={`font-bold text-text-1 tracking-[-0.3px] ${isActive ? 'text-[19px]' : 'text-[17px]'}`}>{lv.name}</div>
                <div className="text-[13px] text-text-3 text-center">{lv.desc}</div>

                {/* Score gate progress for Level 2 */}
                {isScoreGated && isActive && lockState.progress && (
                  <div className="w-full mt-2 flex flex-col gap-1.5">
                    <div className="flex justify-between text-[11px] font-semibold text-text-2">
                      <span>{lockState.progress.completed}/{lockState.totalStages} stages</span>
                      <span>{lockState.progress.avgScore}/100 avg</span>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full h-2 bg-bg rounded-full overflow-hidden border border-border">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, lockState.progress.avgScore)}%`,
                          background: lockState.progress.avgScore >= 70
                            ? '#22c55e'
                            : lockState.progress.avgScore >= 40
                              ? '#f59e0b'
                              : '#ef4444',
                        }}
                      />
                    </div>
                    {/* Threshold marker label */}
                    <div className="text-[10px] text-text-3 text-center font-medium">
                      Need 70% avg across all Level 1 stages
                    </div>
                  </div>
                )}

                {/* Tags */}
                {isComingSoon && (
                  <div className="text-[11px] text-text-3 bg-bg px-2.5 py-[3px] rounded-full border border-border font-medium mt-auto">Coming Soon</div>
                )}
                {isScoreGated && !isActive && (
                  <div className="text-[11px] text-text-3 bg-bg px-2.5 py-[3px] rounded-full border border-border font-medium mt-auto">🔒 70% avg required</div>
                )}
              </div>
            )
          })}
        </div>

        <button className="w-10 h-10 rounded-full border-[1.5px] border-border bg-white flex items-center justify-center text-[22px] text-text-2 shadow-sm transition-all shrink-0 hover:not:disabled:border-text-1 hover:not:disabled:text-text-1 hover:not:disabled:shadow-md disabled:opacity-30 disabled:cursor-not-allowed" onClick={next} disabled={selected === levels.length - 1}>
          <span>›</span>
        </button>
      </div>

      {/* XP bar */}
      <div className="flex justify-center gap-4 mb-5">
        <span className="bg-bg-card border-[1.5px] border-border rounded-full px-4 py-1.5 text-sm font-bold text-text-1 shadow-sm flex items-center gap-1.5">⭐ {progress.points || 0} Points</span>
        <span className="bg-bg-card border-[1.5px] border-border rounded-full px-4 py-1.5 text-sm font-bold text-text-1 shadow-sm flex items-center gap-1.5">🔥 {progress.streak} streak</span>
      </div>

      {/* Start button */}
      <div className="flex justify-center pb-16">
        <button
          id="start-level-btn"
          className="bg-accent text-white text-base font-bold px-12 py-4 rounded-full shadow-md transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105 hover:shadow-lg"
          onClick={handleStart}
          disabled={!levels[selected] || getLockState(levels[selected]).locked}
        >
          START LEVEL
        </button>
      </div>
    </div>
  )
}
