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

/**
 * Transition-list cache.
 *
 * The list for a given expression and palette is deterministic, and the app asks
 * for the same list repeatedly: loading a puzzle searches, a hint re-runs the
 * search, and planGuidance re-derives the first step from the state the search
 * started at. A bounded LRU keeps the most recent lists so those repeats cost a
 * lookup instead of a full law sweep.
 *
 * Cached arrays are never handed out directly — every caller gets its own — but
 * the transition objects (and their nextTree) are shared, which is safe because
 * law application always clones the tree it returns.
 */
const TRANSITION_CACHE_MAX = 200
const transitionCache = new Map()

/**
 * Structural signature of a tree, used as the cache key.
 *
 * nodeText is cheaper but flattens nesting: `a + (b + c)` and `a + b + c` render
 * the same while exposing different selection paths, and every transition carries
 * those paths. Keeping the nesting makes equal keys mean equal paths.
 */
function signature(n) {
  if (!n) return '-'
  if (n.type === 'lit') return n.n ? n.v + "'" : n.v
  if (n.type === 'const') return '_' + n.val
  if (n.type === 'prod') return '(' + n.factors.map(signature).join('*') + ')'
  if (n.type === 'sum') return '(' + n.terms.map(signature).join('+') + ')'
  if (n.type === 'not') return '(' + signature(n.child) + ")'"
  return '?'
}

/** The palette and the expansion gate are the only options the sweep reads. */
function transitionKey(tree, options) {
  const palette = options?.allowedLawIds ? options.allowedLawIds.join(',') : '*'
  return signature(tree) + '#' + (options?.allowExpand ? '1' : '0') + '#' + palette
}

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
 * @param {Object} [options] - law availability and sandbox expansion options
 * @param {string[]|null} [options.allowedLawIds] - visible palette ids; null is unrestricted, [] allows no moves
 */
export function getLegalTransitions(tree, options = {}) {
  const key = transitionKey(tree, options)
  const cached = transitionCache.get(key)
  if (cached) {
    // Re-inserting keeps the LRU ordered by last use.
    transitionCache.delete(key)
    transitionCache.set(key, cached)
    return cached.slice()
  }
  const transitions = collectTransitions(tree, options)
  transitionCache.set(key, transitions)
  if (transitionCache.size > TRANSITION_CACHE_MAX) {
    transitionCache.delete(transitionCache.keys().next().value)
  }
  return transitions.slice()
}

/** The uncached law sweep behind getLegalTransitions. */
function collectTransitions(tree, options = {}) {
  const transitions = []
  const seenNextCanons = new Set()

  function addTransition(law, sourceTree, selection) {
    // A visible palette is also the search boundary, including intermediate steps.
    if (options.allowedLawIds && !options.allowedLawIds.includes(law.id)) return
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
          selection,
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
      laws.forEach(l => addTransition(l, tree, [{ path, isTermSel: false }]))
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
          laws.forEach(l => addTransition(l, tree, [{ path: p1, isTermSel: false }]))
        }

        for (let j = i + 1; j < factors.length; j++) {
          const p2 = path + '.' + j
          const f2 = factors[j]

          // A. Factor/Clause level selections (Dual Idempotent, Dual Absorption)
          const clauseLaws = analyzeSelection(tree, [
            { path: p1, isTermSel: true },
            { path: p2, isTermSel: true },
          ], options)
          clauseLaws.forEach(l => addTransition(l, tree, [
            { path: p1, isTermSel: true }, { path: p2, isTermSel: true },
          ]))

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
                litLaws.forEach(l => addTransition(l, tree, [
                  { path: lp1, isTermSel: false }, { path: lp2, isTermSel: false },
                ]))
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
          termLaws.forEach(l => addTransition(l, tree, [
            { path: p1, isTermSel: true }, { path: p2, isTermSel: true },
          ]))

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
                litLaws.forEach(l => addTransition(l, tree, [
                  { path: lp1, isTermSel: false }, { path: lp2, isTermSel: false },
                ]))
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
 * @param {string[]|null} [options.allowedLawIds] - restrict every searched step to the visible palette
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
  // Optional wall-clock ceiling (epoch ms). State budgets bound work, not time:
  // per-state cost grows with the expression, so a main-thread caller such as the
  // sandbox needs a deadline as well, or a pathological input freezes the tab.
  const deadline = Number.isFinite(options.deadline) ? options.deadline : null

  // BFS Queue: [ { tree, canon, depth, path } ]
  const queue = [{
    tree: cloneN(startExpr),
    canon: initialCanon,
    depth: 0,
    path: [],
  }]

  const visited = new Set([initialCanon])
  let statesExplored = 0

  // Array.shift() is O(n), so dequeuing every state made these searches O(n^2)
  // in the state budget. A read cursor keeps the same FIFO order at O(1) per
  // dequeue, which matters most for the 3000/8000-state graded and generator
  // searches that run on the main thread when a puzzle loads.
  let head = 0
  while (head < queue.length) {
    const current = queue[head++]

    if (deadline !== null && Date.now() > deadline) break

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
  const deadline = Number.isFinite(options.deadline) ? options.deadline : null

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

  // Array.shift() is O(n), so dequeuing every state made these searches O(n^2)
  // in the state budget. A read cursor keeps the same FIFO order at O(1) per
  // dequeue, which matters most for the 3000/8000-state graded and generator
  // searches that run on the main thread when a puzzle loads.
  let head = 0
  while (head < queue.length) {
    const current = queue[head++]

    if (deadline !== null && Date.now() > deadline) break

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
  const deadline = Number.isFinite(options.deadline) ? options.deadline : null

  const initialCanon = canonText(startExpr)
  const queue = [{
    tree: cloneN(startExpr),
    canon: initialCanon,
    depth: 0,
    path: [],
  }]
  const visited = new Set([initialCanon])
  let statesExplored = 0

  // Array.shift() is O(n), so dequeuing every state made these searches O(n^2)
  // in the state budget. A read cursor keeps the same FIFO order at O(1) per
  // dequeue, which matters most for the 3000/8000-state graded and generator
  // searches that run on the main thread when a puzzle loads.
  let head = 0
  while (head < queue.length) {
    const current = queue[head++]

    if (deadline !== null && Date.now() > deadline) break

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
