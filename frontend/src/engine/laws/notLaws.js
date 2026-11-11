/**
 * Single-node NOT laws — what a selected negation can become.
 *
 *   ( A' )'   -> A                       Double Negation
 *   ( A·B )'  -> A' + B'                 De Morgan's (AND→OR)
 *   ( A+B )'  -> A' · B'                 De Morgan's (OR→AND)
 *
 * Pure module: no React/DOM/network.
 */
import { cloneN, lit, neg, prod, sum } from '../node.js'
import { getNode, setNode } from '../tree.js'
import { nodeText } from '../render.js'
import { normalize } from '../normalize.js'
import { defineLaw, LAW_FORM } from './definitions.js'

/**
 * @param {object} expr expression the node belongs to
 * @param {string} path path of the selected `not` node
 * @returns {Array<object>} applicable laws
 */
export function notLaws(expr, path) {
  const node = getNode(expr, path)
  if (!node || node.type !== 'not') return []
  const child = node.child
  const laws = []

  // 1. Double Negation: (A')' = A
  if (child.type === 'not') {
    const r = cloneN(child.child)
    const coreText = nodeText(r)
    laws.push({
      ...defineLaw('Double Negation', LAW_FORM.NODE),
      desc: `(${nodeText(child)})' = ${coreText}`,
      animPaths: [path],
      coreText,
      rawChildText: nodeText(child),
      apply: () => {
        const tree = cloneN(expr)
        return normalize(setNode(tree, path, r))
      },
    })
  }

  // 2. De Morgan's AND: (ABCD...)' = A' + B' + C' + D'...
  if (child.type === 'prod') {
    const deMorganTerms = child.factors.map(f => {
      if (f.type === 'lit') {
        return { v: f.v, hadBar: f.n, willHaveBar: !f.n }
      }
      const t = nodeText(f)
      const hadBar = f.type === 'not' || t.endsWith("'")
      return {
        v: hadBar && f.type === 'not' ? nodeText(f.child) : t.replace(/'$/, ''),
        hadBar,
        willHaveBar: !hadBar,
      }
    })
    const expanded = sum(
      ...child.factors.map(f => (f.type === 'lit' ? lit(f.v, !f.n) : neg(cloneN(f))))
    )
    laws.push({
      ...defineLaw("De Morgan's (AND→OR)", LAW_FORM.NODE),
      desc: `${nodeText(node)} = ${nodeText(expanded)}`,
      animPaths: [path],
      deMorganTerms,
      isAndToOr: true,
      apply: () => {
        const tree = cloneN(expr)
        return normalize(setNode(tree, path, cloneN(expanded)))
      },
    })
  }

  // 3. De Morgan's OR: (A+B+C+D...)' = A'B'C'D'...
  if (child.type === 'sum') {
    const deMorganTerms = child.terms.map(t => {
      if (t.type === 'lit') {
        return { v: t.v, hadBar: t.n, willHaveBar: !t.n }
      }
      const text = nodeText(t)
      const hadBar = t.type === 'not' || text.endsWith("'")
      return {
        v: hadBar && t.type === 'not' ? nodeText(t.child) : text.replace(/'$/, ''),
        hadBar,
        willHaveBar: !hadBar,
      }
    })
    const expanded = prod(
      ...child.terms.map(t => (t.type === 'lit' ? lit(t.v, !t.n) : neg(cloneN(t))))
    )
    laws.push({
      ...defineLaw("De Morgan's (OR→AND)", LAW_FORM.NODE),
      desc: `${nodeText(node)} = ${nodeText(expanded)}`,
      animPaths: [path],
      deMorganTerms,
      isAndToOr: false,
      apply: () => {
        const tree = cloneN(expr)
        return normalize(setNode(tree, path, cloneN(expanded)))
      },
    })
  }

  return laws
}
