import { SOLVER_BUDGET } from '../config/gameRules.js'
import { cloneN } from './node.js'
import { getSumLits } from './tree.js'
import { nodeText, canonText } from './render.js'
import { lawIdOf } from './scoring.js'
import {
  analyzeNot,
  analyzeProductConst,
  analyzeSelection,
  getLits
} from './laws/index.js'

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
 *
 * @param {Object} tree - Starting AST tree
 * @param {Object} [options] - forwarded to analyzeSelection (e.g. { allowExpand: true } for the sandbox)
 */
export function getLegalTransitions(tree, options = {}) {
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

    // 2. Product Constant & Product Clause laws (Dual Distributive, Dual Absorption, Dual Complement, Identity, Annulment)
    if (node.type === 'prod') {
      const factors = node.factors
      for (let i = 0; i < factors.length; i++) {
        const p1 = path + '.' + i
        const f1 = factors[i]
        if (f1.type === 'const') {
          const laws = analyzeProductConst(tree, p1, f1.val, path)
          laws.forEach(l => addTransition(l, tree))
        }

        for (let j = i + 1; j < factors.length; j++) {
          const p2 = path + '.' + j
          const f2 = factors[j]

          // A. Factor/Clause level selections (Dual Idempotent, Dual Absorption)
          const clauseLaws = analyzeSelection(tree, [
            { path: p1, isTermSel: true },
            { path: p2, isTermSel: true },
          ], options)
          clauseLaws.forEach(l => addTransition(l, tree))

          // B. Literal-level selections (Dual Distributive, Dual Complement)
          const lits1 = getSumLits(f1)
          const lits2 = getSumLits(f2)
          for (const l1 of lits1) {
            for (const l2 of lits2) {
              const lp1 = findLitPath(f1, p1, l1.v, l1.n)
              const lp2 = findLitPath(f2, p2, l2.v, l2.n)
              if (lp1 && lp2) {
                const litLaws = analyzeSelection(tree, [
                  { path: lp1, isTermSel: false },
                  { path: lp2, isTermSel: false },
                ], options)
                litLaws.forEach(l => addTransition(l, tree))
              }
            }
          }
        }
        walk(f1, p1)
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
          ], options)
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
                ], options)
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
 * @param {boolean} [options.allowExpand=false] - also offer the gated Distributive-Expand law (sandbox)
 * @returns {{ optimalSteps: number, path: Array<{ law: string, from: string, to: string }>, found: boolean }}
 */
