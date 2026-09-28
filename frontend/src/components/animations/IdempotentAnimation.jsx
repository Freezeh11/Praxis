// Idempotent (A + A = A, A · A = A): the duplicate term glides into the survivor
// under a harmonic shockwave.
// Reads: data.survivorPath, data.paths, data.termText.
import ExprText from '../ExprText.jsx'
import { ghostTextStyle, shockwaveStyle } from './animationStyles.js'

/* ─────────────────────────────────────────────
   6. Idempotent Animation (A + A = A and A · A = A)
   Duplicate term slides into survivor and harmonizes.
   ───────────────────────────────────────────── */
export default function IdempotentAnimation({ rects, data }) {
  const valid = rects.filter(Boolean)
  if (valid.length < 2) return null
  const [r1, r2] = valid

  const isR1Survivor = data?.survivorPath ? data.survivorPath === data?.paths?.[0] : true
  const survivor = isR1Survivor ? r1 : r2
  const duplicate = isR1Survivor ? r2 : r1
  const termText = data?.termText || (survivor.astText || survivor.text)

  const dx = survivor.cx - duplicate.cx
  const dy = survivor.cy - duplicate.cy

  return (
    <>
      {/* Expanding harmonic shockwave on merge */}
      <div
        style={shockwaveStyle(survivor, {
          animation: 'idempotentShockwave 1.2s 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          opacity: 0,
        })}
      />

      {/* Survivor Term receiving the harmonic unification */}
      <div
        style={ghostTextStyle(survivor, {
          color: '#4f46e5',
          padding: '2px 6px',
          borderRadius: '6px',
          border: '1.5px solid #6366f1',
          background: 'rgba(99, 102, 241, 0.08)',
          animation: 'idempotentSurvivorPulse 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        })}
      >
        <ExprText text={termText} />
      </div>

      {/* Duplicate Term sliding into survivor */}
      <div
        style={ghostTextStyle(duplicate, {
          color: '#6366f1',
          padding: '2px 6px',
          zIndex: 10000,
          '--idem-dx': `${dx}px`,
          '--idem-dy': `${dy}px`,
          animation: 'idempotentGlideMerge 0.9s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        })}
      >
        <ExprText text={termText} />
      </div>
    </>
  )
}
