const E = '/home/xris/Documents/GitHub/Praxis/frontend/src/engine'
const imp = (n) => import(`${E}/${n}`)
/**
 * Engine audit — drive the real engine from node and dump facts that the docs claim.
 */
const { parseExpr } = await imp('parser.js')
const { nodeText, canonText } = await imp('render.js')
const { normalize, normalizeFlat } = await imp('normalize.js')
const { validateInput } = await imp('validate.js')
const { analyzeSelection, analyzeNot, analyzeSumConst, analyzeProductConst, scanHints, LAW_DEFINITIONS, LAW_NAME_TO_ID } = await imp('laws/index.js')
const { equivalents, isEquivalent } = await imp('equivalence.js')
const { solve, findOptimalSteps } = await imp('solver.js')
const engineIndex = await imp('index.js')

const out = {}
const ids = [...new Set(LAW_DEFINITIONS.map((d) => d.id))]
out.engineDistinctIds = ids
out.engineDefinitionCount = LAW_DEFINITIONS.length
out.LAW_NAME_TO_ID = LAW_NAME_TO_ID
out.engineIndexExports = Object.keys(engineIndex).sort()

// canonText vs nodeText
out.renderExports = Object.keys(await imp('render.js'))
for (const e of ['x + xy', "x'y + xy", '(x+y)', 'xy', "x''", 'x + 0', 'x·y']) {
  try {
    const ast = parseExpr(e)
    out[`text:${e}`] = { nodeText: nodeText(ast), canonText: canonText(ast) }
  } catch (err) {
    out[`text:${e}`] = { error: String(err.message) }
  }
}

// completion is canonical-text equality, not semantic equivalence
out.completionProbes = []
for (const [expr, goal] of [['x + xy', 'x'], ['x + y', 'y + x'], ["x' + x", '1'], ['x + x', 'x'], ['xy', 'yx']]) {
  let a, b
  try { a = canonText(parseExpr(expr)) } catch (e) { a = `ERR ${e.message}` }
  try { b = canonText(parseExpr(goal)) } catch (e) { b = `ERR ${e.message}` }
  let eq = null
  try { eq = isEquivalent(parseExpr(expr), parseExpr(goal)) } catch (e) { eq = `ERR ${e.message}` }
  out.completionProbes.push({ expr, goal, canonEqual: a === b, canonExpr: a, canonGoal: b, semanticallyEquivalent: eq })
}

// law detection on real content
const levels = JSON.parse(await import('node:fs').then((fs) => fs.readFileSync('/home/xris/Documents/GitHub/Praxis/content/levels.json', 'utf8')))
out.levelMeta = levels.map((l) => ({ id: l.id, name: l.name, varCount: l.varCount, n: l.puzzles.length }))

// which law ids are actually offered by the engine on the authored puzzles
const offeredFromSolver = {}
for (const lvl of levels) {
  for (const [i, p] of lvl.puzzles.entries()) {
    let r
    try { r = findOptimalSteps(parseExpr(p.expr), parseExpr(p.goal)) } catch (e) { r = { error: String(e.message) } }
    offeredFromSolver[`${lvl.id}:${i}`] = r
  }
}
out.solverOnContent = offeredFromSolver

// scanHints law ids across all 40 puzzles
const hintLawIds = new Set()
const scanErrors = []
for (const lvl of levels) {
  for (const [i, p] of lvl.puzzles.entries()) {
    try {
      const hints = scanHints(parseExpr(p.expr))
      for (const h of hints) hintLawIds.add(h.id)
    } catch (e) { scanErrors.push(`${lvl.id}:${i} ${e.message}`) }
  }
}
out.hintLawIds = [...hintLawIds].sort()
out.scanErrors = scanErrors

// target law ids actually used in the authored content
const contentTargetLaws = new Set()
for (const lvl of levels) for (const p of lvl.puzzles) for (const t of p.targetLaws) contentTargetLaws.add(t)
out.contentTargetLawIds = [...contentTargetLaws].sort()

// content/laws.json ids
const laws = JSON.parse(await import('node:fs').then((fs) => fs.readFileSync('/home/xris/Documents/GitHub/Praxis/content/laws.json', 'utf8')))
out.cardIds = laws.map((l) => l.id)
out.cardKeys = [...new Set(laws.flatMap((l) => Object.keys(l)))].sort()
out.cardSample = laws[0]

// sandbox validate exports
out.sandboxValidateExports = Object.keys(await imp('sandbox/validate.js'))
out.sandboxInputExports = Object.keys(await imp('sandbox/input.js'))
out.sandboxGeneratorExports = Object.keys(await imp('sandbox/generator.js'))
out.sandboxExpandExports = Object.keys(await imp('sandbox/expand.js'))
out.sandboxPoolExports = Object.keys(await imp('sandbox/pool.js'))
out.scoringExports = Object.keys(await imp('scoring.js'))
out.solverExports = Object.keys(await imp('solver.js'))
out.parseExports = Object.keys(await imp('parser.js'))
out.normalizeExports = Object.keys(await imp('normalize.js'))
out.validateExports = Object.keys(await imp('validate.js'))
out.treeExports = Object.keys(await imp('tree.js'))
out.nodeExports = Object.keys(await imp('node.js'))
out.equivalenceExports = Object.keys(await imp('equivalence.js'))

// distribute-expand reachability
const expandCases = []
for (const [expr, sel] of [['x(y + z)', null]]) {
  try {
    const ast = parseExpr(expr)
    // select the 'x' literal and the clause (y+z)
    const r = analyzeSelection(ast, [
      { path: [0], isTermSel: false },
      { path: [1], isTermSel: false },
    ], { allowExpand: true })
    expandCases.push({ expr, withExpand: r.map((l) => l.id) })
    const r2 = analyzeSelection(ast, [
      { path: [0], isTermSel: false },
      { path: [1], isTermSel: false },
    ])
    expandCases.push({ expr, withoutExpand: r2.map((l) => l.id) })
  } catch (e) { expandCases.push({ expr, error: String(e.message) }) }
}
out.expandCases = expandCases

console.log('###JSON###')
console.log(JSON.stringify(out, null, 1))
