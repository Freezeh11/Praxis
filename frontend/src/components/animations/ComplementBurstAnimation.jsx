// Complement (A + A' = 1, A · A' = 0): the two literals collide at the midpoint
// and burst into the resulting constant.
// Reads: data.lit1Text, data.lit2Text, data.resultConst.
import ExprText from '../ExprText.jsx'

/* ─────────────────────────────────────────────
   5. Complement Burst Animation
   A and A' collide at midpoint and burst into 1 (or 0)
   ───────────────────────────────────────────── */
export default function ComplementBurstAnimation({ rects, data }) {
  const valid = rects.filter(Boolean)
  if (valid.length < 2) return null
  const [r1, r2] = valid

  const midX = (r1.cx + r2.cx) / 2
  const midY = (r1.cy + r2.cy) / 2

  const dx1 = midX - r1.cx
  const dy1 = midY - r1.cy
  const dx2 = midX - r2.cx
  const dy2 = midY - r2.cy

  const lit1 = data?.lit1Text || (r1.astText || r1.text)
  const lit2 = data?.lit2Text || (r2.astText || r2.text)
  const resultConst = data?.resultConst || '1'
  const isOne = resultConst === '1'
  const burstColor = isOne ? '#f59e0b' : '#6366f1'

  return (
    <>
      {/* Literal 1 sliding with particle trail to collision center */}
      <div
        style={{
          position: 'fixed',
          left: r1.left,
          top: r1.top,
          display: 'inline-flex',
          alignItems: 'baseline',
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontSize: r1.fontSize || '22px',
          fontWeight: '700',
          color: '#0ea5e9',
          padding: '2px 6px',
          zIndex: 9999,
          pointerEvents: 'none',
          '--cdx': `${dx1}px`,
          '--cdy': `${dy1}px`,
          animation: 'complementCollide1 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        }}
      >
        <ExprText text={lit1} />
      </div>

      {/* Literal 2 (Complement) sliding from the other side */}
      <div
        style={{
          position: 'fixed',
          left: r2.left,
          top: r2.top,
          display: 'inline-flex',
          alignItems: 'baseline',
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontSize: r2.fontSize || '22px',
          fontWeight: '700',
          color: '#8b5cf6',
          padding: '2px 6px',
          zIndex: 9999,
          pointerEvents: 'none',
          '--cdx': `${dx2}px`,
          '--cdy': `${dy2}px`,
          animation: 'complementCollide2 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        }}
      >
        <ExprText text={lit2} />
      </div>

      {/* High-energy collision fusion shockwave */}
      <div
        style={{
          position: 'fixed',
          left: midX,
          top: midY,
          width: '50px',
          height: '50px',
          borderRadius: '9999px',
          pointerEvents: 'none',
          zIndex: 9998,
          animation: 'complementShockwave 1.1s 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          opacity: 0,
        }}
      />

      {/* Resulting 1 or 0 bursting out */}
      <div
        style={{
          position: 'fixed',
          left: midX,
          top: midY,
          transform: 'translate(-50%, -50%)',
          display: 'inline-flex',
          alignItems: 'baseline',
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontSize: '28px',
          fontWeight: '800',
          color: burstColor,
          padding: '2px 10px',
          borderRadius: '6px',
          border: `1.5px solid ${burstColor}`,
          background: isOne ? 'rgba(245, 158, 11, 0.12)' : 'rgba(99, 102, 241, 0.12)',
          pointerEvents: 'none',
          zIndex: 10000,
          animation: 'complementBurst 1.0s 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
          opacity: 0,
        }}
      >
        <ExprText text={resultConst} />
      </div>
    </>
  )
}
