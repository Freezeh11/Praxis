import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { useProgress } from '../hooks/useProgress'

/*
  Stage layout for 6 stages arranged in concentric squares (light theme).
  Outer ring: stages 0,1,2,3 at top, right, bottom, left
  Inner ring: stages 4,5 at top-right, bottom-left
  Center:    decorative lock node
*/
const STAGE_POSITIONS = [
  // [col, row] in a 5×5 grid (0-indexed), index = stageIdx
  { col: 2, row: 0 }, // Stage 1 — top center
  { col: 4, row: 2 }, // Stage 2 — right center
  { col: 2, row: 4 }, // Stage 3 — bottom center
  { col: 0, row: 2 }, // Stage 4 — left center
  { col: 3, row: 1 }, // Stage 5 — inner top-right
  { col: 1, row: 3 }, // Stage 6 — inner bottom-left
]

// SVG connector paths between sequential stages (col,row) pairs
const CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 0], // outer ring
  [0, 4], [4, 1], [2, 5], [5, 3], // outer to inner
  [4, 5],                           // inner connection
]

const CELL = 80  // px per grid cell
const GRID = 5   // 5×5 grid
const SIZE = CELL * (GRID - 1) // total svg width/height = 320

function cx(col) { return col * CELL }
function cy(row) { return row * CELL }

