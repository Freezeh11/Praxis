// Absorption (A + A·B = A): the shorter survivor pulses while the longer term is drawn
// in, its shared literals gliding across and its extras evaporating.
// Reads: data.survivorPath, data.paths, data.survivorText, data.absorbedText.
import ExprText from '../ExprText.jsx'

/* ─────────────────────────────────────────────
   4. Absorption Suction Animation
   Shorter term draws in and dissolves longer term
   ───────────────────────────────────────────── */
export default function AbsorptionAnimation({ rects, data }) {
  const valid = rects.filter(Boolean)
  if (valid.length < 2) return null
  const [r1, r2] = valid

  const isR1Survivor = data?.survivorPath
    ? data.survivorPath === data?.paths?.[0]
    : (r1.astText || r1.text).length <= (r2.astText || r2.text).length

  const survivor = isR1Survivor ? r1 : r2
  const absorbed = isR1Survivor ? r2 : r1

  const survivorText = data?.survivorText || (survivor.astText || survivor.text)
  const absorbedText = data?.absorbedText || (absorbed.astText || absorbed.text)

  const survivorLits = survivorText.match(/[a-zA-Z]'?/g) || [survivorText]
  const absorbedLits = absorbedText.match(/[a-zA-Z]'?/g) || [absorbedText]

  const dx = survivor.cx - absorbed.cx
  const dy = survivor.cy - absorbed.cy

  return (
    <>
      {/* Expanding emerald shockwave on absorption impact */}
      <div
        style={{
          position: 'fixed',
          left: survivor.cx,
          top: survivor.cy,
          width: Math.max(survivor.width, 36) + 16,
          height: Math.max(survivor.height, 36) + 16,
          borderRadius: '9999px',
          pointerEvents: 'none',
          zIndex: 9998,
          animation: 'absorbShockwave 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        }}
      />

      {/* Survivor (Absorber) — glowing emerald container with energy pulse */}
      <div
        style={{
          position: 'fixed',
          left: survivor.left,
          top: survivor.top,
          display: 'inline-flex',
          alignItems: 'baseline',
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontSize: survivor.fontSize || '22px',
          fontWeight: '600',
          color: '#059669',
          padding: '2px 6px',
          borderRadius: '6px',
          border: '1.5px solid #10b981',
          background: 'rgba(16, 185, 129, 0.08)',
          zIndex: 9999,
          pointerEvents: 'none',
          animation: 'absorbSurvivorPulse 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        }}
      >
        <ExprText text={survivorText} />
      </div>

      {/* Absorbed Term (Victim) — split into evaporating extras and gliding core payload */}
      <div
        style={{
          position: 'fixed',
          left: absorbed.left,
          top: absorbed.top,
          display: 'inline-flex',
          alignItems: 'baseline',
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontSize: absorbed.fontSize || '22px',
          fontWeight: '600',
          padding: '2px 6px',
          zIndex: 10000,
          pointerEvents: 'none',
          '--abs-dx': `${dx}px`,
          '--abs-dy': `${dy}px`,
        }}
      >
        {absorbedLits.map((lit, idx) => {
          const isShared = survivorLits.includes(lit)
          return (
            <span
              key={idx}
              style={{
                display: 'inline-flex',
                alignItems: 'baseline',
                color: isShared ? '#10b981' : '#f59e0b',
                fontWeight: 'bold',
                animation: isShared
                  ? 'absorbCoreGlide 1.0s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
                  : 'absorbExtraEvaporate 0.85s cubic-bezier(0.4, 0, 0.2, 1) forwards',
              }}
            >
              <ExprText text={lit} />
            </span>
          )
        })}
      </div>
    </>
  )
}
