/**
 * POS laws — the rewrites offered when two nodes inside the same PRODUCT are
 * selected (the duals of the SOP laws), plus the sandbox-only expansion.
 *
 * Order matches the original implementation:
 *   1 Distributive (POS)  2 Complement  3 Idempotent  4 Absorption
 *   5 Annulment           6 Distributive (Expand, gated)
 *
 * Pure module: no React/DOM/network.
 */
import { cloneN, con, lit, prod, sum } from '../node.js'
import { getNode, sumContainsLit } from '../tree.js'
import { nodeText } from '../render.js'
import { normalize, normalizeFlat } from '../normalize.js'
import { removeLitFromSumNode } from '../tree.js'
import { defineLaw, LAW_FORM } from './definitions.js'
import { absorbsInProduct, findExpandablePair, termsEq } from './helpers.js'

/** Builds the productive Distributive-EXPANSION law for a detected pair. */
function expandLaw(expr, prodPath, pair) {
  const { litNode, clauseNode, litIndex, sumIndex } = pair
  const litText = nodeText(litNode)
  const clauseText = nodeText(clauseNode)
  const distributed = clauseNode.terms.map(t => nodeText(prod(cloneN(litNode), cloneN(t)))).join(' + ')

  return {
    ...defineLaw('Distributive (Expand)', LAW_FORM.PRODUCT),
    desc: `Distribute ${litText} over ${clauseText} → ${distributed}`,
    // Deliberately empty. AnimationOverlay has no 'distributive-expand' branch,
    // and measurePaths/factoredVar belong to the *factoring* animation, which
    // would misread this law. Empty animPaths keeps the generic path: the
    // overlay renders only its empty container and the expression simply
    // updates to the distributed form.
    animPaths: [],
    litPath: `${prodPath}.${litIndex}`,
    clausePath: `${prodPath}.${sumIndex}`,
    distributedText: distributed,
    apply: () => {
      const tree = cloneN(expr)
      const pn = getNode(tree, prodPath)
      const nl = pn.factors[litIndex]
      const ns = pn.factors[sumIndex]
      const rest = pn.factors.filter((_, k) => k !== litIndex && k !== sumIndex)
      const expanded = normalizeFlat(sum(...ns.terms.map(t => prod(cloneN(nl), cloneN(t)))))
      pn.factors = [...rest, expanded]
      return normalizeFlat(tree)
    },
  }
}

/**
 * @param {object} ctx
 * @param {object} ctx.expr  expression the selection was made in
 * @param {object} ctx.cp    { prodPath, prodNode, fi1, fi2 } from findCommonProd
 * @param {object} ctx.n1    first selected node
 * @param {object} ctx.n2    second selected node
 * @param {string} ctx.p1    first selected path
 * @param {string} ctx.p2    second selected path
 * @param {boolean} ctx.bothTermSel whether both selections are whole terms
 * @param {boolean} ctx.allowExpand sandbox-only Distributive (Expand) opt-in
 * @returns {Array<object>} applicable laws, in display order
 */
