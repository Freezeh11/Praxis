// De Morgan's law: the top group overbar dissolves, the operator flips (· ↔ +),
// existing overbars cancel away and fresh overbars drop onto the unbarred subterms.
// Reads: lawId, data.isAndToOr, data.deMorganTerms, data.exprBefore, data.paths.
import { getNode, nodeText } from '../../engine/index.js'

/* ─────────────────────────────────────────────
   1. De Morgan's Law Animation
   Top group overbar dissolves away, old operator dissolves,
   existing overbars cancel/vanish, new overbars drop onto
   unbarred terms, and the new operator emerges.
   ───────────────────────────────────────────── */
export default function DeMorganSplitAnimation({ rects, data, lawId }) {
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
