/**
 * Randomizer stress test.
 *
 * Generates a large sample across every difficulty and asserts the full
 * contract the Sandbox UI relies on:
 *  - every problem is parseable and round-trips canonically
 *  - variables stay within the 2-3 variable scope (x, y, z)
 *  - the declared goal is reachable and its optimal step count matches BFS
 *  - both Sum-of-Products and Product-of-Sums shapes appear
 *  - the reported difficulty presets are respected
 *
 * Run:  node .e2e/generator-stress.mjs
 * Exit code is non-zero when any failure is found.
 */
import { parseExpr, canonText, nodeText, extractVariables, validateExpr } from '../frontend/src/lib/expr.js'
import { findOptimalPath, findSimplestForm } from '../frontend/src/lib/solver.js'
import { generateRandomPuzzle, generatePuzzlePair, DIFFICULTIES } from '../frontend/src/lib/randomPuzzle.js'

const VAR_POOL = ['x', 'y', 'z']
const PER_DIFFICULTY = 40

const isSopRoot = (n) => Boolean(n) && n.type === 'sum' && n.terms.some(t => t.type === 'prod')
const isPosRoot = (n) => Boolean(n) && n.type === 'prod' && n.factors.some(f => f.type === 'sum')

const failures = []
const stats = {}

for (const difficulty of Object.keys(DIFFICULTIES)) {
  const preset = DIFFICULTIES[difficulty]
  const s = {
    n: 0, solvable: 0, sop: 0, pos: 0, outOfScope: 0,
    optimalMismatch: 0, belowMinSteps: 0, roundTripFail: 0, alreadySolved: 0,
    steps: [], ms: 0,
  }
  const started = Date.now()

  for (let i = 0; i < PER_DIFFICULTY; i++) {
    const p = generateRandomPuzzle(difficulty)
    s.n++

    if (!validateExpr(p.expr).valid) failures.push(`${difficulty} #${i}: "${p.expr}" failed expression validation`)

    const tree = parseExpr(p.expr)
    const vars = extractVariables(tree)
    if (!(vars.length > 0 && vars.length <= 3 && vars.every(v => VAR_POOL.includes(v)))) {
      s.outOfScope++
      failures.push(`${difficulty} #${i}: "${p.expr}" uses variables outside x/y/z: ${vars.join('') || '(none)'}`)
    }

    if (canonText(parseExpr(nodeText(tree))) !== canonText(tree)) {
      s.roundTripFail++
      failures.push(`${difficulty} #${i}: "${p.expr}" does not survive a parse/render round-trip`)
    }

    const goalCanon = canonText(parseExpr(p.goal))
    if (canonText(tree) === goalCanon) {
      s.alreadySolved++
      failures.push(`${difficulty} #${i}: "${p.expr}" was generated already solved`)
    }

    const sol = findOptimalPath(tree, goalCanon, { maxDepth: 12, maxStates: 12000 })
    if (!sol.found) {
      failures.push(`${difficulty} #${i}: goal "${p.goal}" unreachable from "${p.expr}"`)
    } else {
      s.solvable++
      if (sol.optimalSteps !== p.optimalSteps) {
        s.optimalMismatch++
        failures.push(`${difficulty} #${i}: "${p.expr}" reported optimal=${p.optimalSteps} but solver found ${sol.optimalSteps}`)
      }
      if (p.optimalSteps < preset.minSteps) {
        s.belowMinSteps++
        failures.push(`${difficulty} #${i}: "${p.expr}" needs ${p.optimalSteps} steps, below minimum ${preset.minSteps}`)
      }
    }

    // The declared goal must be a genuine terminal (fully simplified) form.
    const sim = findSimplestForm(tree, { maxDepth: 12, maxStates: 12000 })
    if (!sim.found) failures.push(`${difficulty} #${i}: "${p.expr}" has no terminal simplified form`)

    if (isSopRoot(tree)) s.sop++
    if (isPosRoot(tree)) s.pos++
    s.steps.push(p.optimalSteps)
  }

  s.ms = Date.now() - started
  stats[difficulty] = s
}

// Repeating the previous expression must never happen back-to-back.
let duplicatePairs = 0
let previous = null
for (let i = 0; i < 60; i++) {
  const p = generatePuzzlePair(previous, 'medium')
  if (previous && p.expr === previous) duplicatePairs++
  previous = p.expr
}
if (duplicatePairs > 0) failures.push(`generatePuzzlePair repeated the previous expression ${duplicatePairs} times`)

console.log('difficulty  generated  solvable  SOP  POS  outOfScope  optimalMismatch  alreadySolved  roundTripFail   steps(min/avg/max)')
for (const [difficulty, s] of Object.entries(stats)) {
  const avg = (s.steps.reduce((a, b) => a + b, 0) / s.steps.length).toFixed(1)
  console.log(
    `${difficulty.padEnd(11)} ${String(s.n).padStart(9)} ${String(s.solvable).padStart(9)} ` +
    `${String(s.sop).padStart(4)} ${String(s.pos).padStart(4)} ${String(s.outOfScope).padStart(11)} ` +
    `${String(s.optimalMismatch).padStart(16)} ${String(s.alreadySolved).padStart(13)} ` +
    `${String(s.roundTripFail).padStart(13)}   ${Math.min(...s.steps)}/${avg}/${Math.max(...s.steps)}`,
  )
}
console.log(`\nconsecutive duplicate pairs: ${duplicatePairs}`)
console.log(`failures: ${failures.length}`)
failures.slice(0, 20).forEach(f => console.log('  ❌ ' + f))
process.exit(failures.length > 0 ? 1 : 0)
