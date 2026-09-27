/**
 * SOP laws — the six rewrites offered when two nodes inside the same SUM are
 * selected.
 *
 * Order matters: the returned array is exactly the order the law panel shows and
 * the order the hint scanner prefers, so it matches the original single-file
 * implementation:
 *   1 Distributive (Factor)  2 Complement  3 Identity  4 Annulment
 *   5 Idempotent             6 Absorption
 *
 * Pure module: no React/DOM/network.
 */
import { cloneN, con, lit, prod, sum } from '../node.js'
import { getNode } from '../tree.js'
import { nodeText } from '../render.js'
import { normalize, normalizeFlat } from '../normalize.js'
import { removeLitFromNode, termContainsLit } from '../tree.js'
import { defineLaw, LAW_FORM } from './definitions.js'
import { getLits, isSubT, termsEq } from './helpers.js'

/**
 * @param {object} ctx
 * @param {object} ctx.expr  expression the selection was made in
 * @param {object} ctx.cs    { sumPath, sumNode, ti1, ti2 } from findCommonSum
 * @param {object} ctx.n1    first selected node
 * @param {object} ctx.n2    second selected node
 * @param {string} ctx.p1    first selected path
 * @param {string} ctx.p2    second selected path
 * @param {boolean} ctx.bothTermSel whether both selections are whole terms
 * @returns {Array<object>} applicable laws, in display order
 */
