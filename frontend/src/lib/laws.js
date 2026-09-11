import {
  cloneN, getNode, setNode, findCommonSum, findCommonProd,
  removeLitFromNode, removeLitFromSumNode, termContainsLit, sumContainsLit,
  getSumLits, isSubSum,
  nodeText, normalize, normalizeFlat,
  con, lit, prod, sum, neg,
} from './expr.js'

/* ===== HELPERS ===== */
export function getLits(node) {
  if (!node) return []
  if (node.type === 'lit') return [node]
  if (node.type === 'prod') return node.factors.filter(f => f.type === 'lit')
  return []
}

export function termsEq(a, b) {
  return nodeText(a) === nodeText(b)
}

/**
 * Checks if shorter term is a subset of longer term (Absorption Law)
 * e.g., 'x' is a subset of 'xy', 'xy' is a subset of 'xyz'
 */
export function isSubT(shorter, longer) {
  const sLits = getLits(shorter)
  const lLits = getLits(longer)
  if (sLits.length === 0 || sLits.length >= lLits.length) return false
  return sLits.every(sl => lLits.some(ll => ll.v === sl.v && ll.n === sl.n))
}

/* ===== ANALYZE TWO SELECTED ITEMS ===== */
export function analyzeSelection(expr, sel) {
  if (!expr || sel.length !== 2) return []
  const p1 = sel[0].path
  const p2 = sel[1].path
  const bothTermSel = sel[0].isTermSel && sel[1].isTermSel
  const n1 = getNode(expr, p1)
  const n2 = getNode(expr, p2)
  if (!n1 || !n2) return []

  const cs = findCommonSum(expr, p1, p2)
  const cp = findCommonProd(expr, p1, p2)
  const laws = []

  // ──────────────────────────────────────────────────────────
  // 1. SUM-LEVEL LAWS (SOP terms & literals in sum)
  // ──────────────────────────────────────────────────────────
  if (cs && cs.sumNode?.terms?.[cs.ti1] && cs.sumNode?.terms?.[cs.ti2]) {
    const t1 = cs.sumNode.terms[cs.ti1]
    const t2 = cs.sumNode.terms[cs.ti2]

        // 1. DISTRIBUTIVE (FACTOR): Common literal in both terms (neither term is a bare single literal)
        if (!bothTermSel && n1.type === 'lit' && n2.type === 'lit' && n1.v === n2.v && n1.n === n2.n) {
          if (termContainsLit(t1, n1.v, n1.n) && termContainsLit(t2, n2.v, n2.n)) {
            const r1 = removeLitFromNode(t1, n1.v, n1.n)
            const r2 = removeLitFromNode(t2, n2.v, n2.n)
            const isT1Bare = r1.type === 'const' && r1.val === 1
            const isT2Bare = r2.type === 'const' && r2.val === 1

            if (!isT1Bare && !isT2Bare) {
              const vLabel = n1.n ? n1.v + "'" : n1.v

              // Check if cs.sumNode is nested inside a parent prod
              let parentPath = null
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
                name: 'Distributive (Factor)',
                id: 'distributive',
                formula: 'AB + AC = A(B+C)',
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

    // 2. COMPLEMENT: Both terms are complementary single literals (e.g. A + A' = 1)
    if (n1.type === 'lit' && n2.type === 'lit' && n1.v === n2.v && n1.n !== n2.n) {
      if (t1.type === 'lit' && t2.type === 'lit') {
        const vLabel1 = n1.n ? n1.v + "'" : n1.v
        const vLabel2 = n2.n ? n2.v + "'" : n2.v
        laws.push({
          name: 'Complement Law',
          id: 'complement',
          formula: "A + A' = 1",
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
        name: 'Identity Law',
        id: 'identity',
        formula: 'A + 0 = A',
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
        name: 'Identity Law',
        id: 'identity',
        formula: 'A + 0 = A',
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
        name: 'Annulment Law',
        id: 'annulment',
        formula: 'A + 1 = 1',
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
        name: 'Idempotent Law',
        id: 'idempotent',
        formula: 'A + A = A',
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
        name: 'Absorption Law',
        id: 'absorption',
        formula: 'A + AB = A',
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
        name: 'Absorption Law',
        id: 'absorption',
        formula: 'A + AB = A',
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
  }

  // ──────────────────────────────────────────────────────────
  // 2. PRODUCT-LEVEL LAWS (POS maxterm clauses & literals in product)
  // ──────────────────────────────────────────────────────────
  if (cp && cp.prodNode?.factors?.[cp.fi1] && cp.prodNode?.factors?.[cp.fi2]) {
    const f1 = cp.prodNode.factors[cp.fi1]
    const f2 = cp.prodNode.factors[cp.fi2]

    // 1. DUAL DISTRIBUTIVE: Common literal in both sum clauses ((A+B)(A+C) = A + BC)
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
            name: 'Distributive (POS)',
            id: 'distributive',
            formula: '(A+B)(A+C) = A + BC',
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
          name: 'Complement Law (Product)',
          id: 'complement',
          formula: "A · A' = 0",
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
      laws.push({
        name: 'Idempotent Law (Product)',
        id: 'idempotent',
        formula: 'A · A = A',
        desc: `(${factorText})(${factorText}) = ${factorText}`,
        animPaths: [`${cp.prodPath}.${cp.fi1}`, `${cp.prodPath}.${cp.fi2}`],
        survivorPath: `${cp.prodPath}.${cp.fi1}`,
        duplicatePath: `${cp.prodPath}.${cp.fi2}`,
        termText: factorText,
        apply: () => {
          const tree = cloneN(expr)
          const pn = getNode(tree, cp.prodPath)
          pn.factors = pn.factors.filter((_, k) => k !== cp.fi2)
          return normalize(tree)
        },
      })
    }

    // 4. DUAL ABSORPTION: A(A+B) = A or (A+B)(A+B+C) = A+B
    if (isSubSum(f1, f2)) {
      const survivorText = nodeText(f1)
      const absorbedText = nodeText(f2)
      laws.push({
        name: 'Absorption Law (Product)',
        id: 'absorption',
        formula: 'A(A+B) = A',
        desc: `${survivorText} absorbs (${absorbedText}) → ${survivorText}`,
        animPaths: [`${cp.prodPath}.${cp.fi1}`, `${cp.prodPath}.${cp.fi2}`],
        survivorPath: `${cp.prodPath}.${cp.fi1}`,
        absorbedPath: `${cp.prodPath}.${cp.fi2}`,
        survivorText,
        absorbedText,
        apply: () => {
          const tree = cloneN(expr)
          const pn = getNode(tree, cp.prodPath)
          pn.factors = pn.factors.filter((_, k) => k !== cp.fi2)
          return normalize(tree)
        },
      })
    }
    if (isSubSum(f2, f1)) {
      const survivorText = nodeText(f2)
      const absorbedText = nodeText(f1)
      laws.push({
        name: 'Absorption Law (Product)',
        id: 'absorption',
        formula: 'A(A+B) = A',
        desc: `${survivorText} absorbs (${absorbedText}) → ${survivorText}`,
        animPaths: [`${cp.prodPath}.${cp.fi1}`, `${cp.prodPath}.${cp.fi2}`],
        survivorPath: `${cp.prodPath}.${cp.fi2}`,
        absorbedPath: `${cp.prodPath}.${cp.fi1}`,
        survivorText,
        absorbedText,
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
        name: 'Annulment Law (Product)',
        id: 'annulment',
        formula: 'A · 0 = 0',
        desc: `${varText} · 0 = 0 — ${varText} eliminated by 0`,
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
  }

  return laws
}

/* ===== ANALYZE SINGLE NOT NODE ===== */
export function analyzeNot(expr, path) {
  const node = getNode(expr, path)
  if (!node || node.type !== 'not') return []
  const child = node.child
  const laws = []

  // 1. Double Negation: (A')' = A
  if (child.type === 'not') {
    const r = cloneN(child.child)
    const coreText = nodeText(r)
    laws.push({
      name: 'Double Negation',
      id: 'double-neg',
      formula: "(A')' = A",
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
      name: "De Morgan's (AND→OR)",
      id: 'demorgan-and',
      formula: "(AB)' = A' + B'",
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
      name: "De Morgan's (OR→AND)",
      id: 'demorgan-or',
      formula: "(A+B)' = A'B'",
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

/* ===== ANALYZE SUM CONSTANT ===== */
export function analyzeSumConst(expr, constPath, constVal, sumPath) {
  const laws = []
  const idx = parseInt(constPath.split('.').pop(), 10)
  if (constVal === 0) {
    const parentSum = getNode(expr, sumPath)
    const activeTerms = parentSum ? parentSum.terms.filter((_, i) => i !== idx) : []
    const activeText = activeTerms.map(t => nodeText(t)).join(' + ')
    laws.push({
      name: 'Identity Law',
      id: 'identity',
      formula: 'A + 0 = A',
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
      name: 'Annulment Law',
      id: 'annulment',
      formula: 'A + 1 = 1',
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

/* ===== ANALYZE PRODUCT CONSTANT ===== */
export function analyzeProductConst(expr, constPath, constVal, prodPath) {
  const laws = []
  const idx = parseInt(constPath.split('.').pop(), 10)
  if (constVal === 1) {
    const parentProd = getNode(expr, prodPath)
    const activeFactors = parentProd ? parentProd.factors.filter((_, i) => i !== idx) : []
    const activeText = activeFactors.map(f => (f.type === 'sum' ? '(' + nodeText(f) + ')' : nodeText(f))).join('')
    laws.push({
      name: 'Identity Law',
      id: 'identity',
      formula: 'A · 1 = A',
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
      name: 'Annulment Law (Product)',
      id: 'annulment',
      formula: 'A · 0 = 0',
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

/* ===== SMART HINT SCANNER ===== */
function findLitPath(node, base, v, n) {
  if (node.type === 'lit' && node.v === v && node.n === n) return base
  if (node.type === 'prod') {
    for (let i = 0; i < node.factors.length; i++) {
      if (node.factors[i].type === 'lit' && node.factors[i].v === v && node.factors[i].n === n)
        return base + '.' + i
    }
  }
  if (node.type === 'sum') {
    for (let i = 0; i < node.terms.length; i++) {
      if (node.terms[i].type === 'lit' && node.terms[i].v === v && node.terms[i].n === n)
        return base + '.' + i
    }
  }
  return null
}

export function scanHints(node, path) {
  const hints = []
  const seen = new Set()
  const add = (law, paths) => {
    const k = law + '|' + paths.join(',')
    if (!seen.has(k)) {
      seen.add(k)
      hints.push({ law, paths })
    }
  }

  function walk(n, p) {
    if (!n) return
    if (n.type === 'not') {
      if (n.child.type === 'not') add('double-neg', [p])
      else if (n.child.type === 'prod' || n.child.type === 'sum') add('demorgan', [p])
      walk(n.child, p + '.0')
      return
    }
    if (n.type === 'prod') {
      const F = n.factors
      for (let i = 0; i < F.length; i++) {
        const p1 = p + '.' + i
        const f1 = F[i]
        if (f1.type === 'const' && f1.val === 1) add('identity', [p1])
        if (f1.type === 'const' && f1.val === 0) add('annulment', [p1])
        for (let j = i + 1; j < F.length; j++) {
          const p2 = p + '.' + j
          const f2 = F[j]
          if (termsEq(f1, f2)) add('idempotent', [p1, p2])
          if (isSubSum(f1, f2)) add('absorption', [p1, p2])
          if (isSubSum(f2, f1)) add('absorption', [p2, p1])
          if (f1.type === 'lit' && f2.type === 'lit' && f1.v === f2.v && f1.n !== f2.n) {
            add('complement', [p1, p2])
          }
          if (f1.type === 'sum' && f2.type === 'sum') {
            const done = new Set()
            for (const l1 of getSumLits(f1)) {
              for (const l2 of getSumLits(f2)) {
                if (l1.v === l2.v && l1.n === l2.n && !done.has(l1.v + l1.n)) {
                  done.add(l1.v + l1.n)
                  const lp1 = findLitPath(f1, p1, l1.v, l1.n)
                  const lp2 = findLitPath(f2, p2, l2.v, l2.n)
                  if (lp1 && lp2) add('distributive', [lp1, lp2])
                }
              }
            }
          }
        }
        walk(f1, p1)
      }
      return
    }
    if (n.type === 'sum') {
      const T = n.terms
      for (let i = 0; i < T.length; i++) {
        const p1 = p + '.' + i
        const t1 = T[i]
        if (t1.type === 'const' && t1.val === 0) add('identity', [p1])
        if (t1.type === 'const' && t1.val === 1) add('annulment', [p1])
        for (let j = i + 1; j < T.length; j++) {
          const p2 = p + '.' + j
          const t2 = T[j]
          if (termsEq(t1, t2)) add('idempotent', [p1, p2])
          if (isSubT(t1, t2)) add('absorption', [p1, p2])
          if (isSubT(t2, t1)) add('absorption', [p2, p1])
          if (t1.type === 'lit' && t2.type === 'lit' && t1.v === t2.v && t1.n !== t2.n) {
            add('complement', [p1, p2])
          }
          if ((t1.type === 'const' && t1.val === 1) || (t2.type === 'const' && t2.val === 1)) {
            add('annulment', [p1, p2])
          }
          if ((t1.type === 'const' && t1.val === 0) || (t2.type === 'const' && t2.val === 0)) {
            add('identity', [p1, p2])
          }
          if (t1.type === 'prod' && t2.type === 'prod') {
            const done = new Set()
            for (const l1 of getLits(t1)) {
              for (const l2 of getLits(t2)) {
                if (l1.v === l2.v && l1.n === l2.n && !done.has(l1.v + l1.n)) {
                  done.add(l1.v + l1.n)
                  const lp1 = findLitPath(t1, p1, l1.v, l1.n)
                  const lp2 = findLitPath(t2, p2, l2.v, l2.n)
                  if (lp1 && lp2) add('distributive', [lp1, lp2])
                }
              }
            }
          }
        }
        walk(t1, p1)
      }
    }
  }

  walk(node, path)
  return hints
}