export function findOptimalPath(startExpr, targetCanon, options = {}) {
  if (!startExpr) return { optimalSteps: 0, path: [], found: false }

  const initialCanon = canonText(startExpr)
  if (initialCanon === targetCanon) {
    return { optimalSteps: 0, path: [], found: true }
  }

  const maxDepth = options.maxDepth ?? SOLVER_BUDGET.graded.maxDepth
  const maxStates = options.maxStates ?? SOLVER_BUDGET.graded.maxStates

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

    const transitions = getLegalTransitions(current.tree, options)
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

/**
 * Finds the shortest derivation that reaches the goal AND applies every law in
 * `requiredLawIds`.
 *
 * `findOptimalPath` answers "what is the shortest route to the answer?". For a
 * graded puzzle that is the wrong question. A puzzle's `targetLaws` state which
 * laws the learner is meant to practise, and using them often costs an extra
 * step compared with a clever shortcut. Scoring against the shortcut punishes a
 * learner for following the puzzle's own teaching, and can make a perfect total
 * unreachable. This variant scores the puzzle's *objective* instead: the fewest
 * steps in which the goal is reached while every required law has been used.
 *
 * Consequences, both intended:
 *   - following the taught route earns full marks;
 *   - finding a shorter route that skips a required law still earns full
 *     efficiency, but gives up the target-law credit that law was worth.
 *
 * The search state is (canonical form, laws used so far), so it is larger than
 * the plain BFS and is bounded by the same budget options. Returns `found:false`
 * when no route satisfies the objective, so callers can fall back.
 *
 * @param {Object} startExpr - Starting AST tree
 * @param {string} targetCanon - Canonical text of the goal
 * @param {string[]} requiredLawIds - Law ids that must all appear on the path
 * @param {Object} [options] - maxDepth / maxStates / allowExpand
 * @returns {{ optimalSteps: number, path: Array, found: boolean }}
 */
export function findOptimalPathWithLaws(startExpr, targetCanon, requiredLawIds, options = {}) {
  const required = Array.from(new Set(requiredLawIds || []))
  // No objective beyond reaching the goal: the plain shortest path is correct.
  if (!required.length) return findOptimalPath(startExpr, targetCanon, options)
  if (!startExpr) return { optimalSteps: 0, path: [], found: false }

  const maxDepth = options.maxDepth ?? SOLVER_BUDGET.graded.maxDepth
  const maxStates = options.maxStates ?? SOLVER_BUDGET.graded.maxStates

  const stateKey = (canon, used) => canon + '|' + used.join(',')

  const initialCanon = canonText(startExpr)
  const queue = [{
    tree: cloneN(startExpr),
    canon: initialCanon,
    depth: 0,
    path: [],
    used: [],
  }]
  const visited = new Set([stateKey(initialCanon, [])])
  let statesExplored = 0

  while (queue.length > 0) {
    const current = queue.shift()

    if (current.depth >= maxDepth || statesExplored >= maxStates) {
      continue
    }

    const transitions = getLegalTransitions(current.tree, options)
    statesExplored += transitions.length

    for (const trans of transitions) {
      const stepInfo = {
        law: trans.law,
        from: trans.from,
        to: trans.to,
      }
      const newPath = [...current.path, stepInfo]

      // Same id the scoring layer will credit for this step, so the optimum and
      // the target-law band can never disagree about what a route used.
      const lawId = lawIdOf(trans.law)
      const used = current.used.includes(lawId)
        ? current.used
        : [...current.used, lawId].sort()

      if (trans.nextCanon === targetCanon && required.every((id) => used.includes(id))) {
        return {
          optimalSteps: newPath.length,
          path: newPath,
          found: true,
        }
      }

      // A goal state that has not yet collected every required law is still
      // worth expanding: the route may leave the goal and come back.
      const k = stateKey(trans.nextCanon, used)
      if (!visited.has(k)) {
        visited.add(k)
        queue.push({
          tree: trans.nextTree,
          canon: trans.nextCanon,
          depth: current.depth + 1,
          path: newPath,
          used,
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

/**
 * Finds a fully simplified form of the expression using BFS.
 *
 * A state is "fully simplified" when the law engine reports zero legal
 * transitions from it. Returns the first terminal state found (which is
 * also the one reachable in the fewest steps) along with the derivation
 * path used to reach it.
 *
 * @param {Object} startExpr - Starting AST tree
 * @param {Object} [options]
 * @param {number} [options.maxDepth=12] - Maximum search depth
 * @param {number} [options.maxStates=8000] - Maximum state budget
 * @param {boolean} [options.allowExpand=false] - also offer the gated Distributive-Expand law (sandbox)
 * @returns {{ tree: Object, canon: string, text: string, optimalSteps: number, path: Array, found: boolean }}
 */
export function findSimplestForm(startExpr, options = {}) {
  if (!startExpr) {
    return { tree: null, canon: '', text: '', optimalSteps: 0, path: [], found: false }
  }

  const maxDepth = options.maxDepth ?? SOLVER_BUDGET.generator.simplestForm.maxDepth
  const maxStates = options.maxStates ?? SOLVER_BUDGET.generator.simplestForm.maxStates

  const initialCanon = canonText(startExpr)
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

    const transitions = getLegalTransitions(current.tree, options)
    statesExplored += transitions.length

    // Terminal state: no law applies — this is a fully simplified form.
    if (transitions.length === 0) {
      return {
        tree: current.tree,
        canon: current.canon,
        text: nodeText(current.tree),
        optimalSteps: current.path.length,
        path: current.path,
        found: true,
      }
    }

    if (current.depth >= maxDepth || statesExplored >= maxStates) {
      continue
    }

    for (const trans of transitions) {
      if (!visited.has(trans.nextCanon)) {
        visited.add(trans.nextCanon)
        queue.push({
          tree: trans.nextTree,
          canon: trans.nextCanon,
          depth: current.depth + 1,
          path: [...current.path, {
            law: trans.law,
            from: trans.from,
            to: trans.to,
          }],
        })
      }
    }
  }

  return {
    tree: startExpr,
    canon: initialCanon,
    text: nodeText(startExpr),
    optimalSteps: 0,
    path: [],
    found: false,
  }
}
