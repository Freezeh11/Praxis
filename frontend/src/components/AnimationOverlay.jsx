import { createElement, useEffect, useState } from 'react'
import { getNode, nodeText } from '../engine/index.js'
import { resolveLawAnimation } from './animations/index.js'

/**
 * AnimationOverlay — renders clean, distinct DOM-level physical transformation animations.
 *
 * Thin host: it measures the DOM nodes addressed by data.paths / data.measurePaths
 * and dispatches to the per-law module registered in ./animations/index.js.
 *
 * Laws Handled:
 *   1. De Morgan's (AND→OR & OR→AND): Overbar snaps in two and lands on subterms while operator transforms.
 *   2. Distributive (Factoring): Shared literal lifts forward to become common front factor.
 *   3. Double Negation: Dual overbars cross-cancel and dissolve.
 *   4. Absorption: Shorter term pulls in and dissolves longer term.
 *   5. Complement: Dual literals collide and burst into constant (1 or 0).
 *   6. Idempotent: Duplicate term slides into survivor and harmonizes.
 *   7. Identity: Inert identity constant dissolves away.
 *   8. Annulment: Variable slides into dominant constant (1 or 0).
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
        const hasGrip = Boolean(el.children && el.children.length >= 2 && el.children[0].innerText?.includes('⠿'))
        const textEl = hasGrip ? el.children[1] : el
        // Measure el directly for bounding box so term capsule borders and paddings align accurately
        const r = el.getBoundingClientRect()
        // Strip out handle icons and extra whitespace to get clean token text
        const cleanText = (textEl.innerText || el.innerText || '').replace(/[⠿\s]+/g, ' ').trim()

        // Extract true mathematical text from AST if available so overbars/primes are preserved
        let astText = cleanText
        if (data.exprBefore) {
          const node = getNode(data.exprBefore, path)
          if (node) {
            astText = nodeText(node)
          }
        }

        const computed = window.getComputedStyle(textEl)

        return {
          left: r.left,
          top: r.top,
          width: r.width,
          height: r.height,
          cx: r.left + r.width / 2,
          cy: r.top + r.height / 2,
          text: cleanText,
          astText: astText,
          fontSize: computed.fontSize,
          fontWeight: computed.fontWeight,
          fontFamily: computed.fontFamily,
          lineHeight: computed.lineHeight,
        }
      })
      setRects(measured)
    })
    return () => cancelAnimationFrame(id)
  }, [data])

  if (!data || !rects) return null

  const lawId = data.lawId || ''
  const lawAnimation = resolveLawAnimation(lawId)

  return (
    <div className="fixed top-0 left-0 w-screen h-screen z-[9999] pointer-events-none">
      {lawAnimation && createElement(lawAnimation, { rects, data, lawId })}
    </div>
  )
}
