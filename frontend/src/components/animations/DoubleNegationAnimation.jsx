// Double negation ((A')' = A): the dual overbars and prime cross-cancel and dissolve
// around the surviving core term.
// Reads: data.coreText (falls back to rects[0].text).
import ExprText from '../ExprText.jsx'

/* ─────────────────────────────────────────────
   3. Double Negation Animation
   (A')' = A — dual bars cancel and dissolve
   ───────────────────────────────────────────── */
export default function DoubleNegationAnimation({ rects, data }) {
  const r = rects[0]
  if (!r) return null

  const coreText = data?.coreText || r.text.replace(/['()]/g, '')

  return (
    <div
      style={{
        position: 'fixed',
        left: r.left,
        top: r.top,
        display: 'inline-flex',
        alignItems: 'baseline',
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        fontSize: r.fontSize || '22px',
        fontWeight: '600',
        padding: '2px 6px',
        borderRadius: '6px',
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      {/* Outer parentheses fade out */}
      <span style={{ color: '#94a3b8', animation: 'parenFadeOut 0.6s forwards' }}>(</span>

      {/* Core variable with dissolving overbar and prime */}
      <span
        style={{
          display: 'inline-flex',
          position: 'relative',
          animation: 'doubleNegCorePop 1.1s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: '-2px',
            left: '0',
            right: '0',
            height: '2px',
            background: '#8b5cf6',
            animation: 'doubleNegBarDissolveUp 0.7s forwards',
          }}
        />
        <ExprText text={coreText} />
        <span
          style={{
            color: '#8b5cf6',
            fontWeight: 'bold',
            animation: 'doubleNegBarDissolveDown 0.7s forwards',
          }}
        >
          '
        </span>
      </span>

      <span style={{ color: '#94a3b8', animation: 'parenFadeOut 0.6s forwards' }}>)'</span>
    </div>
  )
}
