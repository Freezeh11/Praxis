import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { useProgress } from '../hooks/useProgress'

const LOCK_LEVELS = [2, 3] // only level 1 is playable

export default function LevelSelectPage() {
  const navigate = useNavigate()
  const { levels, loading, error } = useApi()
  const { progress, isLevelCompleted } = useProgress()
  const [selected, setSelected] = useState(0) // index into levels array

  const handleStart = () => {
    const lv = levels[selected]
    if (!lv || LOCK_LEVELS.includes(lv.id)) return
    navigate(`/level/${lv.id}/stages`)
  }

  const prev = () => setSelected(s => Math.max(0, s - 1))
  const next = () => setSelected(s => Math.min((levels.length || 1) - 1, s + 1))

  const isLocked = (lv) => LOCK_LEVELS.includes(lv?.id)

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
            const locked = isLocked(lv)
            const done = isLevelCompleted(lv.id)
            const isActive = offset === 0

            return (
              <div
                key={lv.id}
                className={`w-[220px] bg-bg-card rounded-[20px] px-7 py-9 flex flex-col items-center gap-2.5 cursor-pointer transition-all duration-250 ease-out select-none
                  ${isActive ? 'border-[2.5px] border-text-1 scale-100 translate-y-0 opacity-100 shadow-md' : 'border-[1.5px] border-border scale-[0.92] translate-y-1 opacity-70 shadow-sm'}
                  ${locked ? 'opacity-50 cursor-not-allowed' : ''}
                  ${!locked && !isActive ? 'hover:opacity-90 hover:scale-95 hover:translate-y-0.5' : ''}
                `}
                onClick={() => !locked && setSelected(i)}
              >
                <div className={`w-16 h-16 rounded-[14px] border-[1.5px] flex items-center justify-center font-extrabold transition-all
                  ${isActive ? 'bg-text-1 text-white border-text-1 text-[28px]' : 'border-border text-[26px]'}
                  ${done && !isActive ? 'bg-green-light text-green' : ''}
                  ${locked ? 'bg-bg text-text-3' : (!isActive && !done ? 'bg-bg text-text-2' : '')}
                `}>
                  {locked ? '🔒' : done ? '✓' : lv.id}
                </div>
                <div className={`font-bold text-text-1 tracking-[-0.3px] ${isActive ? 'text-[19px]' : 'text-[17px]'}`}>{lv.name}</div>
                <div className="text-[13px] text-text-3 text-center">{lv.desc}</div>
                {locked && <div className="text-[11px] text-text-3 bg-bg px-2.5 py-[3px] rounded-full border border-border font-medium mt-auto">Coming Soon</div>}
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
          className="bg-accent text-white text-base font-bold px-12 py-4 rounded-full shadow-md transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105 hover:shadow-lg"
          onClick={handleStart}
          disabled={!levels[selected] || isLocked(levels[selected])}
        >
          START LEVEL
        </button>
      </div>
    </div>
  )
}