export default function StageSelectorPage() {
  const { levelId } = useParams()
  const navigate = useNavigate()
  const { fetchLevel } = useApi()
  const { progress, getStagesCompleted, getLevelProgress } = useProgress()

  const [level, setLevel] = useState(null)
  const [loading, setLoading] = useState(true)
  const [hoveredStage, setHoveredStage] = useState(null)

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

  return (
    <div className="flex flex-col min-h-screen bg-bg">
      {/* Header */}
      <header className="w-full h-[72px] px-8 flex items-center justify-between bg-bg-card/70 backdrop-blur-md border-b-2 border-border z-10 shrink-0">
        <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-text-2 bg-transparent hover:bg-border rounded transition-all" onClick={() => navigate('/')}>
          ← Back
        </button>
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 bg-accent text-white rounded-md flex items-center justify-center font-bold text-lg">⊕</span>
          <span className="font-bold text-[19px] tracking-tight text-accent">Praxis</span>
        </div>
        <div className="flex items-center gap-3">
          <button className="w-9 h-9 rounded-full flex items-center justify-center text-lg text-text-2 bg-transparent hover:bg-border transition-all" title="Law Reference">📖</button>
        </div>
      </header>

      {loading && <div className="p-10 text-text-3 text-sm text-center">Loading stages…</div>}

      {!loading && level && (
        <div className="flex-1 flex flex-col items-center px-5 pt-10 pb-[60px] gap-10">
          <div className="text-center">
            <h2 className="text-[26px] font-extrabold text-text-1 tracking-[-0.5px] mb-1.5">{level.name}</h2>
            <p className="text-sm text-text-3 mb-3">{level.desc}</p>
            <div className="inline-block text-xs font-semibold text-teal bg-teal-light px-3.5 py-1 rounded-full">
              {completedSet.size} / {puzzles.length} stages completed
            </div>
          </div>

          {/* Concentric squares map */}
          <div className="relative w-[340px] h-[340px]">
            {/* Concentric square rings */}
            <div className="absolute inset-0 border-[1.5px] border-border rounded-xl pointer-events-none" />
            <div className="absolute inset-[64px] border-[1.5px] border-border-dark border-dashed rounded-xl pointer-events-none" />

            {/* SVG connectors */}
            <svg
              className="absolute -inset-6 w-[388px] h-[388px] pointer-events-none"
              viewBox={`-24 -24 ${SIZE + 48} ${SIZE + 48}`}
            >
              {CONNECTIONS.map(([a, b], i) => {
                const aPos = STAGE_POSITIONS[a]
                const bPos = STAGE_POSITIONS[b]
                if (!aPos || !bPos) return null
                const bothDone = completedSet.has(a) && completedSet.has(b)
                return (
                  <line
                    key={i}
                    x1={cx(aPos.col)} y1={cy(aPos.row)}
                    x2={cx(bPos.col)} y2={cy(bPos.row)}
                    className="stroke-[1.5px]"
                    stroke={bothDone ? 'var(--color-teal)' : 'var(--color-border-dark)'}
                    strokeDasharray="6 4"
                  />
                )
              })}
            </svg>

            {/* Stage nodes */}
            {STAGE_POSITIONS.slice(0, puzzles.length).map((pos, idx) => {
              const st = getStageStatus(idx)
              
              let colors = 'bg-bg text-text-3 border-border opacity-45 cursor-not-allowed'
              if (st === 'completed') colors = 'bg-green-light text-green border-green'
              if (st === 'available') colors = 'bg-amber-light text-amber border-amber'

              return (
                <button
                  key={idx}
                  className={`absolute w-11 h-11 rounded-[10px] flex items-center justify-center text-[15px] font-bold border-2 shadow-sm transition-all z-10 
                    -translate-x-1/2 -translate-y-1/2
                    hover:not:disabled:scale-110 hover:not:disabled:shadow-md
                    ${colors}`}
                  style={{
                    left: cx(pos.col),
                    top: cy(pos.row),
                  }}
                  onClick={() => handleStageClick(idx)}
                  disabled={st === 'locked'}
                  title={st === 'locked' ? 'Complete previous stage first' : `Stage ${idx + 1}`}
                >
                  {st === 'completed' ? '✓' : idx + 1}
                </button>
              )
            })}

            {/* Center decoration */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-xl bg-text-1 flex items-center justify-center text-[22px] text-white shadow-md pointer-events-none">
              <span>⊕</span>
            </div>
          </div>

          {/* ── Level 2 unlock progress (only shown on Level 1) ── */}
          {Number(levelId) === 1 && puzzles.length > 0 && (() => {
            const lp = getLevelProgress(1, puzzles.length)
            const pct = Math.min(100, lp.avgScore)
            const barColor = lp.unlocked ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444'
            return (
              <div className="w-full max-w-[380px] bg-bg-card border border-border rounded-2xl px-5 py-4 flex flex-col gap-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-bold text-text-1">Level 2 Unlock</span>
                  {lp.unlocked
                    ? <span className="text-[11px] font-bold text-green bg-green-light px-2.5 py-0.5 rounded-full">🔓 Unlocked!</span>
                    : <span className="text-[11px] font-semibold text-text-3">Need 70% avg across all stages</span>
                  }
                </div>

                {/* Avg score bar */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[11px] font-semibold text-text-2">
                    <span>{lp.completed} / {puzzles.length} stages attempted</span>
                    <span>{lp.avgScore} / 100 avg score</span>
                  </div>
                  <div className="relative w-full h-2.5 bg-border rounded-full overflow-visible">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: barColor }}
                    />
                    {/* 70% threshold marker */}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-[2px] h-4 bg-text-2 rounded-full"
                      style={{ left: '70%' }}
                      title="70% threshold"
                    />
                  </div>
                  <div className="text-[10px] text-text-3 text-right">Target: 70%</div>
                </div>

                {/* Per-stage score breakdown */}
                <div className="flex flex-col gap-1.5 text-[11px] text-text-2">
                  {Array.from({ length: puzzles.length }, (_, i) => {
                    const stageScore = progress.stageScores?.[`1:${i}`] ?? null
                    const done = completedSet.has(i)
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold border ${
                          done ? 'bg-green-light text-green border-green' : 'bg-bg text-text-3 border-border'
                        }`}>{done ? '✓' : i + 1}</span>
                        <span className="flex-1 text-text-2">Stage {i + 1}</span>
                        {stageScore !== null
                          ? <span className={`font-bold px-1.5 py-0.5 rounded ${
                              stageScore >= 70 ? 'text-green bg-green-light' :
                              stageScore >= 40 ? 'text-amber bg-amber-light' :
                              'text-red-600 bg-red-50'
                            }`}>{stageScore}/100</span>
                          : <span className="text-text-3 italic">not yet attempted</span>
                        }
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
