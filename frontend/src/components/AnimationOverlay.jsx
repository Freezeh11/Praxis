import { useEffect, useState } from 'react'

/**
 * AnimationOverlay — renders rich DOM-level physical transformation animations.
 *
 * Laws Handled:
 *   1. Distributive (Factoring): Common factors detach, slide forward, and merge into front factor.
 *   2. De Morgan's: The overline bar splits and lands on sub-terms while the operator rotates and flips.
 *   3. Absorption: Shorter term pulses magnetically and pulls in the longer redundant term, dissolving it.
 *   4. Complement: Dual terms slide to center, collide, and burst into 1 (or 0).
 *   5. Idempotent / Identity / Annulment: Snappy slide-merge with accent glow.
 */
export default function AnimationOverlay({ data }) {
  const [rects, setRects] = useState(null)

  useEffect(() => {
    if (!data) {
      setRects(null)
      return
    }

    const id = requestAnimationFrame(() => {
      const measured = data.paths.map(path => {
        const el = document.querySelector(`[data-path="${path}"]`)
        if (!el) return null
        const r = el.getBoundingClientRect()
        // Strip out handle icons and extra whitespace to get clean token text
        const cleanText = el.innerText.replace(/[⠿\s]+/g, ' ').trim()
        return {
          left: r.left,
          top: r.top,
          width: r.width,
          height: r.height,
          cx: r.left + r.width / 2,
          cy: r.top + r.height / 2,
          text: cleanText,
          fontSize: window.getComputedStyle(el).fontSize,
          fontWeight: window.getComputedStyle(el).fontWeight,
          fontFamily: window.getComputedStyle(el).fontFamily,
        }
      })
      setRects(measured)
    })
    return () => cancelAnimationFrame(id)
  }, [data])

  if (!data || !rects) return null

  const lawId = data.lawId || ''

  return (
    <div className="fixed top-0 left-0 w-screen h-screen z-[9999] pointer-events-none">
      {lawId === 'distributive' && <DistributiveFactoringAnimation rects={rects} />}
      {lawId.startsWith('demorgan') && <DeMorganSplitAnimation rects={rects} lawId={lawId} />}
      {lawId === 'absorption' && <AbsorptionSuctionAnimation rects={rects} />}
      {lawId === 'complement' && <ComplementBurstAnimation rects={rects} />}
      {lawId.startsWith('annulment') && <AnnulmentAnimation rects={rects} lawId={lawId} />}
      {['idempotent', 'identity'].includes(lawId) && (
        <MergeAnimation rects={rects} lawId={lawId} />
      )}
    </div>
  )
}

const tokenBaseStyle = (r) => ({
  position: 'fixed',
  left: r.left,
  top: r.top,
  width: r.width,
  height: r.height,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  fontSize: r.fontSize,
  fontWeight: r.fontWeight,
  color: '#1a2035',
  background: '#ffffff',
  border: '1.5px solid #0ea5e9',
  borderRadius: '6px',
  pointerEvents: 'none',
  zIndex: 9999,
})

/* ─────────────────────────────────────────────
   1. Distributive Factoring Animation
   Common variable lifts and merges to the front,
   while parentheses form around the remaining terms
   ───────────────────────────────────────────── */
function DistributiveFactoringAnimation({ rects }) {
  const valid = rects.filter(Boolean)
  if (valid.length < 2) return null
  const [r1, r2] = valid

  // Target factoring point: slightly in front/left of r1
  const targetX = Math.min(r1.left, r2.left) - 28
  const targetY = (r1.top + r2.top) / 2

  const dx1 = targetX - r1.left
  const dy1 = targetY - r1.top
  const dx2 = targetX - r2.left
  const dy2 = targetY - r2.top

  return (
    <>
      {/* First factor slides to front */}
      <div
        style={{
          ...tokenBaseStyle(r1),
          animation: 'factorPullOut1 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
          '--fact-dx1': `${dx1}px`,
          '--fact-dy1': `${dy1}px`,
        }}
      >
        {r1.text}
      </div>

      {/* Second factor slides and merges into the first */}
      <div
        style={{
          ...tokenBaseStyle(r2),
          animation: 'factorPullOut2 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
          '--fact-dx2': `${dx2}px`,
          '--fact-dy2': `${dy2}px`,
        }}
      >
        {r2.text}
      </div>
    </>
  )
}

