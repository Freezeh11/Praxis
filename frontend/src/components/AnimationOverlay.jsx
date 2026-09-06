import { useEffect, useState } from 'react'
import { getNode, nodeText } from '../lib/expr.js'
import ExprText from './ExprText.jsx'

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
        // If el is a term container with a ⠿ handle as its first child, measure the inner expression
        const targetEl = (el.children && el.children.length >= 2 && el.children[0].innerText?.includes('⠿'))
          ? el.children[1]
          : el
        const r = targetEl.getBoundingClientRect()
        // Strip out handle icons and extra whitespace to get clean token text
        const cleanText = targetEl.innerText.replace(/[⠿\s]+/g, ' ').trim()

        // Extract true mathematical text from AST if available so overbars/primes are preserved
        let astText = cleanText
        if (data.exprBefore) {
          const node = getNode(data.exprBefore, path)
          if (node) {
            astText = nodeText(node)
          }
        }

        return {
          left: r.left,
          top: r.top,
          width: r.width,
          height: r.height,
          cx: r.left + r.width / 2,
          cy: r.top + r.height / 2,
          text: cleanText,
          astText: astText,
          fontSize: window.getComputedStyle(targetEl).fontSize,
          fontWeight: window.getComputedStyle(targetEl).fontWeight,
          fontFamily: window.getComputedStyle(targetEl).fontFamily,
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
      {lawId === 'distributive' && <DistributiveFactoringAnimation rects={rects} data={data} />}
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
   Top group overbar dissolves away, old operator dissolves,
   existing overbars cancel/vanish, new overbars drop onto
   unbarred terms, and the new operator emerges.
   ───────────────────────────────────────────── */
function DeMorganSplitAnimation({ rects, data, lawId }) {
  const r = rects[0]
  if (!r) return null

  const isAndToOr = lawId === 'demorgan-and' || data?.isAndToOr
  let subterms = data?.deMorganTerms

  // Fallback if deMorganTerms wasn't passed directly: extract from AST exprBefore
  if (!subterms || subterms.length === 0) {
    if (data?.exprBefore && data?.paths?.[0]) {
      const targetNode = getNode(data.exprBefore, data.paths[0])
      if (targetNode?.type === 'not' && targetNode.child) {
        const child = targetNode.child
        const list = child.type === 'prod' ? child.factors : child.type === 'sum' ? child.terms : [child]
        subterms = list.map(item => {
          if (item.type === 'lit') {
            return {
              v: item.v,
              hadBar: item.n,
              willHaveBar: !item.n,
            }
          }
          const text = nodeText(item)
          const hadBar = item.type === 'not' || text.endsWith("'")
          return {
            v: hadBar && item.type === 'not' ? nodeText(item.child) : text.replace(/'$/, ''),
            hadBar,
            willHaveBar: !hadBar,
          }
        })
      }
    }
  }

  // Final fallback if AST lookup failed
  if (!subterms || subterms.length === 0) {
    subterms = [
      { v: 'x', hadBar: false, willHaveBar: true },
      { v: 'y', hadBar: false, willHaveBar: true },
    ]
  }

  const oldOp = isAndToOr ? '·' : '+'
  const newOp = isAndToOr ? '+' : '·'

  return (
    <div
      style={{
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
        fontWeight: '600',
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      {/* Top Group Overbar spanning the whole expression — dissolves away */}
      <div
        style={{
          position: 'absolute',
          top: '-2px',
          left: '4%',
          right: '4%',
          height: '2.5px',
          background: '#8b5cf6',
          borderRadius: '1.5px',
          animation: 'topBarDissolve 0.55s ease-out forwards',
        }}
      />

      {/* Opening paren (dissolves) */}
      <span
        style={{
          color: '#64748b',
          marginRight: '2px',
          animation: 'parenFadeOut 0.5s ease-out forwards',
        }}
      >
        (
      </span>

      {/* Inner Subterms and Operators */}
      <div className="inline-flex items-center">
        {subterms.map((item, idx) => (
          <div key={idx} className="inline-flex items-center">
            {/* Operator between terms */}
            {idx > 0 && (
              <span className="relative inline-flex items-center justify-center px-1.5" style={{ minWidth: '1.2em' }}>
                {/* Old operator dissolving */}
                <span
                  style={{
                    position: 'absolute',
                    color: '#64748b',
                    animation: 'oldOpFadeOut 0.4s ease-out forwards',
                  }}
                >
                  {oldOp}
                </span>

                {/* New operator emerging */}
                <span
                  style={{
                    color: '#8b5cf6',
                    fontWeight: 'bold',
                    animation: 'newOpEmerge 0.65s 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both',
                  }}
                >
                  {newOp}
                </span>
              </span>
            )}

            {/* Subterm with dynamic individual overbar */}
            <div className="inline-flex flex-col items-center relative px-0.5">
              {/* If hadBar was true: Existing overbar cancels and vanishes */}
              {item.hadBar && (
                <span
                  style={{
                    width: '100%',
                    minWidth: '14px',
                    height: '2px',
                    background: '#8b5cf6',
                    borderRadius: '1px',
                    marginBottom: '2px',
                    animation: 'barCancelDissolve 0.6s 0.25s cubic-bezier(0.4, 0, 0.2, 1) forwards',
                  }}
                />
              )}

              {/* If willHaveBar is true: New overbar drops in */}
              {item.willHaveBar && (
                <span
                  style={{
                    width: '100%',
                    minWidth: '14px',
                    height: '2px',
                    background: '#8b5cf6',
                    borderRadius: '1px',
                    marginBottom: '2px',
                    animation: 'barDropIn 0.65s 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both',
                  }}
                />
              )}

              {/* If neither (e.g. double negated subterm resolved): empty spacer */}
              {!item.hadBar && !item.willHaveBar && (
                <span style={{ height: '2px', marginBottom: '2px' }} />
              )}

              {/* Literal Text */}
              <span className="text-text-1 font-semibold">
                {item.v}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Closing paren (dissolves) */}
      <span
        style={{
          color: '#64748b',
          marginLeft: '2px',
          animation: 'parenFadeOut 0.5s ease-out forwards',
        }}
      >
        )
      </span>
    </div>
  )
}

/* ─────────────────────────────────────────────
   2. Distributive Factoring Animation
   Shared factor lifts out to front, parentheses
   materialize, and remainders (with 1) form.
   ───────────────────────────────────────────── */
function DistributiveFactoringAnimation({ rects, data }) {
  const valid = rects.filter(Boolean)
  if (valid.length < 2) return null
  const [r1, r2] = valid

  const factoredVar = data?.factoredVar || 'x'
  const rem1 = data?.rem1 || '1'
  const rem2 = data?.rem2 || 'y'

  const minLeft = Math.min(r1.left, r2.left)
  const dx2 = minLeft - r2.left

  return (
    <>
      {/* Ghost variable from term 2 sliding and merging into the leading factor */}
      <div
        style={{
          position: 'fixed',
          left: r2.left,
          top: r2.top,
          display: 'inline-flex',
          alignItems: 'baseline',
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontSize: r1.fontSize || '22px',
          fontWeight: '600',
          color: '#0ea5e9',
          zIndex: 10000,
          pointerEvents: 'none',
          animation: 'factorSlideIn 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
          '--fact-dx2': `${dx2}px`,
        }}
      >
        <ExprText text={factoredVar} />
      </div>

      {/* Unified correctly-typeset formula: x(1 + y) */}
      <div
        style={{
          position: 'fixed',
          left: minLeft,
          top: r1.top,
          display: 'inline-flex',
          alignItems: 'baseline',
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontSize: r1.fontSize || '22px',
          fontWeight: '600',
          color: '#1a2035',
          zIndex: 9999,
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          lineHeight: 1,
        }}
      >
        {/* Leading factored variable (e.g. x) */}
        <span
          style={{
            color: '#0ea5e9',
            fontWeight: 'bold',
            animation: 'factorLeadPop 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
          }}
        >
          <ExprText text={factoredVar} />
        </span>

        {/* Opening parenthesis `(` */}
        <span
          style={{
            color: '#64748b',
            fontWeight: 'normal',
            margin: '0 0.05em',
            animation: 'parenPop 0.6s 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) both',
          }}
        >
          (
        </span>

        {/* First remainder (e.g. 1 in gold) */}
        <span
          style={{
            color: rem1 === '1' ? '#f59e0b' : '#1a2035',
            fontWeight: rem1 === '1' ? 'bold' : '600',
            animation: rem1 === '1'
              ? 'oneEmerge 0.7s 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both'
              : 'remainderSlide 0.6s 0.35s ease both',
          }}
        >
          <ExprText text={rem1} />
        </span>

        {/* Plus operator ` + ` */}
        <span
          style={{
            color: '#64748b',
            fontWeight: 'normal',
            margin: '0 0.25em',
            animation: 'remainderSlide 0.6s 0.35s ease both',
          }}
        >
          +
        </span>

        {/* Second remainder (e.g. y) */}
        <span
          style={{
            color: rem2 === '1' ? '#f59e0b' : '#1a2035',
            fontWeight: rem2 === '1' ? 'bold' : '600',
            animation: rem2 === '1'
              ? 'oneEmerge 0.7s 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both'
              : 'remainderSlide 0.6s 0.4s ease both',
          }}
        >
          <ExprText text={rem2} />
        </span>

        {/* Closing parenthesis `)` */}
        <span
          style={{
            color: '#64748b',
            fontWeight: 'normal',
            margin: '0 0.05em',
            animation: 'parenPop 0.6s 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both',
          }}
        >
          )
        </span>
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
      <ExprText text={r.astText || r.text} />
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

  const text1 = r1.astText || r1.text
  const text2 = r2.astText || r2.text
  const survivor = text1.length <= text2.length ? r1 : r2
  const absorbed = text1.length <= text2.length ? r2 : r1

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
        <ExprText text={survivor.astText || survivor.text} />
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
        <ExprText text={absorbed.astText || absorbed.text} />
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
        <ExprText text={r1.astText || r1.text} />
      </div>

      <div
        style={{
          ...tokenBaseStyle(r2),
          animation: 'complementSlide2 0.7s cubic-bezier(0.4, 0, 0.2, 1) forwards',
          '--cdx': `${dx2}px`,
          '--cdy': `${dy2}px`,
        }}
      >
        <ExprText text={r2.astText || r2.text} />
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
        <ExprText text={valid[0].astText || valid[0].text} />
      </div>
    )
  }

  const [r1, r2] = valid
  let survivor = r1
  let absorbed = r2

  if (lawId === 'identity') {
    survivor = (r1.astText || r1.text) === '0' ? r2 : r1
    absorbed = (r1.astText || r1.text) === '0' ? r1 : r2
  }

  const dx = survivor.cx - absorbed.cx
  const dy = survivor.cy - absorbed.cy

  return (
    <>
      <div style={{ ...tokenBaseStyle(survivor), animation: 'mergeGlow 0.5s 0.5s ease forwards' }}>
        <ExprText text={survivor.astText || survivor.text} />
      </div>

      <div
        style={{
          ...tokenBaseStyle(absorbed),
          animation: 'slideMerge 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards',
          '--slide-dx': `${dx}px`,
          '--slide-dy': `${dy}px`,
        }}
      >
        <ExprText text={absorbed.astText || absorbed.text} />
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

  const isProduct = lawId.includes('product') || valid.some(r => (r.astText || r.text) === '0' || (r.astText || r.text).includes('0'))
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
  const constRect = ((r1.astText || r1.text) === dominantConst || (r1.astText || r1.text).includes(dominantConst)) ? r1 : r2
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
        <ExprText text={varRect.astText || varRect.text} />
      </div>
    </>
  )
}

