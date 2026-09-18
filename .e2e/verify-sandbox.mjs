/**
 * Sandbox + randomizer verification (no browser, no backend required).
 *
 * Covers four contracts the Sandbox feature depends on:
 *  1. the restored engine helpers behave (`findSimplestForm`, `validateExpr`)
 *  2. the curated sandbox pool is usable end-to-end
 *  3. the randomizer only ever returns solver-verified, in-scope problems
 *  4. a generated problem is solvable through the SAME law engine the UI uses
 *
 * Run:  node .e2e/verify-sandbox.mjs
 * Exit code is non-zero when any failure is found.
 */
import {
  parseExpr, canonText, nodeText, extractVariables, validateExpr, isEquivalent,
} from '../frontend/src/lib/expr.js'
import { findOptimalPath, findSimplestForm, getLegalTransitions } from '../frontend/src/lib/solver.js'
import { scanHints } from '../frontend/src/lib/laws.js'
import { generateRandomPuzzle, generatePuzzlePair, DIFFICULTIES } from '../frontend/src/lib/randomPuzzle.js'
import { SANDBOX_POOL, randomPoolEquation } from '../frontend/src/lib/sandboxPool.js'

const VAR_POOL = ['x', 'y', 'z']
const failures = []
const warnings = []
const check = (ok, msg) => { if (!ok) failures.push(msg) }

const isSopRoot = (n) => Boolean(n) && n.type === 'sum' && n.terms.some(t => t.type === 'prod')
const isPosRoot = (n) => Boolean(n) && n.type === 'prod' && n.factors.some(f => f.type === 'sum')

/* ── 1. Restored engine helpers ─────────────────────────────────────────── */
console.log('=== 1. Engine helpers ===')
const helperCases = [
  ['x + xy', 'x'],
  ["x'y + xy + xy", 'y'],
  ['xz + xz\'', 'x'],
]
for (const [expr, expectedGoal] of helperCases) {
  const tree = parseExpr(expr)
  const sim = findSimplestForm(tree)
  check(sim.found, `findSimplestForm did not reach a terminal state for "${expr}"`)
  if (sim.found) {
    // The terminal form must be logically equivalent to the expected goal —
    // the law engine does not guarantee a unique canonical minimum.
    check(isEquivalent(tree, parseExpr(sim.text)),
      `findSimplestForm("${expr}") = "${sim.text}", which is not equivalent to the original`)
    check(isEquivalent(parseExpr(sim.text), parseExpr(expectedGoal)),
      `findSimplestForm("${expr}") = "${sim.text}", expected something equivalent to "${expectedGoal}"`)
    check(sim.optimalSteps > 0, `findSimplestForm("${expr}") reported 0 steps but the expression is reducible`)
  }
}
// A terminal form must genuinely have no applicable law left.
const terminal = findSimplestForm(parseExpr("x'y + xy + xy"))
check(scanHints(terminal.tree, 'R').length === 0, 'findSimplestForm returned a non-terminal state')
check(validateExpr("x'y + xy").valid, 'validateExpr rejected a valid expression')
check(!validateExpr('x ++ y').valid, 'validateExpr accepted "x ++ y"')
check(!validateExpr('(x + y').valid, 'validateExpr accepted unbalanced parentheses')
check(!validateExpr('').valid, 'validateExpr accepted an empty string')
console.log(`  engine helper cases checked: ${helperCases.length + 4}`)

/* ── 2. Curated sandbox pool ───────────────────────────────────────────── */
console.log('\n=== 2. Curated sandbox pool ===')
check(SANDBOX_POOL.length >= 20, `pool is unexpectedly small (${SANDBOX_POOL.length} entries)`)
let poolBad = 0
for (const expr of SANDBOX_POOL) {
  const tree = parseExpr(expr)
  const vars = extractVariables(tree)
  const sim = findSimplestForm(tree)
  const sol = sim.found ? findOptimalPath(tree, sim.canon, { maxDepth: 12, maxStates: 12000 }) : { found: false }
  const inScope = vars.length > 0 && vars.length <= 3 && vars.every(v => VAR_POOL.includes(v))
  if (!sim.found || !sol.found || sim.optimalSteps === 0 || !inScope) {
    poolBad++
    warnings.push(`pool entry unusable or out of scope: "${expr}" (vars=${vars.join('')}, terminal=${sim.found}, steps=${sim.optimalSteps})`)
  }
}
check(poolBad === 0, `${poolBad} curated pool entries are unusable`)
// The exclude option must actually exclude.
const excluded = SANDBOX_POOL[0]
for (let i = 0; i < 50; i++) {
  check(randomPoolEquation(excluded) !== excluded, 'randomPoolEquation ignored the exclude argument')
}
console.log(`  pool entries: ${SANDBOX_POOL.length}, unusable: ${poolBad}`)

