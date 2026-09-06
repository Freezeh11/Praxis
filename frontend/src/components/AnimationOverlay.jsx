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
      const pathsToMeasure = data.measurePaths || data.paths
      const measured = pathsToMeasure.map(path => {
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
      {(lawId === 'distributive' || lawId === 'distributive-pos') && <DistributiveFactoringAnimation rects={rects} data={data} />}
      {lawId === 'double-neg' && <DoubleNegationAnimation rects={rects} data={data} />}
      {lawId === 'absorption' && <AbsorptionSuctionAnimation rects={rects} data={data} />}
      {lawId === 'complement' && <ComplementBurstAnimation rects={rects} data={data} />}
      {lawId.startsWith('annulment') && <AnnulmentAnimation rects={rects} lawId={lawId} data={data} />}
      {lawId === 'idempotent' && <IdempotentAnimation rects={rects} data={data} />}
      {lawId === 'identity' && <IdentityAnimation rects={rects} data={data} />}
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
  if (valid.length === 0) return null
  const r1 = valid[0]
  const r2 = valid[1] || r1

  const factoredVar = data?.factoredVar || 'x'
  const rem1 = data?.rem1 || '1'
  const rem2 = data?.rem2 || 'y'
  const outerPrefix = data?.outerPrefix || ''
  const outerSuffix = data?.outerSuffix || ''

  const minLeft = outerPrefix ? r1.left : Math.min(r1.left, r2.left)
  const ghostRect = valid[3] || valid[1] || r2
  const ghostStartLeft = ghostRect.left

  // If outerPrefix exists, factor target lands right after the prefix characters
  const fontSizeNum = parseFloat(r1.fontSize || '22')
  const charWidth = fontSizeNum * 0.58
  const targetX = outerPrefix ? minLeft + (outerPrefix.length * charWidth) : minLeft
  const dx2 = targetX - ghostStartLeft

  return (
    <>
      {/* Ghost variable from term 2 sliding and merging into the factored variable position */}
      <div
        style={{
          position: 'fixed',
          left: ghostStartLeft,
          top: ghostRect.top,
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

      {/* Unified correctly-typeset formula: outerPrefix + x(rem1 + rem2) + outerSuffix */}
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
        {/* Outer prefix if nested inside a parent product (e.g. x in x(y'z + yz)) */}
        {outerPrefix && (
          <span style={{ color: '#1a2035', fontWeight: '600' }}>
            <ExprText text={outerPrefix} />
          </span>
        )}

        {/* Factored variable (e.g. z or x) */}
        <span
          style={{
            color: '#0ea5e9',
            fontWeight: 'bold',
            animation: 'factorLeadPop 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
          }}
        >
          <ExprText text={factoredVar} />
        </span>

        {data?.lawId === 'distributive-pos' ? (
          <>
            {/* POS Distributive: A + BC */}
            <span
              style={{
                color: '#64748b',
                fontWeight: 'normal',
                margin: '0 0.25em',
                animation: 'remainderSlide 0.6s 0.25s ease both',
              }}
            >
              +
            </span>
            <span
              style={{
                color: rem1 === '0' ? '#f59e0b' : '#1a2035',
                fontWeight: rem1 === '0' ? 'bold' : '600',
                animation: 'remainderSlide 0.6s 0.35s ease both',
              }}
            >
              <ExprText text={rem1} />
            </span>
            <span
              style={{
                color: rem2 === '0' ? '#f59e0b' : '#1a2035',
                fontWeight: rem2 === '0' ? 'bold' : '600',
                animation: 'remainderSlide 0.6s 0.4s ease both',
              }}
            >
              <ExprText text={rem2} />
            </span>
          </>
        ) : (
          <>
            {/* SOP Distributive: A(B + C) */}
            {/* Opening parenthesis `(` */}
            <span
              style={{
                color: '#64748b',
                fontWeight: 'normal',
                margin: '0 0.05em',
                animation: outerPrefix
                  ? 'none'
                  : 'parenPop 0.6s 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) both',
              }}
            >
              (
            </span>

            {/* First remainder (e.g. 1 in gold or y') */}
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
                animation: outerPrefix
                  ? 'none'
                  : 'parenPop 0.6s 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both',
              }}
            >
              )
            </span>
          </>
        )}

        {/* Outer suffix if any */}
        {outerSuffix && (
          <span style={{ color: '#1a2035', fontWeight: '600' }}>
            <ExprText text={outerSuffix} />
          </span>
        )}
      </div>
    </>
  )
}

/* ─────────────────────────────────────────────
   3. Double Negation Animation
   (A')' = A — dual bars cancel and dissolve
   ───────────────────────────────────────────── */
function DoubleNegationAnimation({ rects, data }) {
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

/* ─────────────────────────────────────────────
   4. Absorption Suction Animation
   Shorter term draws in and dissolves longer term
   ───────────────────────────────────────────── */
function AbsorptionSuctionAnimation({ rects, data }) {
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

  const survivorLits = survivorText.match(/[a-zA-Z]'?/g) || [survivorText]
  const absorbedLits = absorbedText.match(/[a-zA-Z]'?/g) || [absorbedText]

  const dx = survivor.cx - absorbed.cx
  const dy = survivor.cy - absorbed.cy

  return (
    <>
      {/* Expanding emerald shockwave on absorption impact */}
      <div
        style={{
          position: 'fixed',
          left: survivor.cx,
          top: survivor.cy,
          width: Math.max(survivor.width, 36) + 16,
          height: Math.max(survivor.height, 36) + 16,
          borderRadius: '9999px',
          pointerEvents: 'none',
          zIndex: 9998,
          animation: 'absorbShockwave 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        }}
      />

      {/* Survivor (Absorber) — glowing emerald container with energy pulse */}
      <div
        style={{
          position: 'fixed',
          left: survivor.left,
          top: survivor.top,
          display: 'inline-flex',
          alignItems: 'baseline',
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontSize: survivor.fontSize || '22px',
          fontWeight: '600',
          color: '#059669',
          padding: '2px 6px',
          borderRadius: '6px',
          border: '1.5px solid #10b981',
          background: 'rgba(16, 185, 129, 0.08)',
          zIndex: 9999,
          pointerEvents: 'none',
          animation: 'absorbSurvivorPulse 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        }}
      >
        <ExprText text={survivorText} />
      </div>

      {/* Absorbed Term (Victim) — split into evaporating extras and gliding core payload */}
      <div
        style={{
          position: 'fixed',
          left: absorbed.left,
          top: absorbed.top,
          display: 'inline-flex',
          alignItems: 'baseline',
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontSize: absorbed.fontSize || '22px',
          fontWeight: '600',
          padding: '2px 6px',
          zIndex: 10000,
          pointerEvents: 'none',
          '--abs-dx': `${dx}px`,
          '--abs-dy': `${dy}px`,
        }}
      >
        {absorbedLits.map((lit, idx) => {
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
        })}
      </div>
    </>
  )
}

/* ─────────────────────────────────────────────
   5. Complement Burst Animation
   A and A' collide at midpoint and burst into 1 (or 0)
   ───────────────────────────────────────────── */
function ComplementBurstAnimation({ rects, data }) {
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

/* ─────────────────────────────────────────────
   6. Idempotent Animation (A + A = A and A · A = A)
   Duplicate term slides into survivor and harmonizes.
   ───────────────────────────────────────────── */
function IdempotentAnimation({ rects, data }) {
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
        style={{
          position: 'fixed',
          left: survivor.cx,
          top: survivor.cy,
          width: Math.max(survivor.width, 36) + 16,
          height: Math.max(survivor.height, 36) + 16,
          borderRadius: '9999px',
          pointerEvents: 'none',
          zIndex: 9998,
          animation: 'idempotentShockwave 1.2s 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          opacity: 0,
        }}
      />

      {/* Survivor Term receiving the harmonic unification */}
      <div
        style={{
          position: 'fixed',
          left: survivor.left,
          top: survivor.top,
          display: 'inline-flex',
          alignItems: 'baseline',
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontSize: survivor.fontSize || '22px',
          fontWeight: '600',
          color: '#4f46e5',
          padding: '2px 6px',
          borderRadius: '6px',
          border: '1.5px solid #6366f1',
          background: 'rgba(99, 102, 241, 0.08)',
          zIndex: 9999,
          pointerEvents: 'none',
          animation: 'idempotentSurvivorPulse 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        }}
      >
        <ExprText text={termText} />
      </div>

      {/* Duplicate Term sliding into survivor */}
      <div
        style={{
          position: 'fixed',
          left: duplicate.left,
          top: duplicate.top,
          display: 'inline-flex',
          alignItems: 'baseline',
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontSize: duplicate.fontSize || '22px',
          fontWeight: '600',
          color: '#6366f1',
          padding: '2px 6px',
          zIndex: 10000,
          pointerEvents: 'none',
          '--idem-dx': `${dx}px`,
          '--idem-dy': `${dy}px`,
          animation: 'idempotentGlideMerge 0.9s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        }}
      >
        <ExprText text={termText} />
      </div>
    </>
  )
}

/* ─────────────────────────────────────────────
   7. Identity Animation (A + 0 = A and A · 1 = A)
   Inert identity constant dissolves away.
   ───────────────────────────────────────────── */
function IdentityAnimation({ rects, data }) {
  const valid = rects.filter(Boolean)
  if (valid.length === 0) return null

  // Single const factor in product e.g. A · 1 = A
  if (valid.length === 1) {
    const r = valid[0]
    const constText = data?.constText || '1'
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
          color: '#94a3b8',
          padding: '2px 6px',
          zIndex: 9999,
          pointerEvents: 'none',
          animation: 'identityConstEvaporate 0.85s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        }}
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
        style={{
          position: 'fixed',
          left: activeRect.left,
          top: activeRect.top,
          display: 'inline-flex',
          alignItems: 'baseline',
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontSize: activeRect.fontSize || '22px',
          fontWeight: '600',
          color: '#0284c7',
          padding: '2px 6px',
          borderRadius: '6px',
          border: '1.5px solid #0ea5e9',
          background: 'rgba(14, 165, 233, 0.08)',
          zIndex: 9999,
          pointerEvents: 'none',
          animation: 'identityActivePulse 1.0s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        }}
      >
        <ExprText text={activeText} />
      </div>

      {/* Inert Identity Constant (0) dropping and evaporating */}
      <div
        style={{
          position: 'fixed',
          left: constRect.left,
          top: constRect.top,
          display: 'inline-flex',
          alignItems: 'baseline',
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontSize: constRect.fontSize || '22px',
          fontWeight: '600',
          color: '#94a3b8',
          padding: '2px 6px',
          zIndex: 10000,
          pointerEvents: 'none',
          animation: 'identityConstEvaporate 0.85s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        }}
      >
        <ExprText text={constText} />
      </div>
    </>
  )
}

/* ─────────────────────────────────────────────
   7. Annulment Animation (A + 1 = 1 and A · 0 = 0)
   Variable slides into the dominant constant.
   ───────────────────────────────────────────── */
function AnnulmentAnimation({ rects, lawId, data }) {
  const valid = rects.filter(Boolean)
  if (valid.length === 0) return null

  const isProduct = lawId.includes('product') || valid.some(r => (r.astText || r.text) === '0' || (r.astText || r.text).includes('0'))
  const dominantConst = data?.dominantConst || (isProduct ? '0' : '1')
  const isOne = dominantConst === '1'

  const themeColor = isOne ? '#d97706' : '#6366f1'
  const shockColor = isOne ? '#f59e0b' : '#818cf8'
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

