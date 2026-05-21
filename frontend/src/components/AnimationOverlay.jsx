import { useEffect, useState } from 'react'

/**
 * AnimationOverlay — renders DOM-level slide animations over the workspace.
 *
 * For merging laws (annulment, identity, idempotent):
 *   - Clones the actual term elements as fixed-position divs at their exact coords
 *   - If 2 elements: victim slides toward survivor, survivor glows
 *   - If 1 element: element shrinks and fades (e.g. A·1 → remove the 1)
 *
 * For structural laws (distributive, absorption, demorgan):
 *   - Draws an SVG arc/line connecting the elements to show the relationship
 */
export default function AnimationOverlay({ data }) {
  const [rects, setRects] = useState(null)

  useEffect(() => {
    if (!data) { setRects(null); return }

    const id = requestAnimationFrame(() => {
      const measured = data.paths.map(path => {
        const el = document.querySelector(`[data-path="${path}"]`)
        if (!el) return null
        const r = el.getBoundingClientRect()
        return {
          left: r.left, top: r.top,
          width: r.width, height: r.height,
          cx: r.left + r.width / 2, cy: r.top + r.height / 2,
          text: el.innerText.trim(),
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

  const isMerge = ['annulment', 'identity', 'idempotent'].includes(data.lawId)
  const isComplement = data.lawId === 'complement'

  return (
    <div className="fixed top-0 left-0 w-screen h-screen z-[9999] pointer-events-none">
      {isMerge && <MergeAnimation rects={rects} lawId={data.lawId} />}
      {isComplement && <ComplementAnimation rects={rects} />}
      {!isMerge && !isComplement && <SVGAnimation rects={rects} lawId={data.lawId} />}
    </div>
  )
}

/* ─────────────────────────────────────────────
   Complement Animation
   Both terms (A and Ā) slide toward each other,
   collide in the middle, then a "1" bursts out.
   ───────────────────────────────────────────── */
function ComplementAnimation({ rects }) {
  const validRects = rects.filter(Boolean)
  if (validRects.length < 2) return null
  const [r1, r2] = validRects

  const midX = (r1.left + r1.width / 2 + r2.left + r2.width / 2) / 2
  const midY = (r1.top + r1.height / 2 + r2.top + r2.height / 2) / 2

  // r1 slides right → mid, r2 slides left → mid
  const dx1 = midX - (r1.left + r1.width / 2)
  const dy1 = midY - (r1.top + r1.height / 2)
  const dx2 = midX - (r2.left + r2.width / 2)
  const dy2 = midY - (r2.top + r2.height / 2)

  const tokenStyle = (r) => ({
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
    border: '1.5px solid #e2e5ed',
    borderRadius: '5px',
    pointerEvents: 'none',
    zIndex: 9999,
  })

  return (
    <>
      {/* r1 slides toward midpoint */}
      <div style={{
        ...tokenStyle(r1),
        animation: 'complementSlide1 0.8s cubic-bezier(0.4,0,0.2,1) forwards',
        '--cdx': `${dx1}px`, '--cdy': `${dy1}px`,
      }}>{r1.text}</div>

      {/* r2 slides toward midpoint */}
      <div style={{
        ...tokenStyle(r2),
        animation: 'complementSlide2 0.8s cubic-bezier(0.4,0,0.2,1) forwards',
        '--cdx': `${dx2}px`, '--cdy': `${dy2}px`,
      }}>{r2.text}</div>

      {/* "1" bursts out at the collision point */}
      <div style={{
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
        animation: 'complementBurst 1.2s 0.75s cubic-bezier(0.34,1.56,0.64,1) forwards',
        opacity: 0,
        textShadow: '0 0 20px rgba(245,158,11,0.8)',
      }}>1</div>
    </>
  )
}

/* ─────────────────────────────────────────────
   Merge Animation
   ─────────────────────────────────────────────
   2-element: r2 slides into r1, r1 glows
   1-element: the single element shrinks & fades
   ───────────────────────────────────────────── */
function MergeAnimation({ rects, lawId }) {
  const validRects = rects.filter(Boolean)
  if (validRects.length === 0) return null

  // Single element case (e.g. A·1 — only the "1" is selected)
  if (validRects.length === 1) {
    return <SingleFadeAnimation r={validRects[0]} />
  }

  const [r1, r2] = validRects

  // r2 slides toward r1 (r1 is the "survivor")
  const dx = r1.cx - r2.cx
  const dy = r1.cy - r2.cy

  const tokenStyle = (r) => ({
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
    border: '1.5px solid #e2e5ed',
    borderRadius: '5px',
    padding: '3px 7px',
    pointerEvents: 'none',
    zIndex: 9999,
  })

  return (
    <>
      {/* Survivor — sits still, glows amber when merge lands */}
      <div style={{ ...tokenStyle(r1), animation: 'mergeGlow 0.6s 0.9s ease forwards' }}>
        {r1.text}
      </div>

      {/* Victim — slides toward survivor then shrinks + fades */}
      <div style={{
        ...tokenStyle(r2),
        animation: 'slideMerge 1s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        '--slide-dx': `${dx}px`,
        '--slide-dy': `${dy}px`,
      }}>
        {r2.text}
      </div>

      {/* Plus sign between them fades out if terms are on the same row */}
      <PlusSignFade r1={r1} r2={r2} />
    </>
  )
}

/* Single element just shrinks to nothing — used for A·1 identity case */
function SingleFadeAnimation({ r }) {
  return (
    <div style={{
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
      border: '1.5px solid #e2e5ed',
      borderRadius: '5px',
      pointerEvents: 'none',
      zIndex: 9999,
      transformOrigin: 'center center',
      animation: 'singleFade 1s cubic-bezier(0.4, 0, 0.2, 1) forwards',
    }}>
      {r.text}
    </div>
  )
}

function PlusSignFade({ r1, r2 }) {
  const sameRow = Math.abs(r1.cy - r2.cy) < 30
  if (!sameRow) return null

  const midX = (r1.left + r1.width + r2.left) / 2
  const midY = r1.top + r1.height / 2

  return (
    <div style={{
      position: 'fixed',
      left: midX,
      top: midY,
      transform: 'translate(-50%, -50%)',
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fontSize: r1.fontSize,
      color: '#9aa0b0',
      pointerEvents: 'none',
      zIndex: 9999,
      animation: 'fadeOut 0.7s 0.1s ease forwards',
    }}>
      +
    </div>
  )
}

/* ─────────────────────────────────────────────
   SVG Animation — arc for structural laws
   ───────────────────────────────────────────── */
function SVGAnimation({ rects, lawId }) {
  if (!rects[0]) return null

  return (
    <svg style={{
      position: 'fixed', top: 0, left: 0,
      width: '100vw', height: '100vh',
      overflow: 'visible', pointerEvents: 'none',
    }}>
      {lawId === 'distributive' && rects[1] && <DistributiveArc rects={rects} />}
      {lawId === 'absorption' && rects[1] && <AbsorptionArc rects={rects} />}
      {lawId?.startsWith('demorgan') && <DeMorganLabel rects={rects} />}
    </svg>
  )
}

function DistributiveArc({ rects }) {
  const [r1, r2] = rects
  if (!r1 || !r2) return null
  const midX = (r1.cx + r2.cx) / 2
  const midY = Math.min(r1.cy, r2.cy) - 55
  const d = `M ${r1.cx} ${r1.cy - 10} Q ${midX} ${midY} ${r2.cx} ${r2.cy - 10}`

  return (
    <path
      d={d}
      fill="none"
      stroke="#0ea5e9"
      strokeWidth="3"
      strokeDasharray="7 5"
      strokeDashoffset="300"
      style={{ animation: 'svgDraw 1.4s ease forwards' }}
    />
  )
}

function AbsorptionArc({ rects }) {
  const [r1, r2] = rects
  if (!r1 || !r2) return null
  const midX = (r1.cx + r2.cx) / 2
  const midY = Math.min(r1.cy, r2.cy) - 45
  const d = `M ${r1.cx} ${r1.cy - 10} Q ${midX} ${midY} ${r2.cx} ${r2.cy - 10}`

  return (
    <>
      <path
        d={d}
        fill="none"
        stroke="#10b981"
        strokeWidth="3"
        strokeDasharray="7 5"
        strokeDashoffset="300"
        style={{ animation: 'svgDraw 1.4s ease forwards' }}
      />
      <text
        x={midX} y={midY - 10}
        fill="#10b981" fontSize="15" fontWeight="700" textAnchor="middle"
        style={{ animation: 'svgFadeIn 0.5s 0.7s ease forwards', opacity: 0 }}
      >
        absorbs
      </text>
    </>
  )
}

function DeMorganLabel({ rects }) {
  const r = rects[0]
  if (!r) return null
  return (
    <text
      x={r.cx} y={r.cy - 36}
      fill="#8b5cf6" fontSize="17" fontWeight="700" textAnchor="middle"
      style={{ animation: 'svgFadeIn 0.6s ease forwards', opacity: 0 }}
    >
      break the bar, flip the op
    </text>
  )
}
