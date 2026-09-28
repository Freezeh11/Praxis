// Distributive factoring: the shared factor lifts out to the front, parentheses
// materialize, and the remainders (one of which may be 1) slide into place.
// Reads: data.factoredVar, data.rem1, data.rem2, data.outerPrefix, data.outerSuffix,
// data.formula, data.lawName.
import ExprText from '../ExprText.jsx'
import { ghostTextStyle } from './animationStyles.js'

/* ─────────────────────────────────────────────
   2. Distributive Factoring Animation
   Shared factor lifts out to front, parentheses
   materialize, and remainders (with 1) form.
   ───────────────────────────────────────────── */
export default function DistributiveFactoringAnimation({ rects, data }) {
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
        style={ghostTextStyle(ghostRect, {
          fontSize: r1.fontSize || '22px',
          color: '#0ea5e9',
          zIndex: 10000,
          animation: 'factorSlideIn 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
          '--fact-dx2': `${dx2}px`,
        })}
      >
        <ExprText text={factoredVar} />
      </div>

      {/* Unified correctly-typeset formula: outerPrefix + x(rem1 + rem2) + outerSuffix */}
      <div
        style={ghostTextStyle(r1, {
          left: minLeft,
          color: '#1a2035',
          whiteSpace: 'nowrap',
          lineHeight: 1,
        })}
      >
        {/* Outer prefix if nested inside a parent product */}
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

        {data?.formula?.includes('A + BC') || data?.lawName?.includes('POS') ? (
          <>
            {/* POS Dual Distributive: A + (rem1)(rem2) */}
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
                color: '#1a2035',
                fontWeight: '600',
                animation: 'remainderSlide 0.6s 0.35s ease both',
              }}
            >
              <ExprText text={rem1 && rem2 && (rem1.includes('+') || rem1.length > 1) ? `(${rem1})` : rem1} />
              <ExprText text={rem1 && rem2 && (rem2.includes('+') || rem2.length > 1) ? `(${rem2})` : rem2} />
            </span>
          </>
        ) : (
          <>
            {/* SOP Distributive: A(rem1 + rem2) */}
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
