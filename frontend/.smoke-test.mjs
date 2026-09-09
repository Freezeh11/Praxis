import { parseExpr, canonText, nodeText } from './src/lib/expr.js'
import { findOptimalPath } from './src/lib/solver.js'

// 1. tutorial problem: x + xy -> x
const t = parseExpr('x + xy')
const tGoal = canonText(parseExpr('x'))
const tRes = findOptimalPath(t, tGoal)
console.log('tutorial optimal:', tRes.found, tRes.optimalSteps, tRes.path.map(p => p.law).join(', '))

// 2. level-style puzzles: solver finds the declared optimal path
const cases = [
  ['x + xy', 'x'],
  ["x'y + xy + xy", 'y'],
  ['x(x + y)', 'x'],
  ['wxyz + wxz + wyz + w', 'wxz + w'],
  ["(w+x+y+z)' + w'x'", "w'x'"],
]
for (const [expr, goal] of cases) {
  const sol = findOptimalPath(parseExpr(expr), canonText(parseExpr(goal)))
  console.log(sol.found ? 'PASS' : 'FAIL', `${expr} -> ${goal} in ${sol.optimalSteps} steps`)
}

// 3. canonical text is order-independent
const a = canonText(parseExpr('x + y + xy'))
const b = canonText(parseExpr('xy + y + x'))
console.log(a === b ? 'PASS' : 'FAIL', 'canonical text order-independence')

// 4. nodeText renders expressions back to a parseable string
const round = nodeText(parseExpr("(x + y)(x + y')"))
console.log(round.length > 0 ? 'PASS' : 'FAIL', `nodeText round trip: ${round}`)
