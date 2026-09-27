/**
 * LEAD REGRESSION FINGERPRINT — engine behaviour on graded levels.
 *
 * Dumps, for every graded puzzle (levels 0-3) and every state along its optimal
 * solution path:
 *   - optimalSteps from findOptimalPath(expr, goal)
 *   - the law ids of getLegalTransitions(state)
 *   - the law|paths of scanHints(state)
 * plus the same for every curated sandbox-pool expression.
 *
 * Run BEFORE and AFTER an engine change (laws.js / solver.js) and diff the two
 * JSON files: with the default (no options) the output must be byte-identical,
 * which is the proof that Levels 1-3 behave exactly as before.
 *
 * Usage:
 *   node .e2e/lead-engine-fingerprint.mjs            > baseline.json
 *   node .e2e/lead-engine-fingerprint.mjs --expand   > with-expand.json
 */

import { parseExpr, canonText, nodeText } from '../frontend/src/engine/index.js'
import { getLegalTransitions, findOptimalPath } from '../frontend/src/engine/index.js'
import { scanHints } from '../frontend/src/engine/index.js'
import { SANDBOX_POOL } from '../frontend/src/engine/index.js'

const WITH_EXPAND = process.argv.includes('--expand')
const OPTS = WITH_EXPAND ? { allowExpand: true } : {}

/** Level data lives in Python; load it the same way the API serves it. */
async function fetchLevels() {
  const out = []
  for (const id of [0, 1, 2, 3]) {
    const res = await fetch(`http://127.0.0.1:8000/api/levels/${id}`)
    if (!res.ok) continue
    out.push(await res.json())
  }
  return out
}

const fingerprintState = (text) => {
  const tree = parseExpr(text)
  const transitions = getLegalTransitions(tree, OPTS)
  const hints = scanHints(tree, 'R', OPTS)
  return {
    canon: canonText(tree),
    transitionLaws: transitions.map(t => t.lawId || t.law).sort(),
    transitionTexts: transitions.map(t => `${nodeText(tree)} => ${t.to}`).sort(),
    hints: hints.map(h => `${h.law}|${h.paths.join(',')}`).sort(),
  }
}

const report = { mode: WITH_EXPAND ? 'expand' : 'default', levels: [], pool: [] }

for (const level of await fetchLevels()) {
  const entry = { id: level.id, name: level.name, puzzles: [] }
  for (const [idx, p] of (level.puzzles || []).entries()) {
    const start = parseExpr(p.expr)
    const goalCanon = canonText(parseExpr(p.goal))
    const path = findOptimalPath(start, goalCanon, { maxDepth: 14, maxStates: 24000, ...OPTS })
    entry.puzzles.push({
      idx,
      expr: nodeText(start),
      goal: nodeText(parseExpr(p.goal)),
      optimalSteps: path.found ? path.optimalSteps : null,
      states: [p.expr, ...path.path.map(s => s.to)].map(fingerprintState),
    })
  }
  report.levels.push(entry)
}

for (const expr of SANDBOX_POOL) {
  report.pool.push({ expr, ...fingerprintState(expr) })
}

console.log(JSON.stringify(report, null, 2))
