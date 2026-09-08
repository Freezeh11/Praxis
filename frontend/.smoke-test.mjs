import { parseExpr, canonText, validateExpr } from './src/lib/expr.js'
import { findOptimalPath, findSimplestForm } from './src/lib/solver.js'

// 1. validator cases
const cases = [
  ['x + xy', true],
  ["x'y + xy + xyz", true],
  ["(x+y)(x+y')", true],
  ['x ++ y', false],
  ['', false],
  ['(x + y', false],
  ['x + )y(', false],
  ['x $ y', false],
  ['+ xy', false],
  ['xy +', false],
  ['()', false],
]
for (const [s, expect] of cases) {
  const r = validateExpr(s)
  const ok = r.valid === expect
  console.log(ok ? 'PASS' : 'FAIL', JSON.stringify(s), '->', r.valid ? 'valid' : 'invalid (' + r.error + ')')
}

// 2. tutorial puzzle: x + xy -> x
const t = parseExpr('x + xy')
const tGoal = canonText(parseExpr('x'))
const tRes = findOptimalPath(t, tGoal)
console.log('tutorial optimal:', tRes.found, tRes.optimalSteps, tRes.path.map(p => p.law).join(', '))

// 3. sandbox auto-simplify: no goal
for (const s of ["x'y + xy + xyz", 'x + xy', "(x + y)(x + y')", "(w+x+y+z)' + w'x'"]) {
  const sim = findSimplestForm(parseExpr(s))
  console.log('auto-simplify', s, '=>', sim.text, '| steps:', sim.optimalSteps, '| found:', sim.found)
}

// 4. sandbox with explicit goal
const g = canonText(parseExpr('y'))
const r4 = findOptimalPath(parseExpr("x'y + xy + xy"), g)
console.log("goal y from x'y + xy + xy:", r4.found, r4.optimalSteps)
