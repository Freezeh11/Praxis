import {
  cloneN, getNode, setNode, findCommonSum,
  removeLitFromNode, termContainsLit,
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
  if (!cs) return []

  const t1 = cs.sumNode.terms[cs.ti1]
  const t2 = cs.sumNode.terms[cs.ti2]
  const laws = []

  if (!bothTermSel) {
    // 1. DISTRIBUTIVE (FACTOR): Common literal in both terms
    if (n1.type === 'lit' && n2.type === 'lit' && n1.v === n2.v && n1.n === n2.n) {
      if (termContainsLit(t1, n1.v, n1.n) && termContainsLit(t2, n2.v, n2.n)) {
        const vLabel = n1.n ? n1.v + "'" : n1.v
        const r1 = removeLitFromNode(t1, n1.v, n1.n)
        const r2 = removeLitFromNode(t2, n2.v, n2.n)

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
            const newTerms = sn.terms.filter((_, k) => k !== cs.ti1 && k !== cs.ti2)
            const nr1 = removeLitFromNode(cloneN(t1), n1.v, n1.n)
            const nr2 = removeLitFromNode(cloneN(t2), n2.v, n2.n)
            newTerms.push(prod(lit(n1.v, n1.n), sum(nr1, nr2)))
            sn.terms = newTerms
            return normalizeFlat(tree)
          },
        })
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
            const newTerms = sn.terms.filter((_, k) => k !== cs.ti1 && k !== cs.ti2)
            newTerms.push(con(1))
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

    // 4. ANNULMENT (OR with 1)
    if ((t1.type === 'const' && t1.val === 1) || (t2.type === 'const' && t2.val === 1)) {
      const isT1Const = t1.type === 'const' && t1.val === 1
      const varTerm = isT1Const ? t2 : t1
      const constPath = isT1Const ? `${cs.sumPath}.${cs.ti1}` : `${cs.sumPath}.${cs.ti2}`
      const varPath = isT1Const ? `${cs.sumPath}.${cs.ti2}` : `${cs.sumPath}.${cs.ti1}`
      const varText = nodeText(varTerm)

      laws.push({
        name: 'Annulment Law',
        id: 'annulment',
        formula: 'A + 1 = 1',
        desc: `${varText} + 1 = 1 — collapses to 1`,
        animPaths: [`${cs.sumPath}.${cs.ti1}`, `${cs.sumPath}.${cs.ti2}`],
        dominantConst: '1',
        constPath,
        varPath,
        varText,
        apply: () => {
          const tree = cloneN(expr)
          const sn = getNode(tree, cs.sumPath)
          sn.terms = [con(1)]
          return normalizeFlat(tree)
        },
      })
    }
  } else {
    // TERM-LEVEL LAWS (When selecting entire terms)
    // 1. IDEMPOTENT (A + A = A)
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

    // 2. ABSORPTION (A + AB = A)
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

    // 3. IDENTITY
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

    // 4. ANNULMENT
    if ((t1.type === 'const' && t1.val === 1) || (t2.type === 'const' && t2.val === 1)) {
      const isT1Const = t1.type === 'const' && t1.val === 1
      const varTerm = isT1Const ? t2 : t1
      const constPath = isT1Const ? `${cs.sumPath}.${cs.ti1}` : `${cs.sumPath}.${cs.ti2}`
      const varPath = isT1Const ? `${cs.sumPath}.${cs.ti2}` : `${cs.sumPath}.${cs.ti1}`
      const varText = nodeText(varTerm)

      laws.push({
        name: 'Annulment Law',
        id: 'annulment',
        formula: 'A + 1 = 1',
        desc: `${varText} + 1 = 1 — collapses to 1`,
        animPaths: [`${cs.sumPath}.${cs.ti1}`, `${cs.sumPath}.${cs.ti2}`],
        dominantConst: '1',
        constPath,
        varPath,
        varText,
        apply: () => {
          const tree = cloneN(expr)
          const sn = getNode(tree, cs.sumPath)
          sn.terms = [con(1)]
          return normalize(tree)
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
      n.factors.forEach((f, i) => {
        if (f.type === 'const' && f.val === 1) add('identity', [p + '.' + i])
        if (f.type === 'const' && f.val === 0) add('annulment', [p + '.' + i])
        walk(f, p + '.' + i)
      })
      return
    }
    if (n.type === 'sum') {
      const T = n.terms
      for (let i = 0; i < T.length; i++) {
        const p1 = p + '.' + i
        const t1 = T[i]
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
        walk(t1, p1)
      }
    }
  }

  walk(node, path)
  return hints
}

