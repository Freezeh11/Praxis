import {
  cloneN, getNode, nodeText, canonText,
  isEquivalent, getClauseLits
} from './expr.js'
import {
  analyzeNot,
  analyzeProductConst,
  analyzeSelection,
  getLits
} from './laws.js'

function findLitPath(node, base, v, n) {
  if (node.type === 'lit' && node.v === v && node.n === n) return base
  if (node.type === 'prod') {
    for (let i = 0; i < node.factors.length; i++) {
      if (node.factors[i].type === 'lit' && node.factors[i].v === v && node.factors[i].n === n) {
        return base + '.' + i
      }
    }
  }
  if (node.type === 'sum') {
    for (let i = 0; i < node.terms.length; i++) {
      if (node.terms[i].type === 'lit' && node.terms[i].v === v && node.terms[i].n === n) {
        return base + '.' + i
      }
    }
  }
  return null
}

/**
 * Enumerates all valid one-step transitions from an AST state.
 */
export function getLegalTransitions(tree) {
  const transitions = []
  const seenNextCanons = new Set()

  function addTransition(law, sourceTree) {
    try {
      const nextTree = law.apply()
      if (!nextTree) return
      const nextCanon = canonText(nextTree)
      const fromText = nodeText(sourceTree)
      const toText = nodeText(nextTree)

      // Ensure the step actually changes the expression
      if (fromText !== toText && !seenNextCanons.has(nextCanon + '|' + law.name)) {
        seenNextCanons.add(nextCanon + '|' + law.name)
        transitions.push({
          law: law.name,
          lawId: law.id,
          from: fromText,
          to: toText,
          nextTree,
          nextCanon,
        })
      }
    } catch {
      // Ignore any invalid AST evaluations
    }
  }

  function walk(node, path) {
    if (!node) return

    // 1. Single-node NOT laws (Double Negation, De Morgan)
    if (node.type === 'not') {
      const laws = analyzeNot(tree, path)
      laws.forEach(l => addTransition(l, tree))
      walk(node.child, path + '.0')
      return
    }

    // 2. Product laws (Constants, Idempotent, Absorption, Dual Distributive, Complement)
    if (node.type === 'prod') {
      const factors = node.factors
      for (let i = 0; i < factors.length; i++) {
        const fPath = path + '.' + i
        const f1 = factors[i]
        if (f1.type === 'const') {
          const laws = analyzeProductConst(tree, fPath, f1.val, path)
          laws.forEach(l => addTransition(l, tree))
        }

        for (let j = i + 1; j < factors.length; j++) {
          const p2 = path + '.' + j
          const f2 = factors[j]

          // A. Factor-level selections (Idempotent, Absorption)
          const factorLaws = analyzeSelection(tree, [
            { path: fPath, isTermSel: true },
            { path: p2, isTermSel: true },
          ])
          factorLaws.forEach(l => addTransition(l, tree))

          // B. Literal-level selections (Complement, Dual Distributive)
          const lits1 = getClauseLits(f1)
          const lits2 = getClauseLits(f2)
          for (const l1 of lits1) {
            for (const l2 of lits2) {
              const lp1 = findLitPath(f1, fPath, l1.v, l1.n)
              const lp2 = findLitPath(f2, p2, l2.v, l2.n)
              if (lp1 && lp2) {
                const litLaws = analyzeSelection(tree, [
                  { path: lp1, isTermSel: false },
                  { path: lp2, isTermSel: false },
                ])
                litLaws.forEach(l => addTransition(l, tree))
              }
            }
          }
        }
        walk(f1, fPath)
      }
      return
    }

    // 3. Sum laws (Idempotent, Absorption, Complement, Distributive, Identity, Annulment)
    if (node.type === 'sum') {
      const terms = node.terms
      for (let i = 0; i < terms.length; i++) {
        const p1 = path + '.' + i
        const t1 = terms[i]
        for (let j = i + 1; j < terms.length; j++) {
          const p2 = path + '.' + j
          const t2 = terms[j]

          // A. Term-level selections (Idempotent, Absorption, Identity +0, Annulment +1)
          const termLaws = analyzeSelection(tree, [
            { path: p1, isTermSel: true },
            { path: p2, isTermSel: true },
          ])
          termLaws.forEach(l => addTransition(l, tree))

          // B. Literal-level selections (Complement, Distributive Factoring)
          const lits1 = getLits(t1)
          const lits2 = getLits(t2)
          for (const l1 of lits1) {
            for (const l2 of lits2) {
              const lp1 = findLitPath(t1, p1, l1.v, l1.n)
              const lp2 = findLitPath(t2, p2, l2.v, l2.n)
              if (lp1 && lp2) {
                const litLaws = analyzeSelection(tree, [
                  { path: lp1, isTermSel: false },
                  { path: lp2, isTermSel: false },
                ])
                litLaws.forEach(l => addTransition(l, tree))
              }
            }
          }
        }
        walk(t1, p1)
      }
    }
  }

  walk(tree, 'R')
  return transitions
}

/**
 * Finds the shortest path (optimal steps) from start AST to goal using BFS.
 *
 * @param {Object} startExpr - Starting AST tree
 * @param {string} targetCanon - Target canonical text (e.g. 'A' or "x' + y")
 * @param {Object} [options]
 * @param {number} [options.maxDepth=10] - Maximum search depth
 * @param {number} [options.maxStates=3000] - Maximum state budget
 * @returns {{ optimalSteps: number, path: Array<{ law: string, from: string, to: string }>, found: boolean }}
 */
export function findOptimalPath(startExpr, targetCanon, options = {}) {
  if (!startExpr) return { optimalSteps: 0, path: [], found: false }

  const initialCanon = canonText(startExpr)
  if (initialCanon === targetCanon) {
    return { optimalSteps: 0, path: [], found: true }
  }

  const maxDepth = options.maxDepth ?? 10
  const maxStates = options.maxStates ?? 3000

  // BFS Queue: [ { tree, canon, depth, path } ]
  const queue = [{
    tree: cloneN(startExpr),
    canon: initialCanon,
    depth: 0,
    path: [],
  }]

  const visited = new Set([initialCanon])
  let statesExplored = 0

  while (queue.length > 0) {
    const current = queue.shift()

    if (current.depth >= maxDepth || statesExplored >= maxStates) {
      continue
    }

    const transitions = getLegalTransitions(current.tree)
    statesExplored += transitions.length

    for (const trans of transitions) {
      const stepInfo = {
        law: trans.law,
        from: trans.from,
        to: trans.to,
      }
      const newPath = [...current.path, stepInfo]

      // Check if target goal is reached
      if (trans.nextCanon === targetCanon) {
        return {
          optimalSteps: newPath.length,
          path: newPath,
          found: true,
        }
      }

      if (!visited.has(trans.nextCanon)) {
        visited.add(trans.nextCanon)
        queue.push({
          tree: trans.nextTree,
          canon: trans.nextCanon,
          depth: current.depth + 1,
          path: newPath,
        })
      }
    }
  }

  return {
    optimalSteps: 0,
    path: [],
    found: false,
  }
}
