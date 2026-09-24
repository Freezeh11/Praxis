import { parseExpr, canonText, nodeText, extractVariables } from '../frontend/src/lib/expr.js'
import { findOptimalPath, findSimplestForm } from '../frontend/src/lib/solver.js'

const API = 'http://127.0.0.1:8000'

// Detect Product-of-Sums shape: a product whose factors include sums,
// or any nested product-of-sum anywhere in the tree.
function isProductOfSums(n) {
  if (!n) return false
  if (n.type === 'prod' && n.factors.some(f => f.type === 'sum')) return true
  if (n.type === 'prod') return n.factors.some(isProductOfSums)
  if (n.type === 'sum') return n.terms.some(isProductOfSums)
  if (n.type === 'not') return isProductOfSums(n.child)
  return false
}

let totalChecked = 0
let solvable = 0
let goalMatchesSimplest = 0
const failures = []
const warnings = []

for (const levelId of [1, 2, 3]) {
  const res = await fetch(`${API}/api/levels/${levelId}`)
  const level = await res.json()
  const puzzles = level.puzzles || []
  console.log(`\n=== LEVEL ${levelId}: ${level.name} — ${puzzles.length} stages, varCount=${level.varCount} ===`)

  for (const [idx, p] of puzzles.entries()) {
    totalChecked++
    const exprTree = parseExpr(p.expr)
    const goalTree = parseExpr(p.goal)
    const goalCanon = canonText(goalTree)
    const vars = extractVariables(exprTree)
    const pos = isProductOfSums(exprTree)

    // 1. Solvability: BFS from expr to declared goal
    const sol = findOptimalPath(exprTree, goalCanon, { maxDepth: 15, maxStates: 30000 })
    const optimalOk = sol.found ? (sol.optimalSteps === (p.optimalSteps ?? null)) : false
    const declaredOptimal = p.optimalSteps ?? '?'

    // 2. Simplest-form check: is the declared goal the engine's terminal form?
    const sim = findSimplestForm(exprTree, { maxDepth: 15, maxStates: 30000 })
    const matchesSimplest = sim.found && sim.canon === goalCanon

    const line = [
      `  stage ${String(idx + 1).padStart(2)}`,
      `vars=${vars.join('') || '-'}`,
      `POS=${pos ? 'Y' : 'n'}`,
      `optimal: declared=${declaredOptimal} solver=${sol.found ? sol.optimalSteps : 'NOT FOUND'}`,
      `goal==simplest=${matchesSimplest ? 'Y' : (sim.found ? 'n' : '?')}`,
    ].join('  ')

    if (!sol.found) {
      failures.push(`L${levelId} stage ${idx + 1}: solver could not reach goal "${p.goal}" from "${p.expr}" (budget 15/30000)`)
      console.log(line + '  ❌ UNSOLVABLE')
    } else if (!optimalOk) {
      warnings.push(`L${levelId} stage ${idx + 1}: declared optimal=${declaredOptimal} but solver found ${sol.optimalSteps}`)
      console.log(line + '  ⚠️ optimal mismatch')
    } else {
      console.log(line + '  ✅')
      solvable++
    }

    if (matchesSimplest) goalMatchesSimplest++
  }
}

console.log('\n=== SUMMARY ===')
console.log(`puzzles checked: ${totalChecked}`)
console.log(`solvable (goal reachable): ${solvable}/${totalChecked}`)
console.log(`goal == engine simplest form: ${goalMatchesSimplest}/${totalChecked}`)
console.log(`failures: ${failures.length}`)
failures.forEach(f => console.log('  ❌ ' + f))
console.log(`warnings: ${warnings.length}`)
warnings.forEach(w => console.log('  ⚠️ ' + w))
process.exit(failures.length > 0 ? 1 : 0)
