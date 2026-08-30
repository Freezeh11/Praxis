import { useEffect, useState } from 'react'

/**
 * AnimationOverlay — renders clean, distinct DOM-level physical transformation animations.
 *
 * Laws Handled:
 *   1. De Morgan's (AND→OR & OR→AND): Overbar snaps in two and lands on subterms while operator transforms.
 *   2. Distributive (Factoring): Shared literal lifts forward to become common front factor.
 *   3. Double Negation: Dual overbars cross-cancel and dissolve.
 *   4. Absorption: Shorter term pulls in and dissolves longer term.
 *   5. Complement: Dual literals collide and burst into constant (1 or 0).
 *   6. Annulment: Variable slides into dominant constant (1 or 0).
 *   7. Idempotent / Identity: Snappy slide-merge / fade.
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
      {lawId.startsWith('demorgan') && <DeMorganSplitAnimation rects={rects} data={data} lawId={lawId} />}
      {lawId === 'distributive' && <DistributiveFactoringAnimation rects={rects} />}
      {lawId === 'double-neg' && <DoubleNegationAnimation rects={rects} />}
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
  fontSize: r.fontSize || '22px',
  fontWeight: r.fontWeight || '600',
  color: '#1a2035',
  background: '#ffffff',
  border: '1.5px solid #0ea5e9',
  borderRadius: '6px',
  pointerEvents: 'none',
  zIndex: 9999,
})

/* ─────────────────────────────────────────────
   1. De Morgan's Law Animation
   The continuous overline bar snaps in half,
   descends on subterms, and the operator flips.
   ───────────────────────────────────────────── */
