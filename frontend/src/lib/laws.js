import {
  cloneN, getNode, setNode, findCommonSum,
  removeLitFromNode, termContainsLit,
  nodeText, normalize, normalizeFlat,
  con, lit, prod, sum, neg,
} from './expr.js'

/* ===== HELPERS ===== */
export function getLits(node) {
  if (node.type === 'lit') return [node]
  if (node.type === 'prod') return node.factors.filter(f => f.type === 'lit')
  return []
}

export function termsEq(a, b) { return nodeText(a) === nodeText(b) }

export function isSubT(shorter, longer) {
  const sLits = getLits(shorter), lLits = getLits(longer)
  if (sLits.length === 0 || sLits.length >= lLits.length) return false
  return sLits.every(sl => lLits.some(ll => ll.v === sl.v && ll.n === sl.n))
}

/* ===== ANALYZE TWO SELECTED ITEMS ===== */
export function analyzeSelection(expr, sel) {
  if (sel.length !== 2) return []
  const p1 = sel[0].path, p2 = sel[1].path
  const bothTermSel = sel[0].isTermSel && sel[1].isTermSel
  const n1 = getNode(expr, p1), n2 = getNode(expr, p2)
  if (!n1 || !n2) return []

  const cs = findCommonSum(expr, p1, p2)
  if (!cs) return []

  const t1 = cs.sumNode.terms[cs.ti1], t2 = cs.sumNode.terms[cs.ti2]
  const laws = []

  if (!bothTermSel) {
    // DISTRIBUTIVE: same literal in both terms
    if (n1.type === 'lit' && n2.type === 'lit' && n1.v === n2.v && n1.n === n2.n) {
      if (termContainsLit(t1, n1.v, n1.n) && termContainsLit(t2, n2.v, n2.n)) {
        const vLabel = n1.n ? n1.v + "'" : n1.v
        const r1 = removeLitFromNode(t1, n1.v, n1.n)
        const r2 = removeLitFromNode(t2, n2.v, n2.n)
        laws.push({
          name: 'Distributive (Factor)',
          id: 'distributive',
          formula: 'AB + AC = A(B+C)',
          desc: `Factor out ${vLabel} → ${vLabel}(${nodeText(r1)} + ${nodeText(r2)})`,
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
    // COMPLEMENT: both terms are single literals that are complements
    if (n1.type === 'lit' && n2.type === 'lit' && n1.v === n2.v && n1.n !== n2.n) {
      if (t1.type === 'lit' && t2.type === 'lit') {
        laws.push({
          name: 'Complement Law',
          id: 'complement',
          formula: "A + A' = 1",
          desc: `${n1.n ? n1.v + "'" : n1.v} + ${n2.n ? n2.v + "'" : n2.v} = 1`,
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
    // IDENTITY: one term in the common sum is con(0)
    if (t1.type === 'const' && t1.val === 0) {
      laws.push({
        name: 'Identity Law', id: 'identity', formula: 'A + 0 = A',
        desc: 'Remove the 0 term',
        apply: () => { const tree = cloneN(expr); const sn = getNode(tree, cs.sumPath); sn.terms = sn.terms.filter((_, k) => k !== cs.ti1); return normalize(tree) },
      })
    }
    if (t2.type === 'const' && t2.val === 0) {
      laws.push({
        name: 'Identity Law', id: 'identity', formula: 'A + 0 = A',
        desc: 'Remove the 0 term',
        apply: () => { const tree = cloneN(expr); const sn = getNode(tree, cs.sumPath); sn.terms = sn.terms.filter((_, k) => k !== cs.ti2); return normalize(tree) },
      })
    }
    // ANNULMENT: one term in the common sum is con(1)
    if ((t1.type === 'const' && t1.val === 1) || (t2.type === 'const' && t2.val === 1)) {
      laws.push({
        name: 'Annulment Law', id: 'annulment', formula: 'A + 1 = 1',
        desc: 'A + 1 = 1',
        apply: () => { const tree = cloneN(expr); const sn = getNode(tree, cs.sumPath); sn.terms = [con(1)]; return normalizeFlat(tree) },
      })
    }
  } else {
    // TERM-LEVEL LAWS
    // IDEMPOTENT
    if (termsEq(t1, t2)) {
      laws.push({
        name: 'Idempotent Law', id: 'idempotent', formula: 'A + A = A',
        desc: 'These terms are identical — remove duplicate',
        apply: () => { const tree = cloneN(expr); const sn = getNode(tree, cs.sumPath); sn.terms = sn.terms.filter((_, k) => k !== cs.ti2); return normalize(tree) },
      })
    }
    // ABSORPTION
    if (isSubT(t1, t2)) {
      laws.push({
        name: 'Absorption Law', id: 'absorption', formula: 'A + AB = A',
        desc: `${nodeText(t1)} absorbs ${nodeText(t2)}`,
        apply: () => { const tree = cloneN(expr); const sn = getNode(tree, cs.sumPath); sn.terms = sn.terms.filter((_, k) => k !== cs.ti2); return normalize(tree) },
      })
    }
    if (isSubT(t2, t1)) {
      laws.push({
        name: 'Absorption Law', id: 'absorption', formula: 'A + AB = A',
        desc: `${nodeText(t2)} absorbs ${nodeText(t1)}`,
        apply: () => { const tree = cloneN(expr); const sn = getNode(tree, cs.sumPath); sn.terms = sn.terms.filter((_, k) => k !== cs.ti1); return normalize(tree) },
      })
    }
    // IDENTITY (OR with 0)
    if (t1.type === 'const' && t1.val === 0) {
      laws.push({ name: 'Identity Law', id: 'identity', formula: 'A + 0 = A', desc: 'Remove the 0 term', apply: () => { const tree = cloneN(expr); const sn = getNode(tree, cs.sumPath); sn.terms = sn.terms.filter((_, k) => k !== cs.ti1); return normalize(tree) } })
    }
    if (t2.type === 'const' && t2.val === 0) {
      laws.push({ name: 'Identity Law', id: 'identity', formula: 'A + 0 = A', desc: 'Remove the 0 term', apply: () => { const tree = cloneN(expr); const sn = getNode(tree, cs.sumPath); sn.terms = sn.terms.filter((_, k) => k !== cs.ti2); return normalize(tree) } })
    }
    // ANNULMENT
    if ((t1.type === 'const' && t1.val === 1) || (t2.type === 'const' && t2.val === 1)) {
      laws.push({ name: 'Annulment Law', id: 'annulment', formula: 'A + 1 = 1', desc: 'A + 1 = 1', apply: () => { const tree = cloneN(expr); const sn = getNode(tree, cs.sumPath); sn.terms = [con(1)]; return normalize(tree) } })
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

  // Double Negation: (A')' = A
  if (child.type === 'not') {
    const r = cloneN(child.child)
    laws.push({
      name: 'Double Negation', id: 'double-neg', formula: "(A')' = A",
      desc: `(${nodeText(child)})' = ${nodeText(r)}`,
      apply: () => { const tree = cloneN(expr); return normalize(setNode(tree, path, r)) },
    })
  }
  // De Morgan's AND: (AB)' = A' + B'
  if (child.type === 'prod') {
    const expanded = sum(...child.factors.map(f => f.type === 'lit' ? lit(f.v, !f.n) : neg(cloneN(f))))
    laws.push({
      name: "De Morgan's (AND→OR)", id: 'demorgan-and', formula: "(AB)' = A' + B'",
      desc: `${nodeText(node)} = ${nodeText(expanded)}`,
      apply: () => { const tree = cloneN(expr); return normalize(setNode(tree, path, cloneN(expanded))) },
    })
  }
  // De Morgan's OR: (A+B)' = A'B'
  if (child.type === 'sum') {
    const expanded = prod(...child.terms.map(t => t.type === 'lit' ? lit(t.v, !t.n) : neg(cloneN(t))))
    laws.push({
      name: "De Morgan's (OR→AND)", id: 'demorgan-or', formula: "(A+B)' = A'B'",
      desc: `${nodeText(node)} = ${nodeText(expanded)}`,
      apply: () => { const tree = cloneN(expr); return normalize(setNode(tree, path, cloneN(expanded))) },
    })
  }
  return laws
}

/* ===== ANALYZE PRODUCT CONSTANT ===== */
export function analyzeProductConst(expr, constPath, constVal, prodPath) {
  const laws = []
  const idx = parseInt(constPath.split('.').pop())
  if (constVal === 1) {
    laws.push({
      name: 'Identity Law', id: 'identity', formula: 'A · 1 = A',
      desc: 'A · 1 = A — remove the 1 factor',
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
      name: 'Annulment Law (Product)', id: 'annulment', formula: 'A · 0 = 0',
      desc: 'A · 0 = 0 — anything times 0 is 0',
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
  const hints = [], seen = new Set()
  const add = (law, paths) => {
    const k = law + '|' + paths.join(',')
    if (!seen.has(k)) { seen.add(k); hints.push({ law, paths }) }
  }
  function walk(node, path) {
    if (node.type === 'not') {
      if (node.child.type === 'not') add('double-neg', [path])
      else if (node.child.type === 'prod' || node.child.type === 'sum') add('demorgan', [path])
      walk(node.child, path + '.0')
      return
    }
    if (node.type === 'prod') {
      node.factors.forEach((f, i) => {
        if (f.type === 'const' && f.val === 1) add('identity', [path + '.' + i])
        if (f.type === 'const' && f.val === 0) add('annulment', [path + '.' + i])
        walk(f, path + '.' + i)
      })
      return
    }
    if (node.type === 'sum') {
      const T = node.terms
      for (let i = 0; i < T.length; i++) {
        const p1 = path + '.' + i, t1 = T[i]
        for (let j = i + 1; j < T.length; j++) {
          const p2 = path + '.' + j, t2 = T[j]
          if (termsEq(t1, t2)) add('idempotent', [p1, p2])
          if (isSubT(t1, t2)) add('absorption', [p1, p2])
          if (isSubT(t2, t1)) add('absorption', [p2, p1])
          if (t1.type === 'lit' && t2.type === 'lit' && t1.v === t2.v && t1.n !== t2.n)
            add('complement', [p1, p2])
          if ((t1.type === 'const' && t1.val === 1) || (t2.type === 'const' && t2.val === 1))
            add('annulment', [p1, p2])
          if ((t1.type === 'const' && t1.val === 0) || (t2.type === 'const' && t2.val === 0))
            add('identity', [p1, p2])
          const done = new Set()
          for (const l1 of getLits(t1)) for (const l2 of getLits(t2)) {
            if (l1.v === l2.v && l1.n === l2.n && !done.has(l1.v + l1.n)) {
              done.add(l1.v + l1.n)
              const lp1 = findLitPath(t1, p1, l1.v, l1.n)
              const lp2 = findLitPath(t2, p2, l2.v, l2.n)
              if (lp1 && lp2) add('distributive', [lp1, lp2])
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
