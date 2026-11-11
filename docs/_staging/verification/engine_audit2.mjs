const E = '/home/xris/Documents/GitHub/Praxis/frontend/src/engine'
const imp = (n) => import(`${E}/${n}`)
import fs from 'node:fs'

const { parseExpr } = await imp('parser.js')
const { scanHints } = await imp('laws/scanHints.js')
const { analyzeSelection, analyzeNot, LAW_DEFINITIONS } = await imp('laws/index.js')

const levels = JSON.parse(fs.readFileSync('/home/xris/Documents/GitHub/Praxis/content/levels.json', 'utf8'))

const out = {}
const tokens = new Set()
const perPuzzle = {}
for (const lvl of levels) {
  for (const [i, p] of lvl.puzzles.entries()) {
    const h = scanHints(parseExpr(p.expr), 'R')
    const t = [...new Set(h.map((x) => x.law))].sort()
    t.forEach((x) => tokens.add(x))
    perPuzzle[`${lvl.id}:${i}`] = { expr: p.expr, goal: p.goal, targetLaws: p.targetLaws, hintTokens: t }
  }
}
out.hintTokensAcross40 = [...tokens].sort()
out.perPuzzle = perPuzzle

// scanHints with a sandbox expansion option
out.expandToken = (() => {
  const h = scanHints(parseExpr('x + xy'), 'R', { allowExpand: true })
  return [...new Set(h.map((x) => x.law))]
})()

// which engine law ids can analyzeSelection ever emit? enumerate the builders' ids
const builderIds = [...new Set(LAW_DEFINITIONS.map((d) => d.id))]
out.builderIds = builderIds

// associative: is it anywhere in the engine?
out.associativeInEngine = JSON.stringify(LAW_DEFINITIONS).includes('associative')

// does anything in engine reference the id 'demorgan' (no suffix)?
const files = fs.readdirSync(E, { recursive: true }).filter((f) => f.endsWith('.js'))
out.demorganBareHits = []
for (const f of files) {
  const txt = fs.readFileSync(`${E}/${f}`, 'utf8')
  txt.split('\n').forEach((l, i) => {
    if (/'demorgan'|"demorgan"/.test(l)) out.demorganBareHits.push(`${f}:${i + 1}: ${l.trim()}`)
  })
}

// canonText vs semantic equivalence, on the real goal of every puzzle
const { canonText } = await imp('render.js')
const { isEquivalent } = await imp('equivalence.js')
out.completion = []
for (const lvl of levels) {
  for (const [i, p] of lvl.puzzles.entries()) {
    const a = parseExpr(p.expr)
    const b = parseExpr(p.goal)
    out.completion.push({
      key: `${lvl.id}:${i}`,
      expr: p.expr,
      goal: p.goal,
      canonEqual: canonText(a) === canonText(b),
      semanticallyEquivalent: isEquivalent(a, b),
    })
  }
}
out.completionSummary = {
  canonEqualCount: out.completion.filter((c) => c.canonEqual).length,
  semanticallyEquivalentCount: out.completion.filter((c) => c.semanticallyEquivalent).length,
}

console.log('###JSON###')
console.log(JSON.stringify(out, null, 1))