export function sumLaws({ expr, cs, n1, n2, p1, p2, bothTermSel }) {
  const laws = []
  const t1 = cs.sumNode.terms[cs.ti1]
  const t2 = cs.sumNode.terms[cs.ti2]
  if (!t1 || !t2) return laws

  // 1. DISTRIBUTIVE (FACTOR): common literal in both terms (neither term is a
  //    bare single literal)
  if (!bothTermSel && n1.type === 'lit' && n2.type === 'lit' && n1.v === n2.v && n1.n === n2.n) {
    if (termContainsLit(t1, n1.v, n1.n) && termContainsLit(t2, n2.v, n2.n)) {
      const r1 = removeLitFromNode(t1, n1.v, n1.n)
      const r2 = removeLitFromNode(t2, n2.v, n2.n)
      const isT1Bare = r1.type === 'const' && r1.val === 1
      const isT2Bare = r2.type === 'const' && r2.val === 1

      if (!isT1Bare && !isT2Bare) {
        const vLabel = n1.n ? n1.v + "'" : n1.v

        // Check if cs.sumNode is nested inside a parent prod
        let parentPath
        let outerPrefix = ''
        let outerSuffix = ''
        let animPaths = [`${cs.sumPath}.${cs.ti1}`, `${cs.sumPath}.${cs.ti2}`]
        let measurePaths = [`${cs.sumPath}.${cs.ti1}`, `${cs.sumPath}.${cs.ti2}`, p1, p2]

        if (cs.sumPath !== 'R' && cs.sumNode.terms.length === 2) {
          const lastDot = cs.sumPath.lastIndexOf('.')
          parentPath = lastDot > 0 ? cs.sumPath.slice(0, lastDot) : 'R'
          const parent = getNode(expr, parentPath)
          if (parent && parent.type === 'prod') {
            const sumIndexInParent = parseInt(cs.sumPath.slice(lastDot + 1), 10)
            const prefixFactors = parent.factors.slice(0, sumIndexInParent)
            const suffixFactors = parent.factors.slice(sumIndexInParent + 1)
            outerPrefix = prefixFactors.map(f => (f.type === 'sum' ? '(' + nodeText(f) + ')' : nodeText(f))).join('')
            outerSuffix = suffixFactors.map(f => (f.type === 'sum' ? '(' + nodeText(f) + ')' : nodeText(f))).join('')
            animPaths = [parentPath]
            measurePaths = [parentPath, `${cs.sumPath}.${cs.ti2}`, p1, p2]
          }
        }

        laws.push({
          ...defineLaw('Distributive (Factor)', LAW_FORM.SUM),
          desc: `Factor out ${vLabel} → ${outerPrefix}${vLabel}(${nodeText(r1)} + ${nodeText(r2)})${outerSuffix}`,
          animPaths,
          measurePaths,
          factoredVar: vLabel,
          rem1: nodeText(r1),
          rem2: nodeText(r2),
          outerPrefix,
          outerSuffix,
          apply: () => {
            const tree = cloneN(expr)
            const sn = getNode(tree, cs.sumPath)
            const minIdx = Math.min(cs.ti1, cs.ti2)
            const newTerms = sn.terms.filter((_, k) => k !== cs.ti1 && k !== cs.ti2)
            const nr1 = removeLitFromNode(cloneN(t1), n1.v, n1.n)
            const nr2 = removeLitFromNode(cloneN(t2), n2.v, n2.n)
            newTerms.splice(minIdx, 0, prod(lit(n1.v, n1.n), sum(nr1, nr2)))
            sn.terms = newTerms
            return normalizeFlat(tree)
          },
        })
      }
    }
  }

  // 2. COMPLEMENT: both terms are complementary single literals (e.g. A + A' = 1)
  if (n1.type === 'lit' && n2.type === 'lit' && n1.v === n2.v && n1.n !== n2.n) {
    if (t1.type === 'lit' && t2.type === 'lit') {
      const vLabel1 = n1.n ? n1.v + "'" : n1.v
      const vLabel2 = n2.n ? n2.v + "'" : n2.v
      laws.push({
        ...defineLaw('Complement Law', LAW_FORM.SUM),
        desc: `${vLabel1} + ${vLabel2} = 1`,
        animPaths: [`${cs.sumPath}.${cs.ti1}`, `${cs.sumPath}.${cs.ti2}`],
        lit1Text: vLabel1,
        lit2Text: vLabel2,
        resultConst: '1',
        apply: () => {
          const tree = cloneN(expr)
          const sn = getNode(tree, cs.sumPath)
          const minIdx = Math.min(cs.ti1, cs.ti2)
          const newTerms = sn.terms.filter((_, k) => k !== cs.ti1 && k !== cs.ti2)
          newTerms.splice(minIdx, 0, con(1))
          sn.terms = newTerms
          return normalizeFlat(tree)
        },
      })
    }
  }

  // 3. IDENTITY (OR with 0)
  if (t1.type === 'const' && t1.val === 0) {
    const activeText = nodeText(t2)
    laws.push({
      ...defineLaw('Identity Law', LAW_FORM.SUM),
      desc: `0 + ${activeText} = ${activeText} — remove 0`,
      animPaths: [`${cs.sumPath}.${cs.ti1}`, `${cs.sumPath}.${cs.ti2}`],
      survivorPath: `${cs.sumPath}.${cs.ti2}`,
      constPath: `${cs.sumPath}.${cs.ti1}`,
      activeText,
      constText: '0',
      apply: () => {
        const tree = cloneN(expr)
        const sn = getNode(tree, cs.sumPath)
        sn.terms = sn.terms.filter((_, k) => k !== cs.ti1)
        return normalize(tree)
      },
    })
  }
  if (t2.type === 'const' && t2.val === 0) {
    const activeText = nodeText(t1)
    laws.push({
      ...defineLaw('Identity Law', LAW_FORM.SUM),
      desc: `${activeText} + 0 = ${activeText} — remove 0`,
      animPaths: [`${cs.sumPath}.${cs.ti1}`, `${cs.sumPath}.${cs.ti2}`],
      survivorPath: `${cs.sumPath}.${cs.ti1}`,
      constPath: `${cs.sumPath}.${cs.ti2}`,
      activeText,
      constText: '0',
      apply: () => {
        const tree = cloneN(expr)
        const sn = getNode(tree, cs.sumPath)
        sn.terms = sn.terms.filter((_, k) => k !== cs.ti2)
        return normalize(tree)
      },
    })
  }

  // 4. ANNULMENT (OR with 1) — pairwise absorption of selected term
  if ((t1.type === 'const' && t1.val === 1) || (t2.type === 'const' && t2.val === 1)) {
    const isT1Const = t1.type === 'const' && t1.val === 1
    const varTerm = isT1Const ? t2 : t1
    const constPath = isT1Const ? `${cs.sumPath}.${cs.ti1}` : `${cs.sumPath}.${cs.ti2}`
    const varPath = isT1Const ? `${cs.sumPath}.${cs.ti2}` : `${cs.sumPath}.${cs.ti1}`
    const varText = nodeText(varTerm)
    const varIndex = isT1Const ? cs.ti2 : cs.ti1

    laws.push({
      ...defineLaw('Annulment Law', LAW_FORM.SUM),
      desc: `${varText} + 1 = 1 — ${varText} absorbed by 1`,
      animPaths: [`${cs.sumPath}.${cs.ti1}`, `${cs.sumPath}.${cs.ti2}`],
      dominantConst: '1',
      constPath,
      varPath,
      varText,
      apply: () => {
        const tree = cloneN(expr)
        const sn = getNode(tree, cs.sumPath)
        sn.terms = sn.terms.filter((_, k) => k !== varIndex)
        return normalizeFlat(tree)
      },
    })
  }

  // 5. IDEMPOTENT (A + A = A)
  if (termsEq(t1, t2)) {
    const termText = nodeText(t1)
    laws.push({
      ...defineLaw('Idempotent Law', LAW_FORM.SUM),
      desc: `${termText} + ${termText} = ${termText}`,
      animPaths: [`${cs.sumPath}.${cs.ti1}`, `${cs.sumPath}.${cs.ti2}`],
      survivorPath: `${cs.sumPath}.${cs.ti1}`,
      duplicatePath: `${cs.sumPath}.${cs.ti2}`,
      termText,
      apply: () => {
        const tree = cloneN(expr)
        const sn = getNode(tree, cs.sumPath)
        sn.terms = sn.terms.filter((_, k) => k !== cs.ti2)
        return normalize(tree)
      },
    })
  }

  // 6. ABSORPTION (A + AB = A)
  if (isSubT(t1, t2)) {
    const sLits = getLits(t1)
    const lLits = getLits(t2)
    const extra = lLits.filter(ll => !sLits.some(sl => sl.v === ll.v && sl.n === ll.n))
    const extraText = extra.map(l => (l.n ? l.v + "'" : l.v)).join('')
    const survivorText = nodeText(t1)
    const absorbedText = nodeText(t2)

    laws.push({
      ...defineLaw('Absorption Law', LAW_FORM.SUM),
      desc: `${survivorText} absorbs ${absorbedText} → ${survivorText}`,
      animPaths: [`${cs.sumPath}.${cs.ti1}`, `${cs.sumPath}.${cs.ti2}`],
      survivorPath: `${cs.sumPath}.${cs.ti1}`,
      absorbedPath: `${cs.sumPath}.${cs.ti2}`,
      survivorText,
      absorbedText,
      extraText,
      apply: () => {
        const tree = cloneN(expr)
        const sn = getNode(tree, cs.sumPath)
        sn.terms = sn.terms.filter((_, k) => k !== cs.ti2)
        return normalize(tree)
      },
    })
  }
  if (isSubT(t2, t1)) {
    const sLits = getLits(t2)
    const lLits = getLits(t1)
    const extra = lLits.filter(ll => !sLits.some(sl => sl.v === ll.v && sl.n === ll.n))
    const extraText = extra.map(l => (l.n ? l.v + "'" : l.v)).join('')
    const survivorText = nodeText(t2)
    const absorbedText = nodeText(t1)

    laws.push({
      ...defineLaw('Absorption Law', LAW_FORM.SUM),
      desc: `${survivorText} absorbs ${absorbedText} → ${survivorText}`,
      animPaths: [`${cs.sumPath}.${cs.ti1}`, `${cs.sumPath}.${cs.ti2}`],
      survivorPath: `${cs.sumPath}.${cs.ti2}`,
      absorbedPath: `${cs.sumPath}.${cs.ti1}`,
      survivorText,
      absorbedText,
      extraText,
      apply: () => {
        const tree = cloneN(expr)
        const sn = getNode(tree, cs.sumPath)
        sn.terms = sn.terms.filter((_, k) => k !== cs.ti1)
        return normalize(tree)
      },
    })
  }

  return laws
}
