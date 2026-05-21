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
  const { getStagesCompleted } = useProgress()

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
        </div>
      )}
    </div>
  )
}
