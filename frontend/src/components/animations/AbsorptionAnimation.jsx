// Absorption (A + A·B = A): the shorter survivor pulses while the longer term is drawn
// in, its shared literals gliding across and its extras evaporating.
// Reads: data.survivorPath, data.paths, data.survivorText, data.absorbedText.
import ExprText from '../ExprText.jsx'
import { ghostTextStyle, shockwaveStyle } from './animationStyles.js'

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

  const isProduct = Boolean(
    data?.isProduct ||
    data?.lawName?.includes('Product') ||
    (absorbedText.includes('+') && (absorbedText.includes('(') || survivorText.includes('(')))
  )

  const cleanAbsorbed = absorbedText.replace(/^\((.*)\)$/, '$1').trim()
  const cleanSurvivor = survivorText.replace(/^\((.*)\)$/, '$1').trim()
  const absorbedTerms = cleanAbsorbed.split('+').map(t => t.trim()).filter(Boolean)
  const survivorTerms = cleanSurvivor.split('+').map(t => t.trim()).filter(Boolean)

  const survivorLits = survivorText.match(/[a-zA-Z]'?/g) || [survivorText]
  const absorbedLits = absorbedText.match(/[a-zA-Z]'?/g) || [absorbedText]

  const dx = survivor.cx - absorbed.cx
  const dy = survivor.cy - absorbed.cy

  return (
    <>
      {/* Expanding emerald shockwave on absorption impact */}
      <div
        style={shockwaveStyle(survivor, {
          animation: 'absorbShockwave 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        })}
      />

      {/* Survivor (Absorber) — glowing emerald container with energy pulse */}
      <div
        style={ghostTextStyle(survivor, {
          color: '#059669',
          padding: '2px 6px',
          borderRadius: '6px',
          border: '1.5px solid #10b981',
          background: 'rgba(16, 185, 129, 0.08)',
          animation: 'absorbSurvivorPulse 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        })}
      >
        <ExprText text={survivorText} />
      </div>

      {/* Absorbed Term or Clause (Victim) */}
      <div
        style={ghostTextStyle(absorbed, {
          padding: '2px 6px',
          zIndex: 10000,
          whiteSpace: 'nowrap',
          '--abs-dx': `${dx}px`,
          '--abs-dy': `${dy}px`,
        })}
      >
        {isProduct && absorbedTerms.length > 1 ? (
          <>
            <span style={{ color: '#94a3b8', animation: 'parenFadeOut 0.6s 0.2s forwards' }}>(</span>
            {absorbedTerms.map((term, idx) => {
              const isShared = survivorTerms.some(st => st === term || st.replace(/\s+/g, '') === term.replace(/\s+/g, ''))
              return (
                <span key={idx} className="inline-flex items-baseline">
                  {idx > 0 && (
                    <span
                      style={{
                        color: isShared ? '#10b981' : '#f59e0b',
                        margin: '0 3px',
                        fontWeight: 'bold',
                        animation: isShared
                          ? 'absorbCoreGlide 1.0s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
                          : 'absorbExtraEvaporate 0.85s cubic-bezier(0.4, 0, 0.2, 1) forwards',
                      }}
                    >
                      +
                    </span>
                  )}
                  <span
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
                    <ExprText text={term} />
                  </span>
                </span>
              )
            })}
            <span style={{ color: '#94a3b8', animation: 'parenFadeOut 0.6s 0.2s forwards' }}>)</span>
          </>
        ) : (
          absorbedLits.map((lit, idx) => {
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
          })
        )}
      </div>
    </>
  )
}
