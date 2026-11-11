/**
 * Citation + symbol-line checker for the Praxis docs suite (verifier-owned).
 *
 * Pass 1 — path resolution: a citation `path.ext[:NN]` must resolve on disk, either
 *          repo-relative, doc-relative, docs-relative, or by unique basename.
 * Pass 2 — line range: any cited line number must exist in the file.
 * Pass 3 — symbol proximity: when a line cites `path:NN` AND contains a backticked
 *          identifier, that identifier's last dotted component should occur in the
 *          file near line NN (window +/-3). Reported as SUSPECT, reviewed by hand.
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = '/home/xris/Documents/GitHub/Praxis'
const DOCS = path.join(ROOT, 'docs')

const REQUIRED = [
  'README.md',
  '01-product/PRD.md', '01-product/SRS.md',
  '02-architecture/SAD.md', '02-architecture/SDD.md', '02-architecture/REFACTOR-NOTES.md',
  '03-database/ERD.md', '03-database/SCHEMA.md',
  '04-api/API-REFERENCE.md',
  '05-guides/tutorials/getting-started.md', '05-guides/tutorials/understanding-the-engine.md',
  '05-guides/tutorials/first-contribution.md',
  '05-guides/how-to/add-a-new-level.md', '05-guides/how-to/add-a-new-problem.md',
  '05-guides/how-to/add-a-new-law.md', '05-guides/how-to/debug-a-failing-step.md',
  '05-guides/how-to/reset-user-progress.md', '05-guides/how-to/run-locally-with-docker.md',
  '06-reference/boolean-laws.md', '06-reference/scoring-and-rewards.md',
  '06-reference/config-reference.md', '06-reference/error-codes.md',
  '07-explanation/why-this-architecture.md', '07-explanation/design-decisions.md',
  '07-explanation/known-limitations.md',
  '08-devops/installation-manual.md', '08-devops/deployment.md',
  '08-devops/configuration-guide.md', '08-devops/runbooks.md', '08-devops/monitoring.md',
  '09-diagrams/DIAGRAMS.md',
  '10-project/glossary.md', '10-project/file-map.md', '10-project/changelog.md',
  'rules/RULES.md',
]

// ---- build a basename index of the repo (skipping heavy/foreign dirs) -----
const SKIP = new Set(['node_modules', '.git', 'venv', '__pycache__', 'dist', '.npm-cache', 'shots-mobile', 'baselines'])
const byBasename = new Map()
function walk(dir) {
  let entries
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
  for (const e of entries) {
    if (SKIP.has(e.name)) continue
    const abs = path.join(dir, e.name)
    if (e.isDirectory()) { walk(abs); continue }
    if (!e.isFile()) continue
    const arr = byBasename.get(e.name) || []
    arr.push(abs)
    byBasename.set(e.name, arr)
  }
}
walk(ROOT)

const fileCache = new Map()
function readLines(abs) {
  if (fileCache.has(abs)) return fileCache.get(abs)
  let v = null
  try { v = fs.readFileSync(abs, 'utf8').split('\n') } catch { v = null }
  fileCache.set(abs, v)
  return v
}

function resolveTarget(docRel, target) {
  const docAbs = path.join(DOCS, docRel)
  const candidates = [
    path.join(ROOT, target),
    path.resolve(path.dirname(docAbs), target),
    path.join(DOCS, target),
  ]
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return { abs: c, how: 'path' }
  }
  const base = path.basename(target)
  const hits = byBasename.get(base)
  if (hits && hits.length === 1) return { abs: hits[0], how: 'basename' }
  if (hits && hits.length > 1) {
    // disambiguate by suffix match
    const norm = target.replace(/^\.\//, '')
    const suff = hits.filter((h) => h.replace(`${ROOT}/`, '').endsWith(norm))
    if (suff.length === 1) return { abs: suff[0], how: 'suffix' }
    return { abs: null, how: 'ambiguous', hits: hits.length }
  }
  return { abs: null, how: 'missing' }
}

const CITATION = /`([A-Za-z0-9_./@-]+\.(?:py|js|jsx|json|sql|md|css|sh|ts|tsx|yaml|yml|html|txt))(?::(\d+(?:[-,]\d+)*))?`/g
const BACKTICKED = /`([A-Za-z_$][A-Za-z0-9_$.]*)`/g

const stats = { citations: 0, resolved: 0, missing: 0, withLine: 0, outOfRange: 0, symbolPairs: 0, suspect: 0 }
const missing = []
const outOfRange = []
const suspect = []

for (const rel of REQUIRED) {
  const abs = path.join(DOCS, rel)
  const lines = fs.readFileSync(abs, 'utf8').split('\n')
  lines.forEach((line, i) => {
    const cites = []
    let m
    CITATION.lastIndex = 0
    while ((m = CITATION.exec(line)) !== null) cites.push({ target: m[1], spec: m[2], idx: m.index })
    if (!cites.length) return
    const idents = []
    BACKTICKED.lastIndex = 0
    while ((m = BACKTICKED.exec(line)) !== null) idents.push(m[1])
    for (const c of cites) {
      stats.citations++
      const r = resolveTarget(rel, c.target)
      if (!r.abs) {
        stats.missing++
        missing.push({ doc: rel, line: i + 1, target: c.target, how: r.how, hits: r.hits ?? 0 })
        continue
      }
      stats.resolved++
      if (!c.spec) continue
      stats.withLine++
      const fl = readLines(r.abs)
      const n = fl ? fl.length : null
      const nums = c.spec.split(',').flatMap((p) => p.includes('-') ? p.split('-').map(Number) : [Number(p)])
      const bad = nums.filter((x) => !Number.isFinite(x) || x < 1 || (n !== null && x > n))
      if (bad.length) {
        stats.outOfRange++
        outOfRange.push({ doc: rel, line: i + 1, target: c.target, resolved: r.abs.replace(`${ROOT}/`, ''), spec: c.spec, bad, fileLines: n })
        continue
      }
      // symbol proximity (first/lo..hi window)
      if (!fl) continue
      const first = nums[0]
      const lo = Math.max(1, first - 3)
      const hi = Math.min(fl.length, nums[nums.length - 1] + 3)
      const window = fl.slice(lo - 1, hi).join('\n')
      for (const ident of idents) {
        const leaf = ident.split('.').pop()
        if (leaf.length < 3) continue
        if (c.target.includes(leaf)) continue
        stats.symbolPairs++
        if (!window.includes(leaf)) {
          stats.suspect++
          suspect.push({ doc: rel, line: i + 1, ident, target: c.target, spec: c.spec, window: `${lo}-${hi}`, snippet: line.trim().slice(0, 200) })
        }
      }
    }
  })
}

console.log(JSON.stringify({ stats, missing, outOfRange, suspect }, null, 1))