/* ── 3. Randomizer contract ────────────────────────────────────────────── */
console.log('\n=== 3. Randomizer contract ===')
const PER_DIFFICULTY = 40
for (const difficulty of Object.keys(DIFFICULTIES)) {
  const preset = DIFFICULTIES[difficulty]
  let sop = 0
  let pos = 0
  const steps = []
  for (let i = 0; i < PER_DIFFICULTY; i++) {
    const p = generateRandomPuzzle(difficulty)
    const tree = parseExpr(p.expr)
    const vars = extractVariables(tree)

    // In scope: only x/y/z, at most 3 variables.
    check(vars.length > 0 && vars.length <= 3 && vars.every(v => VAR_POOL.includes(v)),
      `[${difficulty}] "${p.expr}" uses out-of-scope variables: ${vars.join('') || '(none)'}`)

    // The string the UI loads must round-trip canonically.
    check(canonText(parseExpr(nodeText(tree))) === canonText(tree),
      `[${difficulty}] "${p.expr}" does not survive a parse/render round-trip`)

    // The declared goal must be reachable and match the reported optimal steps.
    const goalCanon = canonText(parseExpr(p.goal))
    const sol = findOptimalPath(tree, goalCanon, { maxDepth: 12, maxStates: 12000 })
    check(sol.found, `[${difficulty}] goal "${p.goal}" unreachable from "${p.expr}"`)
    if (sol.found) {
      check(sol.optimalSteps === p.optimalSteps,
        `[${difficulty}] "${p.expr}": reported optimal ${p.optimalSteps}, solver found ${sol.optimalSteps}`)
      check(p.optimalSteps >= preset.minSteps,
        `[${difficulty}] "${p.expr}" needs ${p.optimalSteps} steps, below the preset minimum ${preset.minSteps}`)
    }

    // The goal must not be the starting expression.
    check(canonText(tree) !== goalCanon, `[${difficulty}] "${p.expr}" is already solved`)

    if (isSopRoot(tree)) sop++
    if (isPosRoot(tree)) pos++
    steps.push(p.optimalSteps)
  }
  const avg = (steps.reduce((a, b) => a + b, 0) / steps.length).toFixed(1)
  console.log(`  ${difficulty.padEnd(7)} generated=${PER_DIFFICULTY}  SOP=${sop}  POS=${pos}  steps min=${Math.min(...steps)} avg=${avg} max=${Math.max(...steps)}`)
  check(sop > 0 && pos > 0, `[${difficulty}] generator produced only one algebra form (SOP=${sop}, POS=${pos})`)
}

/* Consecutive randomize must never repeat the current expression. */
let duplicates = 0
let previous = null
for (let i = 0; i < 30; i++) {
  const p = generatePuzzlePair(previous, 'medium')
  if (previous && p.expr === previous) duplicates++
  previous = p.expr
}
check(duplicates === 0, `generatePuzzlePair repeated the previous expression ${duplicates} times`)

/* Seeded runs are reproducible (the generator has no hidden global state). */
const seededA = Array.from({ length: 8 }, (_, i) => generateRandomPuzzle('hard', { seed: 4242 + i }).expr)
const seededB = Array.from({ length: 8 }, (_, i) => generateRandomPuzzle('hard', { seed: 4242 + i }).expr)
check(JSON.stringify(seededA) === JSON.stringify(seededB), 'seeded generation is not reproducible')
console.log(`  consecutive duplicates: ${duplicates}, seeded determinism: ${JSON.stringify(seededA) === JSON.stringify(seededB)}`)

/* ── 4. Playable through the UI's law engine ───────────────────────────── */
console.log('\n=== 4. Playability through the law engine ===')
/**
 * Replays a solver derivation by, at each state, enumerating exactly the moves
 * the workspace can offer (`getLegalTransitions`, the same enumeration the
 * hint scanner and law dock are built on) and taking the one that matches the
 * next step of the optimal path.
 *
 * This proves a generated problem is solvable through real UI moves rather
 * than only through BFS internals.
 */
function playThrough(exprString, goalCanon) {
  const path = findOptimalPath(parseExpr(exprString), goalCanon, { maxDepth: 12, maxStates: 12000 })
  if (!path.found) return { ok: false, reason: 'no path' }

  let current = parseExpr(exprString)
  for (const step of path.path) {
    const before = nodeText(current)
    if (before !== step.from) return { ok: false, reason: `path desync at "${step.from}" (have "${before}")` }

    const transitions = getLegalTransitions(current)
    const match = transitions.find(t => t.nextCanon === canonText(parseExpr(step.to)))
    if (!match) {
      return { ok: false, reason: `no UI move reproduces "${step.from}" -> "${step.to}"` }
    }
    current = match.nextTree
  }
  return { ok: true, steps: path.path.length }
}

let replayOk = 0
const REPLAY_SAMPLE = 20
for (let i = 0; i < REPLAY_SAMPLE; i++) {
  const p = generateRandomPuzzle('medium')
  const res = playThrough(p.expr, canonText(parseExpr(p.goal)))
  if (res.ok) replayOk++
  else failures.push(`UI replay failed for "${p.expr}" (${res.reason})`)
}
console.log(`  generated problems replayable via the UI move set: ${replayOk}/${REPLAY_SAMPLE}`)
check(replayOk === REPLAY_SAMPLE, `${REPLAY_SAMPLE - replayOk}/${REPLAY_SAMPLE} generated problems were not replayable through the UI move set`)

/* Every generated problem must also offer a hint immediately (scanHints is
   what the Hint button and the Guide both call). */
let hinted = 0
for (let i = 0; i < REPLAY_SAMPLE; i++) {
  const p = generateRandomPuzzle('easy')
  if (scanHints(parseExpr(p.expr), 'R').length > 0) hinted++
}
console.log(`  generated problems that offer a hint on load: ${hinted}/${REPLAY_SAMPLE}`)
check(hinted === REPLAY_SAMPLE, `${REPLAY_SAMPLE - hinted}/${REPLAY_SAMPLE} generated problems offered no hint (Hint button would be a no-op)`)

/* ── Summary ───────────────────────────────────────────────────────────── */
console.log('\n=== SUMMARY ===')
console.log(`failures: ${failures.length}`)
failures.slice(0, 25).forEach(f => console.log('  ❌ ' + f))
console.log(`warnings: ${warnings.length}`)
warnings.slice(0, 25).forEach(w => console.log('  ⚠️  ' + w))
process.exit(failures.length > 0 ? 1 : 0)