function DeMorganSplitAnimation({ rects, data, lawId }) {
  const r = rects[0]
  if (!r) return null

  const isAndToOr = lawId === 'demorgan-and'
  const halfW = (r.width - 12) / 2

  return (
    <div
      style={{
        position: 'fixed',
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: r.fontSize || '22px',
        fontWeight: 'bold',
        zIndex: 9999,
      }}
    >
      {/* Left sub-term with its own overbar */}
      <div
        style={{
          position: 'absolute',
          left: '12%',
          top: '50%',
          transform: 'translateY(-50%)',
          animation: 'barSplitLeft 1.1s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
          display: 'inline-flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <span style={{ width: `${halfW}px`, height: '2.5px', background: '#8b5cf6', marginBottom: '2px', borderRadius: '1px' }} />
        <span className="text-text-1">A</span>
      </div>

      {/* Center Operator: + emerges for AND→OR, dissolves for OR→AND */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: '1.25rem',
          color: '#8b5cf6',
          fontWeight: 'bold',
          animation: 'opFlip 0.9s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        }}
      >
        {isAndToOr ? '+' : '·'}
      </div>

      {/* Right sub-term with its own overbar */}
      <div
        style={{
          position: 'absolute',
          right: '12%',
          top: '50%',
          transform: 'translateY(-50%)',
          animation: 'barSplitRight 1.1s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
          display: 'inline-flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <span style={{ width: `${halfW}px`, height: '2.5px', background: '#8b5cf6', marginBottom: '2px', borderRadius: '1px' }} />
        <span className="text-text-1">B</span>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   2. Distributive Factoring Animation
   Shared factor lifts out and moves to the front.
   ───────────────────────────────────────────── */
function DistributiveFactoringAnimation({ rects }) {
  const valid = rects.filter(Boolean)
  if (valid.length < 2) return null
  const [r1, r2] = valid

  const targetX = Math.min(r1.left, r2.left) - 28
  const targetY = (r1.top + r2.top) / 2

  const dx1 = targetX - r1.left
  const dy1 = targetY - r1.top
  const dx2 = targetX - r2.left
  const dy2 = targetY - r2.top

  return (
    <>
      {/* First factor slides forward */}
      <div
        style={{
          ...tokenBaseStyle(r1),
          animation: 'factorPullOut1 1.1s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
          '--fact-dx1': `${dx1}px`,
          '--fact-dy1': `${dy1}px`,
        }}
      >
        {r1.text}
      </div>

      {/* Second factor merges into the first */}
      <div
        style={{
          ...tokenBaseStyle(r2),
          animation: 'factorPullOut2 1.1s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
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
   3. Double Negation Animation
   (A')' = A — dual bars cancel and dissolve
   ───────────────────────────────────────────── */
function DoubleNegationAnimation({ rects }) {
  const r = rects[0]
  if (!r) return null

  return (
    <div
      style={{
        ...tokenBaseStyle(r),
        animation: 'doubleNegCancel 1.0s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        border: '1.5px solid #8b5cf6',
        color: '#8b5cf6',
      }}
    >
      {r.text}
    </div>
  )
}

/* ─────────────────────────────────────────────
   4. Absorption Suction Animation
   Shorter term draws in and dissolves longer term
   ───────────────────────────────────────────── */
function AbsorptionSuctionAnimation({ rects }) {
  const valid = rects.filter(Boolean)
  if (valid.length < 2) return null
  const [r1, r2] = valid

  const survivor = r1.text.length <= r2.text.length ? r1 : r2
  const absorbed = r1.text.length <= r2.text.length ? r2 : r1

  const dx = survivor.cx - absorbed.cx
  const dy = survivor.cy - absorbed.cy

  return (
    <>
      {/* Absorber (Shorter term) pulses green */}
      <div
        style={{
          ...tokenBaseStyle(survivor),
          border: '2px solid #10b981',
          background: 'rgba(16, 185, 129, 0.1)',
          animation: 'absorbPulse 1.1s ease-in-out infinite',
        }}
      >
        {survivor.text}
      </div>

      {/* Absorbed (Longer term) slides into absorber and fades */}
      <div
        style={{
          ...tokenBaseStyle(absorbed),
          border: '1.5px solid #10b981',
          animation: 'absorbSlideDissolve 0.95s cubic-bezier(0.4, 0, 0.2, 1) forwards',
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
   5. Complement Burst Animation
   A and A' collide at midpoint and burst into 1 (or 0)
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

      {/* Resulting 1 bursts out cleanly */}
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
          animation: 'complementBurst 1.0s 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
          opacity: 0,
        }}
      >
        1
      </div>
    </>
  )
}

/* ─────────────────────────────────────────────
   6. Merge Animation (Idempotent / Identity)
   ───────────────────────────────────────────── */
function MergeAnimation({ rects, lawId }) {
  const valid = rects.filter(Boolean)
  if (valid.length === 0) return null

  if (valid.length === 1) {
    return (
      <div
        style={{
          ...tokenBaseStyle(valid[0]),
          animation: 'singleFade 0.85s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        }}
      >
        {valid[0].text}
      </div>
    )
  }

  const [r1, r2] = valid
  let survivor = r1
  let absorbed = r2

  if (lawId === 'identity') {
    survivor = r1.text === '0' ? r2 : r1
    absorbed = r1.text === '0' ? r1 : r2
  }

  const dx = survivor.cx - absorbed.cx
  const dy = survivor.cy - absorbed.cy

  return (
    <>
      <div style={{ ...tokenBaseStyle(survivor), animation: 'mergeGlow 0.5s 0.5s ease forwards' }}>
        {survivor.text}
      </div>

      <div
        style={{
          ...tokenBaseStyle(absorbed),
          animation: 'slideMerge 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards',
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
   7. Annulment Animation (A + 1 = 1 and A · 0 = 0)
   Variable slides into the dominant constant.
   ───────────────────────────────────────────── */
function AnnulmentAnimation({ rects, lawId }) {
  const valid = rects.filter(Boolean)
  if (valid.length === 0) return null

  const isProduct = lawId.includes('product') || valid.some(r => r.text === '0' || r.text.includes('0'))
  const dominantConst = isProduct ? '0' : '1'

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

      <div
        style={{
          ...tokenBaseStyle(varRect),
          animation: 'slideMerge 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards',
          '--slide-dx': `${dx}px`,
          '--slide-dy': `${dy}px`,
        }}
      >
        {varRect.text}
      </div>
    </>
  )
}

