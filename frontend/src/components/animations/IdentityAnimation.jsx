// Identity (A + 0 = A, A · 1 = A): the inert identity constant drops in and evaporates
// while the surviving term pulses.
// Reads: data.constText, data.constPath, data.paths, data.activeText.
import ExprText from '../ExprText.jsx'
import { ghostTextStyle } from './animationStyles.js'

/* ─────────────────────────────────────────────
   7. Identity Animation (A + 0 = A and A · 1 = A)
   Inert identity constant dissolves away.
   ───────────────────────────────────────────── */
export default function IdentityAnimation({ rects, data }) {
  const valid = rects.filter(Boolean)
  if (valid.length === 0) return null

  // Single const factor in product e.g. A · 1 = A
  if (valid.length === 1) {
    const r = valid[0]
    const constText = data?.constText || '1'
    return (
      <div
        style={ghostTextStyle(r, {
          color: '#94a3b8',
          padding: '2px 6px',
          animation: 'identityConstEvaporate 0.85s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        })}
      >
        <ExprText text={constText} />
      </div>
    )
  }

  // Sum terms e.g. A + 0 = A
  const [r1, r2] = valid
  const isR1Const = data?.constPath ? data.constPath === data?.paths?.[0] : (r1.astText || r1.text) === '0'
  const constRect = isR1Const ? r1 : r2
  const activeRect = isR1Const ? r2 : r1
  const activeText = data?.activeText || (activeRect.astText || activeRect.text)
  const constText = data?.constText || '0'

  return (
    <>
      {/* Active Term stays stable and confirms */}
      <div
        style={ghostTextStyle(activeRect, {
          color: '#0284c7',
          padding: '2px 6px',
          borderRadius: '6px',
          border: '1.5px solid #0ea5e9',
          background: 'rgba(14, 165, 233, 0.08)',
          animation: 'identityActivePulse 1.0s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        })}
      >
        <ExprText text={activeText} />
      </div>

      {/* Inert Identity Constant (0) dropping and evaporating */}
      <div
        style={ghostTextStyle(constRect, {
          color: '#94a3b8',
          padding: '2px 6px',
          zIndex: 10000,
          animation: 'identityConstEvaporate 0.85s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        })}
      >
        <ExprText text={constText} />
      </div>
    </>
  )
}
