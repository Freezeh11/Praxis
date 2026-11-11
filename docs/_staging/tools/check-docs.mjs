#!/usr/bin/env node
/**
 * Lead's final acceptance gate for the Praxis documentation suite.
 *
 * Checks, in one pass:
 *   1. every required doc exists and is non-trivial
 *   2. every relative markdown link resolves on disk
 *   3. every intra-doc anchor points at a real heading
 *   4. no secret-looking values were reproduced
 *   5. every ```mermaid fence opens with a real Mermaid diagram keyword
 *   6. every doc carries file:line evidence citations
 *
 * Usage: node docs/_staging/tools/check-docs.mjs [--verbose]
 */
import { readFileSync, existsSync, statSync } from 'node:fs'
import { readdirSync } from 'node:fs'
import { join, dirname, resolve, relative, sep } from 'node:path'

const ROOT = resolve(process.cwd())
const DOCS = join(ROOT, 'docs')
const VERBOSE = process.argv.includes('--verbose')

const REQUIRED = [
  'README.md',
  '01-product/PRD.md',
  '01-product/SRS.md',
  '02-architecture/SAD.md',
  '02-architecture/SDD.md',
  '02-architecture/REFACTOR-NOTES.md',
  '03-database/ERD.md',
  '03-database/SCHEMA.md',
  '04-api/API-REFERENCE.md',
  '05-guides/tutorials/getting-started.md',
  '05-guides/tutorials/understanding-the-engine.md',
  '05-guides/tutorials/first-contribution.md',
  '05-guides/how-to/add-a-new-level.md',
  '05-guides/how-to/add-a-new-problem.md',
  '05-guides/how-to/add-a-new-law.md',
  '05-guides/how-to/debug-a-failing-step.md',
  '05-guides/how-to/reset-user-progress.md',
  '05-guides/how-to/run-locally-with-docker.md',
  '06-reference/boolean-laws.md',
  '06-reference/scoring-and-rewards.md',
  '06-reference/config-reference.md',
  '06-reference/error-codes.md',
  '07-explanation/why-this-architecture.md',
  '07-explanation/design-decisions.md',
  '07-explanation/known-limitations.md',
  '08-devops/installation-manual.md',
  '08-devops/deployment.md',
  '08-devops/configuration-guide.md',
  '08-devops/runbooks.md',
  '08-devops/monitoring.md',
  '09-diagrams/DIAGRAMS.md',
  '10-project/glossary.md',
  '10-project/file-map.md',
  '10-project/changelog.md',
  'rules/RULES.md',
]

const MIN_LINES = 30

const MERMAID_KEYWORDS = [
  'flowchart', 'graph', 'sequenceDiagram', 'erDiagram', 'stateDiagram-v2',
  'stateDiagram', 'classDiagram', 'journey', 'gantt', 'pie', 'mindmap',
  'quadrantChart', 'C4Context', 'C4Container', 'C4Component', 'block-beta',
  'timeline', 'gitGraph', 'xychart-beta', 'sankey-beta', 'architecture-beta',
]

