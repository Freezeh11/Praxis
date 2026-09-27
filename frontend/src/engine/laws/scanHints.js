/**
 * Hint scanner — walks a whole expression and reports every place a law applies.
 *
 * This is what powers the Hint button, the Guide's pre-selection and the
 * "dead end" detection: it is a pure structural scan, independent of what the
 * learner has selected.
 *
 * Results are de-duplicated by `law|paths` and returned in traversal order, so
 * the first hint is always the left-most applicable one.
 *
 * Pure module: no React/DOM/network.
 */
import { getSumLits, isSubSum } from '../tree.js'
import { findExpandablePair, findLitPath, getLits, isSubT, termsEq } from './helpers.js'

/**
 * @param {object} node tree to scan
 * @param {string} path path of `node` (usually 'R')
 * @param {{ allowExpand?: boolean }} [options] sandbox-only expansion opt-in
 * @returns {Array<{ law: string, paths: string[] }>} applicable hints
 */
export function scanHints(node, path, options = {}) {
  const { allowExpand = false } = options || {}
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
          // GATED: the sandbox also lets the player expand A(B + A') = AB + AA'.
          if (allowExpand) {
            const pair = findExpandablePair(n, i, j)
            if (pair) add('distributive-expand', [`${p}.${pair.litIndex}`, `${p}.${pair.sumIndex}`])
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