export function productLaws({ expr, cp, n1, n2, p1, p2, bothTermSel, allowExpand }) {
  const laws = []
  const f1 = cp.prodNode.factors[cp.fi1]
  const f2 = cp.prodNode.factors[cp.fi2]
  if (!f1 || !f2) return laws

  // 1. DUAL DISTRIBUTIVE: common literal in both sum clauses ((A+B)(A+C) = A + BC)
  if (!bothTermSel && n1.type === 'lit' && n2.type === 'lit' && n1.v === n2.v && n1.n === n2.n) {
    if (f1.type === 'sum' && f2.type === 'sum' && sumContainsLit(f1, n1.v, n1.n) && sumContainsLit(f2, n2.v, n2.n)) {
      const r1 = removeLitFromSumNode(f1, n1.v, n1.n)
      const r2 = removeLitFromSumNode(f2, n2.v, n2.n)
      const isF1Bare = r1.type === 'const' && r1.val === 0
      const isF2Bare = r2.type === 'const' && r2.val === 0

      if (!isF1Bare && !isF2Bare) {
        const vLabel = n1.n ? n1.v + "'" : n1.v
        const rem1Text = nodeText(r1)
        const rem2Text = nodeText(r2)

        laws.push({
          ...defineLaw('Distributive (POS)', LAW_FORM.PRODUCT),
          desc: `Factor out ${vLabel} → ${vLabel} + (${rem1Text})(${rem2Text})`,
          animPaths: [`${cp.prodPath}.${cp.fi1}`, `${cp.prodPath}.${cp.fi2}`],
          measurePaths: [`${cp.prodPath}.${cp.fi1}`, `${cp.prodPath}.${cp.fi2}`, p1, p2],
          factoredVar: vLabel,
          rem1: rem1Text,
          rem2: rem2Text,
          apply: () => {
            const tree = cloneN(expr)
            const pn = getNode(tree, cp.prodPath)
            const newFactors = pn.factors.filter((_, k) => k !== cp.fi1 && k !== cp.fi2)
            const nr1 = removeLitFromSumNode(cloneN(f1), n1.v, n1.n)
            const nr2 = removeLitFromSumNode(cloneN(f2), n2.v, n2.n)
            const combined = prod(nr1, nr2)
            newFactors.push(sum(lit(n1.v, n1.n), combined))
            pn.factors = newFactors
            return normalizeFlat(tree)
          },
        })
      }
    }
  }

  // 2. DUAL COMPLEMENT IN PRODUCT: A · A' = 0
  if (n1.type === 'lit' && n2.type === 'lit' && n1.v === n2.v && n1.n !== n2.n) {
    if (f1.type === 'lit' && f2.type === 'lit') {
      const vLabel1 = n1.n ? n1.v + "'" : n1.v
      const vLabel2 = n2.n ? n2.v + "'" : n2.v
      laws.push({
        ...defineLaw('Complement Law (Product)', LAW_FORM.PRODUCT),
        desc: `${vLabel1} · ${vLabel2} = 0`,
        animPaths: [`${cp.prodPath}.${cp.fi1}`, `${cp.prodPath}.${cp.fi2}`],
        lit1Text: vLabel1,
        lit2Text: vLabel2,
        resultConst: '0',
        apply: () => {
          const tree = cloneN(expr)
          const pn = getNode(tree, cp.prodPath)
          const newFactors = pn.factors.filter((_, k) => k !== cp.fi1 && k !== cp.fi2)
          newFactors.push(con(0))
          pn.factors = newFactors
          return normalizeFlat(tree)
        },
      })
    }
  }

  // 3. DUAL IDEMPOTENT: (A+B)(A+B) = A+B or A · A = A
  if (termsEq(f1, f2)) {
    const factorText = nodeText(f1)
    const formattedText = f1.type === 'sum' ? `(${factorText})` : factorText
    laws.push({
      ...defineLaw('Idempotent Law (Product)', LAW_FORM.PRODUCT),
      desc: `(${factorText})(${factorText}) = ${factorText}`,
      animPaths: [`${cp.prodPath}.${cp.fi1}`, `${cp.prodPath}.${cp.fi2}`],
      survivorPath: `${cp.prodPath}.${cp.fi1}`,
      duplicatePath: `${cp.prodPath}.${cp.fi2}`,
      termText: formattedText,
      apply: () => {
        const tree = cloneN(expr)
        const pn = getNode(tree, cp.prodPath)
        pn.factors = pn.factors.filter((_, k) => k !== cp.fi2)
        return normalize(tree)
      },
    })
  }

  // 4. DUAL ABSORPTION: A(A+B) = A or (A+B)(A+B+C) = A+B: semantic decision.
  if (!termsEq(f1, f2) && absorbsInProduct(f1, f2)) {
    const sText = nodeText(f1)
    const aText = nodeText(f2)
    const survivorFormatted = f1.type === 'sum' ? `(${sText})` : sText
    const absorbedFormatted = f2.type === 'sum' ? `(${aText})` : aText
    laws.push({
      ...defineLaw('Absorption Law (Product)', LAW_FORM.PRODUCT),
      desc: `${survivorFormatted} absorbs ${absorbedFormatted} → ${survivorFormatted}`,
      animPaths: [`${cp.prodPath}.${cp.fi1}`, `${cp.prodPath}.${cp.fi2}`],
      survivorPath: `${cp.prodPath}.${cp.fi1}`,
      absorbedPath: `${cp.prodPath}.${cp.fi2}`,
      survivorText: survivorFormatted,
      absorbedText: absorbedFormatted,
      isProduct: true,
      apply: () => {
        const tree = cloneN(expr)
        const pn = getNode(tree, cp.prodPath)
        pn.factors = pn.factors.filter((_, k) => k !== cp.fi2)
        return normalize(tree)
      },
    })
  }
  if (!termsEq(f1, f2) && absorbsInProduct(f2, f1)) {
    const sText = nodeText(f2)
    const aText = nodeText(f1)
    const survivorFormatted = f2.type === 'sum' ? `(${sText})` : sText
    const absorbedFormatted = f1.type === 'sum' ? `(${aText})` : aText
    laws.push({
      ...defineLaw('Absorption Law (Product)', LAW_FORM.PRODUCT),
      desc: `${survivorFormatted} absorbs ${absorbedFormatted} → ${survivorFormatted}`,
      animPaths: [`${cp.prodPath}.${cp.fi1}`, `${cp.prodPath}.${cp.fi2}`],
      survivorPath: `${cp.prodPath}.${cp.fi2}`,
      absorbedPath: `${cp.prodPath}.${cp.fi1}`,
      survivorText: survivorFormatted,
      absorbedText: absorbedFormatted,
      isProduct: true,
      apply: () => {
        const tree = cloneN(expr)
        const pn = getNode(tree, cp.prodPath)
        pn.factors = pn.factors.filter((_, k) => k !== cp.fi1)
        return normalize(tree)
      },
    })
  }

  // 5. DUAL ANNULMENT: A · 0 = 0 — pairwise absorption by 0
  if ((f1.type === 'const' && f1.val === 0) || (f2.type === 'const' && f2.val === 0)) {
    const isF1Const = f1.type === 'const' && f1.val === 0
    const varFactor = isF1Const ? f2 : f1
    const constPath = isF1Const ? `${cp.prodPath}.${cp.fi1}` : `${cp.prodPath}.${cp.fi2}`
    const varPath = isF1Const ? `${cp.prodPath}.${cp.fi2}` : `${cp.prodPath}.${cp.fi1}`
    const varText = nodeText(varFactor)
    const varIndex = isF1Const ? cp.fi2 : cp.fi1

    laws.push({
      ...defineLaw('Annulment Law (Product)', LAW_FORM.PRODUCT),
      desc: `${varText} · 0 = 0: ${varText} eliminated by 0`,
      animPaths: [`${cp.prodPath}.${cp.fi1}`, `${cp.prodPath}.${cp.fi2}`],
      dominantConst: '0',
      constPath,
      varPath,
      varText,
      apply: () => {
        const tree = cloneN(expr)
        const pn = getNode(tree, cp.prodPath)
        pn.factors = pn.factors.filter((_, k) => k !== varIndex)
        return normalizeFlat(tree)
      },
    })
  }

  // 6. DISTRIBUTIVE (EXPAND) — GATED by options.allowExpand (sandbox only).
  //    A(B + A') = AB + AA' — a bare literal factor times a sibling sum
  //    clause that contains its complement.
  if (allowExpand) {
    const pair = findExpandablePair(cp.prodNode, cp.fi1, cp.fi2)
    if (pair) laws.push(expandLaw(expr, cp.prodPath, pair))
  }

  return laws
}