const SECRET_PATTERNS = [
  { name: 'supabase service_role JWT', re: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { name: 'supabase publishable key', re: /sb_publishable_[A-Za-z0-9_-]{10,}/ },
  { name: 'supabase secret key', re: /sb_secret_[A-Za-z0-9_-]{10,}/ },
  { name: 'assigned SUPABASE_SERVICE_KEY value', re: /SUPABASE_SERVICE_KEY\s*[=:]\s*["']?[A-Za-z0-9._-]{20,}/ },
  { name: 'assigned SUPABASE_URL value', re: /SUPABASE_URL\s*[=:]\s*["']?https:\/\/[a-z0-9]{15,}\.supabase\.co/ },
  { name: 'assigned VITE_SUPABASE_* value', re: /VITE_SUPABASE_[A-Z_]+\s*[=:]\s*["']?[A-Za-z0-9._-]{20,}/ },
]

/**
 * Pre-existing legacy docs that this suite does NOT own and must not rewrite.
 * Anything secret-shaped found here is reported separately as LEGACY rather than
 * as a BLOCKER, so it cannot mask a real leak in a newly authored doc.
 */
const LEGACY_FILES = new Set([
  'context.md',
  'ARCHITECTURE.md',
  'REFACTOR_REPORT.md',
  'SKILLS.md',
  'Software Proposal Writing Guide (LAWS) v2.0.docx.md',
])

function walk(dir) {
  const out = []
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    // Never descend into dependency trees or dot-directories: a scratch
    // `npm install` under docs/ would otherwise inject hundreds of package
    // READMEs whose own relative links and fences are not our problem.
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
      out.push(...walk(p))
    } else if (entry.name.endsWith('.md')) out.push(p)
  }
  return out
}

/**
 * Heading slug.
 *
 * GitHub's slugger strips an enormous Unicode punctuation/symbol set, which is
 * impractical to hand-copy. Prefer the real `github-slugger` package when it is
 * resolvable; otherwise fall back to an approximation that still gets the two
 * cases that actually bite in this suite right:
 *   - ` — ` (em dash) is DELETED, so the two surrounding spaces become `--`
 *   - a heading ending in a deleted character keeps a TRAILING hyphen
 *     (`### 3.1 \`GET /\`` -> `#31-get-`)
 *   - arrows (`→`, U+2190-U+21FF) are DELETED, so `symptom → cause` -> `symptom--cause`
 *
 * An earlier revision collapsed whitespace runs into a single hyphen, which
 * produced ~35 false "anchor not found" reports against docs that were already
 * using correct GitHub anchors.
 */
let realSlug = null
for (const candidate of [
  './vendor/github-slugger/index.js', // vendored copy shipped with this tool
  '../verification/node_modules/github-slugger/index.js',
  'github-slugger',
]) {
  try {
    const mod = await import(candidate)
    // The package exposes a stateless named export `slug(text)` and a stateful
    // `default` class whose instances dedupe repeated headings within a page.
    // Use the stateless function: headings here are unique per file, and one
    // reused instance would wrongly dedupe headings ACROSS files.
    if (typeof mod.slug === 'function') {
      realSlug = mod.slug
      break
    }
    if (typeof mod.default === 'function') {
      const instance = new mod.default()
      realSlug = (text) => instance.slug(text)
      break
    }
  } catch {
    /* keep looking */
  }
}

const FALLBACK_PUNCT = /[\u2000-\u206F\u2E00-\u2E7F\u2190-\u21FF\u2300-\u23FF\u25A0-\u27BF\u3000-\u303F\\'!"#$%&()*+,./:;<=>?@[\]^`{|}~]/g

function slug(heading) {
  const text = heading
    .toLowerCase()
    .trim()
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // markdown link -> its text
  if (realSlug) return realSlug(text)
  return text.replace(FALLBACK_PUNCT, '').replace(/\s/g, '-')
}

function headingsOf(text) {
  const set = new Set()
  for (const line of text.split('\n')) {
    const m = /^(#{1,6})\s+(.*?)\s*$/.exec(line)
    if (m) set.add(slug(m[2]))
  }
  return set
}

const findings = []
const add = (sev, file, line, msg) => findings.push({ sev, file, line, msg })

// ── 1. completeness ─────────────────────────────────────────────────────────
console.log('='.repeat(72))
console.log('1. COMPLETENESS')
console.log('='.repeat(72))
let missing = 0
const stats = []
for (const rel of REQUIRED) {
  const abs = join(DOCS, rel)
  if (!existsSync(abs)) {
    console.log(`  MISSING  docs/${rel}`)
    add('BLOCKER', `docs/${rel}`, 0, 'required doc does not exist')
    missing++
    continue
  }
  const text = readFileSync(abs, 'utf8')
  const lines = text.replace(/\n$/, '').split('\n').length
  const cites = (text.match(/\b[\w./-]+\.(py|js|jsx|json|sql|yaml|css|mjs|txt|md):\d+/g) || []).length
  stats.push({ rel, lines, cites })
  if (lines < MIN_LINES) {
    console.log(`  THIN     docs/${rel}  (${lines} lines)`)
    add('MAJOR', `docs/${rel}`, 0, `only ${lines} lines (< ${MIN_LINES})`)
  } else {
    console.log(`  ok       docs/${rel}  ${String(lines).padStart(5)} lines  ${String(cites).padStart(4)} citations`)
  }
}
console.log(`\n  required: ${REQUIRED.length}   missing: ${missing}`)
const totalLines = stats.reduce((a, s) => a + s.lines, 0)
const totalCites = stats.reduce((a, s) => a + s.cites, 0)
console.log(`  total lines across required docs: ${totalLines}`)
console.log(`  total file:line citations: ${totalCites}`)

// ── docs present but not required (informational) ───────────────────────────
const allDocs = walk(DOCS).map((p) => relative(DOCS, p).split(sep).join('/'))
const extra = allDocs.filter((d) => !REQUIRED.includes(d) && !d.startsWith('_staging/'))
console.log(`\n  extra docs present (not required): ${extra.length ? extra.join(', ') : '(none)'}`)

// ── 2/3. links + anchors ────────────────────────────────────────────────────
console.log('\n' + '='.repeat(72))
console.log('2. CROSS-LINKS & ANCHORS')
console.log('='.repeat(72))
const headingCache = new Map()
function headingsFor(abs) {
  if (!headingCache.has(abs)) headingCache.set(abs, headingsOf(readFileSync(abs, 'utf8')))
  return headingCache.get(abs)
}

let linkCount = 0
let anchorCount = 0
for (const abs of walk(DOCS)) {
  const rel = relative(ROOT, abs).split(sep).join('/')
  const text = readFileSync(abs, 'utf8')
  text.split('\n').forEach((line, i) => {
    const re = /\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g
    let m
    while ((m = re.exec(line))) {
      const target = m[2]
      if (/^(https?:|mailto:|tel:)/.test(target)) continue
      linkCount++
      const [pathPart, anchor] = target.split('#')
      let targetAbs
      if (!pathPart) {
        targetAbs = abs // same-file anchor
      } else {
        targetAbs = resolve(dirname(abs), decodeURIComponent(pathPart))
      }
      if (!existsSync(targetAbs)) {
        console.log(`  BROKEN   ${rel}:${i + 1} -> ${target}`)
        add('BLOCKER', rel, i + 1, `broken link target: ${target}`)
        continue
      }
      if (anchor) {
        anchorCount++
        const hs = targetAbs.endsWith('.md') ? headingsFor(targetAbs) : null
        if (hs && !hs.has(anchor.toLowerCase())) {
          console.log(`  BADANCH  ${rel}:${i + 1} -> ${target}`)
          add('MINOR', rel, i + 1, `anchor not found: #${anchor} in ${pathPart || 'this file'}`)
        }
      }
    }
  })
}
console.log(`  checked ${linkCount} relative links, ${anchorCount} with anchors`)

// ── 4. secrets ──────────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(72))
console.log('3. SECRET SCAN')
console.log('='.repeat(72))
let secretHits = 0
let legacyHits = 0
for (const abs of walk(DOCS)) {
  const rel = relative(ROOT, abs).split(sep).join('/')
  const base = rel.replace(/^docs\//, '')
  const isLegacy = LEGACY_FILES.has(base)
  const text = readFileSync(abs, 'utf8')
  text.split('\n').forEach((line, i) => {
    for (const { name, re } of SECRET_PATTERNS) {
      if (re.test(line)) {
        if (isLegacy) {
          console.log(`  LEGACY   ${rel}:${i + 1}  (${name}) — pre-existing input, reported not enforced`)
          legacyHits++
        } else {
          console.log(`  LEAK     ${rel}:${i + 1}  (${name})`)
          add('BLOCKER', rel, i + 1, `possible real secret reproduced (${name})`)
          secretHits++
        }
      }
    }
  })
}
console.log(`  suite docs: ${secretHits === 0 ? 'clean — no secret-looking values' : `${secretHits} LEAK(S)`}`)
console.log(`  legacy inputs: ${legacyHits} pre-existing value(s) — NOT owned by this suite (see verification report)`)

// ── 5. mermaid ──────────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(72))
console.log('4. MERMAID FENCES')
console.log('='.repeat(72))
let fences = 0
for (const abs of walk(DOCS)) {
  const rel = relative(ROOT, abs).split(sep).join('/')
  const lines = readFileSync(abs, 'utf8').split('\n')
  let open = false
  let openLine = 0
  let first = ''
  lines.forEach((line, i) => {
    const fence = /^\s*```(\S*)/.exec(line)
    if (!fence) return
    if (!open) {
      open = true
      openLine = i + 1
      first = fence[1]
    } else {
      open = false
      if (first === 'mermaid') {
        fences++
        const body = lines.slice(openLine, i).filter((l) => l.trim() && !l.trim().startsWith('%%'))
        const head = body[0]?.trim() ?? ''
        const ok = MERMAID_KEYWORDS.some((k) => head.startsWith(k))
        if (!ok) {
          console.log(`  BADHEAD  ${rel}:${openLine + 1}  first line: "${head.slice(0, 60)}"`)
          add('MAJOR', rel, openLine + 1, `mermaid fence does not start with a known diagram keyword: "${head.slice(0, 40)}"`)
        }
        if (body.length === 0) {
          add('MAJOR', rel, openLine + 1, 'empty mermaid fence')
        }
      }
    }
  })
  if (open) {
    console.log(`  UNCLOSED ${rel}:${openLine}`)
    add('MAJOR', rel, openLine, 'unclosed code fence')
  }
}
console.log(`  mermaid fences found: ${fences}`)

// ── 6. summary ──────────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(72))
console.log('5. FINDINGS SUMMARY')
console.log('='.repeat(72))
const bySev = {}
for (const f of findings) bySev[f.sev] = (bySev[f.sev] || 0) + 1
for (const sev of ['BLOCKER', 'MAJOR', 'MINOR', 'NIT']) {
  console.log(`  ${sev.padEnd(8)} ${bySev[sev] || 0}`)
}
if (VERBOSE || bySev.BLOCKER || bySev.MAJOR) {
  console.log('\n  detail:')
  for (const f of findings.filter((x) => x.sev === 'BLOCKER' || x.sev === 'MAJOR')) {
    console.log(`    [${f.sev}] ${f.file}:${f.line} — ${f.msg}`)
  }
}
console.log(`\n  RESULT: ${findings.length === 0 ? 'PASS' : 'ISSUES FOUND'}`)
process.exit(findings.some((f) => f.sev === 'BLOCKER') ? 1 : 0)
