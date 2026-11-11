/**
 * Deterministic identity avatar: a 5x5 identicon mirrored on the vertical axis
 * so the pattern reads as designed rather than random. The account id (or the
 * email as a fallback) is hashed with FNV-1a and expanded through an xorshift32
 * bit stream, so the same account always renders the same icon on every reload
 * and device. No dependencies, no network, no storage.
 *
 * Cells are drawn at 8px in a 40px viewBox with crispEdges, so the icon stays
 * pixel-crisp at 1x/1.5x/2x while sitting inside the 48px gradient ring.
 */
const GRID = 5
const CELL = 8
const SIZE = GRID * CELL
const HALF = Math.ceil(GRID / 2)

// Indigo/cyan family. Tailwind fill utilities (not inline hex) so the palette
// can brighten on the dark slate canvas without a second code path.
const PALETTE = [
  'fill-indigo-600 dark:fill-indigo-400',
  'fill-indigo-500 dark:fill-indigo-300',
  'fill-cyan-600 dark:fill-cyan-400',
  'fill-cyan-500 dark:fill-cyan-300',
]

function hashSeed(seed) {
  let hash = 0x811c9dc5
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function createPattern(seed) {
  let state = hashSeed(seed) || 0x9e3779b9
  const next = () => {
    state ^= state << 13
    state >>>= 0
    state ^= state >>> 17
    state ^= state << 5
    state >>>= 0
    return state
  }

  // Three independent columns (centre column included); the right half mirrors
  // them, which is what makes every avatar look symmetric.
  const cells = []
  for (let index = 0; index < HALF * GRID; index += 1) {
    cells.push((next() >>> 8) % 100 < 54)
  }
  // Guarantee a recognisable silhouette: sparse hashes get cells switched on in
  // hash order instead of degrading to a near-empty square.
  let filled = cells.filter(Boolean).length
  for (let attempt = 0; filled < 7 && attempt < cells.length; attempt += 1) {
    const index = (next() >>> 8) % cells.length
    if (!cells[index]) {
      cells[index] = true
      filled += 1
    }
  }

  const columns = []
  for (let column = 0; column < HALF; column += 1) {
    columns.push(PALETTE[next() % PALETTE.length])
  }

  const squares = []
  for (let row = 0; row < GRID; row += 1) {
    for (let column = 0; column < GRID; column += 1) {
      const source = column < HALF ? column : GRID - 1 - column
      if (!cells[source * GRID + row]) continue
      squares.push({ key: row + ':' + column, x: column * CELL, y: row * CELL, fill: columns[source] })
    }
  }
  return squares
}

export default function UserAvatar({ seed, name = 'Learner' }) {
  const squares = createPattern(String(seed || 'praxis'))
  return (
    <span className="inline-flex shrink-0 rounded-full bg-gradient-to-br from-indigo-600 to-cyan-500 p-[2px] shadow-lg shadow-indigo-600/30">
      <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-white dark:bg-slate-900">
        <svg
          viewBox={'0 0 ' + SIZE + ' ' + SIZE}
          width={SIZE}
          height={SIZE}
          role="img"
          aria-label={'Avatar for ' + name}
          shapeRendering="crispEdges"
          className="h-10 w-10"
        >
          {squares.map(square => (
            <rect key={square.key} x={square.x} y={square.y} width={CELL} height={CELL} className={square.fill} />
          ))}
        </svg>
      </span>
    </span>
  )
}