/* ─────────────────────────────────────────────
   2. De Morgan's Law Animation
   Overline bar splits, operator flips
   ───────────────────────────────────────────── */
function DeMorganSplitAnimation({ rects, lawId }) {
  const r = rects[0]
  if (!r) return null

  const isAndToOr = lawId === 'demorgan-and'

  return (
    <>
      {/* Highlighting the group */}
      <div
        style={{
          position: 'fixed',
          left: r.left - 4,
          top: r.top - 4,
          width: r.width + 8,
          height: r.height + 8,
          border: '2px dashed #8b5cf6',
          borderRadius: '8px',
          background: 'rgba(139, 92, 246, 0.08)',
          pointerEvents: 'none',
          zIndex: 9998,
          animation: 'fadeOut 1.2s 0.2s ease forwards',
        }}
      />

      {/* Center Operator Flip Animation */}
      <div
        style={{
          position: 'fixed',
          left: r.cx,
          top: r.cy,
          transform: 'translate(-50%, -50%)',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '1.4rem',
          fontWeight: 'bold',
          color: '#8b5cf6',
          zIndex: 10000,
          animation: 'opFlip 1.1s ease forwards',
        }}
      >
        {isAndToOr ? '+' : '·'}
      </div>
    </>
  )
}

/* ─────────────────────────────────────────────
   3. Absorption Suction Animation
   Shorter term draws in and dissolves longer term
   ───────────────────────────────────────────── */
function AbsorptionSuctionAnimation({ rects }) {
  const valid = rects.filter(Boolean)
  if (valid.length < 2) return null
  const [r1, r2] = valid

  // Smart detect: Shorter term is ALWAYS the absorber/survivor
  const survivor = r1.text.length <= r2.text.length ? r1 : r2
  const absorbed = r1.text.length <= r2.text.length ? r2 : r1

  const dx = survivor.cx - absorbed.cx
  const dy = survivor.cy - absorbed.cy

  return (
    <>
      {/* Absorber (Shorter term) pulses with attractive aura */}
      <div
        style={{
          ...tokenBaseStyle(survivor),
          border: '2px solid #10b981',
          background: 'rgba(16, 185, 129, 0.1)',
          animation: 'absorbPulse 1.2s ease-in-out infinite',
        }}
      >
        {survivor.text}
      </div>

      {/* Absorbed (Longer term) slides into absorber and dissolves */}
      <div
        style={{
          ...tokenBaseStyle(absorbed),
          border: '1.5px solid #10b981',
          animation: 'absorbSlideDissolve 1.0s cubic-bezier(0.4, 0, 0.2, 1) forwards',
          '--abs-dx': `${dx}px`,
          '--abs-dy': `${dy}px`,
        }}
      >
        {absorbed.text}
      </div>
    </>
  )
}

/* ─────────────────────────────────────────────
   4. Complement Burst Animation
   A and A' collide at midpoint and burst into 1
   ───────────────────────────────────────────── */
function ComplementBurstAnimation({ rects }) {
  const valid = rects.filter(Boolean)
  if (valid.length < 2) return null
  const [r1, r2] = valid

  const midX = (r1.cx + r2.cx) / 2
  const midY = (r1.cy + r2.cy) / 2

  const dx1 = midX - r1.cx
  const dy1 = midY - r1.cy
  const dx2 = midX - r2.cx
  const dy2 = midY - r2.cy

  return (
    <>
      {/* r1 slides toward midpoint */}
      <div
        style={{
          ...tokenBaseStyle(r1),
          animation: 'complementSlide1 0.7s cubic-bezier(0.4, 0, 0.2, 1) forwards',
          '--cdx': `${dx1}px`,
          '--cdy': `${dy1}px`,
        }}
      >
        {r1.text}
      </div>

      {/* r2 slides toward midpoint */}
      <div
        style={{
          ...tokenBaseStyle(r2),
          animation: 'complementSlide2 0.7s cubic-bezier(0.4, 0, 0.2, 1) forwards',
          '--cdx': `${dx2}px`,
          '--cdy': `${dy2}px`,
        }}
      >
        {r2.text}
      </div>

      {/* "1" bursts out at collision point */}
      <div
        style={{
          position: 'fixed',
          left: midX,
          top: midY,
          transform: 'translate(-50%, -50%)',
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontSize: '2rem',
          fontWeight: '700',
          color: '#f59e0b',
          pointerEvents: 'none',
          zIndex: 10000,
          animation: 'complementBurst 1.1s 0.65s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
          opacity: 0,
          textShadow: '0 0 20px rgba(245, 158, 11, 0.8)',
        }}
      >
        1
      </div>
    </>
  )
}

