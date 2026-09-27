// Annulment (A + 1 = 1, A · 0 = 0): the variable is drawn into the dominant constant
// by a singularity shockwave and swallowed.
// Reads: lawId, data.dominantConst, data.constPath, data.paths, data.varText.
import ExprText from '../ExprText.jsx'

/* ─────────────────────────────────────────────
   8. Annulment Animation (A + 1 = 1 and A · 0 = 0)
   Variable slides into the dominant constant.
   ───────────────────────────────────────────── */
export default function AnnulmentAnimation({ rects, lawId, data }) {
  const valid = rects.filter(Boolean)
  if (valid.length === 0) return null

  const isProduct = lawId.includes('product') || valid.some(r => (r.astText || r.text) === '0' || (r.astText || r.text).includes('0'))
  const dominantConst = data?.dominantConst || (isProduct ? '0' : '1')
  const isOne = dominantConst === '1'

  const themeColor = isOne ? '#d97706' : '#6366f1'
  const bgColor = isOne ? 'rgba(245, 158, 11, 0.12)' : 'rgba(99, 102, 241, 0.12)'
  const borderColor = isOne ? '#f59e0b' : '#6366f1'

  if (valid.length === 1) {
    const r = valid[0]
    return (
      <>
        <div
          style={{
            position: 'fixed',
            left: r.cx,
            top: r.cy,
            width: Math.max(r.width, 36) + 16,
            height: Math.max(r.height, 36) + 16,
            borderRadius: '9999px',
            pointerEvents: 'none',
            zIndex: 9998,
            animation: 'annulmentShockwave 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          }}
        />
        <div
          style={{
            position: 'fixed',
            left: r.left,
            top: r.top,
            display: 'inline-flex',
            alignItems: 'baseline',
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontSize: r.fontSize || '22px',
            fontWeight: '700',
            color: themeColor,
            padding: '2px 8px',
            borderRadius: '6px',
            border: `1.5px solid ${borderColor}`,
            background: bgColor,
            zIndex: 9999,
            pointerEvents: 'none',
            animation: 'annulmentDominantSurge 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
          }}
        >
          <ExprText text={dominantConst} />
        </div>
      </>
    )
  }

  const [r1, r2] = valid
  const isR1Const = data?.constPath
    ? data.constPath === data?.paths?.[0]
    : ((r1.astText || r1.text) === dominantConst || (r1.astText || r1.text).includes(dominantConst))

  const constRect = isR1Const ? r1 : r2
  const varRect = isR1Const ? r2 : r1
  const varText = data?.varText || (varRect.astText || varRect.text)

  const dx = constRect.cx - varRect.cx
  const dy = constRect.cy - varRect.cy

  return (
    <>
      {/* Expanding Singularity Shockwave */}
      <div
        style={{
          position: 'fixed',
          left: constRect.cx,
          top: constRect.cy,
          width: Math.max(constRect.width, 36) + 16,
          height: Math.max(constRect.height, 36) + 16,
          borderRadius: '9999px',
          pointerEvents: 'none',
          zIndex: 9998,
          animation: 'annulmentShockwave 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        }}
      />

      {/* Dominant Constant (1 or 0) surging with gravitational power */}
      <div
        style={{
          position: 'fixed',
          left: constRect.left,
          top: constRect.top,
          display: 'inline-flex',
          alignItems: 'baseline',
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontSize: constRect.fontSize || '22px',
          fontWeight: '700',
          color: themeColor,
          padding: '2px 8px',
          borderRadius: '6px',
          border: `1.5px solid ${borderColor}`,
          background: bgColor,
          zIndex: 9999,
          pointerEvents: 'none',
          animation: 'annulmentDominantSurge 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        }}
      >
        <ExprText text={dominantConst} />
      </div>

      {/* Variable / Term being drawn in and swallowed */}
      <div
        style={{
          position: 'fixed',
          left: varRect.left,
          top: varRect.top,
          display: 'inline-flex',
          alignItems: 'baseline',
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontSize: varRect.fontSize || '22px',
          fontWeight: '600',
          padding: '2px 6px',
          zIndex: 10000,
          pointerEvents: 'none',
          '--annul-dx': `${dx}px`,
          '--annul-dy': `${dy}px`,
          animation: 'annulmentSwallowed 1.0s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        }}
      >
        <ExprText text={varText} />
      </div>
    </>
  )
}
