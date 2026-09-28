/**
 * Constant laws — what a selected 0 or 1 collapses to.
 *
 * Inside a SUM:  A + 0 = A (Identity)   A + 1 = 1 (Annulment)
 * Inside a PROD: A · 1 = A (Identity)   A · 0 = 0 (Annulment)
 *
 * These fire on a single selected constant, not on a pair, which is why they
 * live apart from the pairwise SOP/POS builders.
 *
 * Pure module: no React/DOM/network.
 */
import { cloneN, con } from '../node.js'
import { getNode, setNode } from '../tree.js'
import { nodeText } from '../render.js'
import { normalize, normalizeFlat } from '../normalize.js'
import { defineLaw, LAW_FORM } from './definitions.js'

/** A constant inside a sum: 0 disappears, 1 absorbs the whole sum. */
export function sumConstLaws(expr, constPath, constVal, sumPath) {
  const laws = []
  const idx = parseInt(constPath.split('.').pop(), 10)
  if (constVal === 0) {
    const parentSum = getNode(expr, sumPath)
    const activeTerms = parentSum ? parentSum.terms.filter((_, i) => i !== idx) : []
    const activeText = activeTerms.map(t => nodeText(t)).join(' + ')
    laws.push({
      ...defineLaw('Identity Law', LAW_FORM.SUM),
      desc: `${activeText || 'A'} + 0 = ${activeText || 'A'} — remove 0`,
      animPaths: [constPath],
      activeText,
      constText: '0',
      apply: () => {
        const tree = cloneN(expr)
        const s = getNode(tree, sumPath)
        const nt = s.terms.filter((_, i) => i !== idx)
        const result = nt.length === 1 ? nt[0] : { type: 'sum', terms: nt }
        if (sumPath === 'R') return normalizeFlat(result)
        setNode(tree, sumPath, result)
        return normalizeFlat(tree)
      },
    })
  }
  if (constVal === 1) {
    laws.push({
      ...defineLaw('Annulment Law', LAW_FORM.SUM),
      desc: 'A + 1 = 1 — anything OR 1 is 1',
      animPaths: [sumPath],
      dominantConst: '1',
      apply: () => {
        const tree = cloneN(expr)
        if (sumPath === 'R') return con(1)
        setNode(tree, sumPath, con(1))
        return normalize(tree)
      },
    })
  }
  return laws
}

/** A constant inside a product: 1 disappears, 0 absorbs the whole product. */
export function productConstLaws(expr, constPath, constVal, prodPath) {
  const laws = []
  const idx = parseInt(constPath.split('.').pop(), 10)
  if (constVal === 1) {
    const parentProd = getNode(expr, prodPath)
    const activeFactors = parentProd ? parentProd.factors.filter((_, i) => i !== idx) : []
    const activeText = activeFactors.map(f => (f.type === 'sum' ? '(' + nodeText(f) + ')' : nodeText(f))).join('')
    laws.push({
      ...defineLaw('Identity Law', LAW_FORM.PRODUCT),
      desc: `${activeText || 'A'} · 1 = ${activeText || 'A'} — remove 1`,
      animPaths: [constPath],
      activeText,
      constText: '1',
      apply: () => {
        const tree = cloneN(expr)
        const p = getNode(tree, prodPath)
        const nf = p.factors.filter((_, i) => i !== idx)
        const result = nf.length === 1 ? nf[0] : { type: 'prod', factors: nf }
        if (prodPath === 'R') return normalizeFlat(result)
        setNode(tree, prodPath, result)
        return normalizeFlat(tree)
      },
    })
  }
  if (constVal === 0) {
    laws.push({
      ...defineLaw('Annulment Law (Product)', LAW_FORM.PRODUCT),
      desc: 'A · 0 = 0 — anything times 0 is 0',
      animPaths: [prodPath],
      dominantConst: '0',
      apply: () => {
        const tree = cloneN(expr)
        if (prodPath === 'R') return con(0)
        setNode(tree, prodPath, con(0))
        return normalize(tree)
      },
    })
  }
  return laws
}