/* ─────────────────────────────────────────────
   5. Merge Animation (Idempotent / Identity)
   ───────────────────────────────────────────── */
function MergeAnimation({ rects, lawId }) {
  const valid = rects.filter(Boolean)
  if (valid.length === 0) return null

  // Single element case (e.g. A · 1 = A)
  if (valid.length === 1) {
    return (
      <div
        style={{
          ...tokenBaseStyle(valid[0]),
          animation: 'singleFade 0.9s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        }}
      >
        {valid[0].text}
      </div>
    )
  }

  const [r1, r2] = valid

  // Smart detect survivor vs dissolved element
  let survivor = r1
  let absorbed = r2

  if (lawId === 'identity') {
    // 0 is always the dissolved element; variable is survivor
    survivor = r1.text === '0' ? r2 : r1
    absorbed = r1.text === '0' ? r1 : r2
  }

  const dx = survivor.cx - absorbed.cx
  const dy = survivor.cy - absorbed.cy

  return (
    <>
      <div style={{ ...tokenBaseStyle(survivor), animation: 'mergeGlow 0.5s 0.6s ease forwards' }}>
        {survivor.text}
      </div>

      <div
        style={{
          ...tokenBaseStyle(absorbed),
          animation: 'slideMerge 0.85s cubic-bezier(0.4, 0, 0.2, 1) forwards',
          '--slide-dx': `${dx}px`,
          '--slide-dy': `${dy}px`,
        }}
      >
        {absorbed.text}
      </div>
    </>
  )
}

/* ─────────────────────────────────────────────
   6. Annulment Animation (A + 1 = 1 and A · 0 = 0)
   The variable slides into the dominant constant (1 or 0),
   and the constant glows powerfully in gold/amber.
   ───────────────────────────────────────────── */
function AnnulmentAnimation({ rects, lawId }) {
  const valid = rects.filter(Boolean)
  if (valid.length === 0) return null

  const isProduct = lawId.includes('product') || valid.some(r => r.text === '0' || r.text.includes('0'))
  const dominantConst = isProduct ? '0' : '1'

  // Single element (e.g. A · 0 = 0 on product constant)
  if (valid.length === 1) {
    return (
      <div
        style={{
          ...tokenBaseStyle(valid[0]),
          border: '2px solid #f59e0b',
          color: '#b45309',
          animation: 'mergeGlow 0.6s 0.2s ease forwards',
        }}
      >
        {dominantConst}
      </div>
    )
  }

  const [r1, r2] = valid
  const constRect = (r1.text === dominantConst || r1.text.includes(dominantConst)) ? r1 : r2
  const varRect = (r1 === constRect) ? r2 : r1

  const dx = constRect.cx - varRect.cx
  const dy = constRect.cy - varRect.cy

  return (
    <>
      {/* Dominant Constant ("1" or "0") stands firm and glows gold */}
      <div
        style={{
          ...tokenBaseStyle(constRect),
          border: '2px solid #f59e0b',
          background: '#fef3c7',
          color: '#b45309',
          animation: 'mergeGlow 0.6s 0.3s ease forwards',
        }}
      >
        {dominantConst}
      </div>

      {/* Variable slides into the constant and dissolves */}
      <div
        style={{
          ...tokenBaseStyle(varRect),
          animation: 'slideMerge 0.85s cubic-bezier(0.4, 0, 0.2, 1) forwards',
          '--slide-dx': `${dx}px`,
          '--slide-dy': `${dy}px`,
        }}
      >
        {varRect.text}
      </div>
    </>
  )
}

