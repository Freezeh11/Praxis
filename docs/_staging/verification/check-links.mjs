/**
 * Independent cross-link + anchor checker.
 *
 * Uses the REAL `github-slugger` package (extracted from GitHub's own implementation)
 * with per-file state, which is how GitHub numbers duplicate headings.
 *
 * Checks, for every required-suite Markdown file:
 *   1. every relative link target resolves on disk;
 *   2. every `#fragment` matches a heading slug in the target file.
 *
 * Prints machine-readable JSON: per-file heading slugs, and every failure.
 */
import fs from 'node:fs'
import path from 'node:path'
import GithubSlugger from 'github-slugger'

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

/** Heading text as GitHub renders it: drop the leading #s, unwrap links, decode a few entities. */
function headingText(raw) {
  return raw
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')   // [text](url) -> text
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
}

function slugsFor(abs) {
  const slugger = new GithubSlugger()
  const text = fs.readFileSync(abs, 'utf8')
  const inFence = { open: false, marker: '' }
  const out = []
  for (const line of text.split('\n')) {
    const fence = /^\s*(```+|~~~+)/.exec(line)
    if (fence) {
      if (!inFence.open) { inFence.open = true; inFence.marker = fence[1][0] }
      else if (fence[1][0] === inFence.marker) { inFence.open = false }
      continue
    }
    if (inFence.open) continue
    const m = /^(#{1,6})\s+(.*?)\s*$/.exec(line)
    if (m) out.push({ heading: m[2], slug: slugger.slug(headingText(m[2])) })
  }
  return out
}

const slugCache = new Map()
function slugs(abs) {
  if (!slugCache.has(abs)) slugCache.set(abs, slugsFor(abs))
  return slugCache.get(abs)
}

// ---- also index the legacy files so links into them can be checked -------------
const EXTRA = ['context.md', 'ARCHITECTURE.md', 'REFACTOR_REPORT.md', 'SKILLS.md',
  'Software Proposal Writing Guide (LAWS) v2.0.docx.md']

const LINK = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g

const stats = { files: 0, links: 0, anchorLinks: 0, brokenFiles: 0, brokenAnchors: 0, samePageAnchors: 0 }
const brokenFiles = []
const brokenAnchors = []

for (const rel of [...REQUIRED, ...EXTRA]) {
  const abs = path.join(DOCS, rel)
  if (!fs.existsSync(abs)) { brokenFiles.push({ doc: rel, line: 0, target: '(FILE ITSELF MISSING)' }); continue }
  stats.files++
  const lines = fs.readFileSync(abs, 'utf8').split('\n')
  const selfSlugs = new Set(slugs(abs).map((s) => s.slug))
  lines.forEach((line, i) => {
    let m
    LINK.lastIndex = 0
    while ((m = LINK.exec(line)) !== null) {
      let target = m[1]
      if (/^(https?:|mailto:|tel:)/.test(target)) continue
      stats.links++
      const [filePart, frag] = target.split('#')
      const fragEnc = frag
      if (frag !== undefined) stats.anchorLinks++
      if (filePart === '' || filePart === undefined) {
        // same-page anchor
        stats.samePageAnchors++
        const want = decodeURIComponent(frag)
        if (!selfSlugs.has(want)) brokenAnchors.push({ doc: rel, line: i + 1, target, want, how: 'same-page' })
        continue
      }
      const decoded = decodeURIComponent(filePart)
      let resolved = path.resolve(path.dirname(abs), decoded)
      if (!fs.existsSync(resolved)) resolved = path.join(ROOT, decoded)
      if (!fs.existsSync(resolved)) {
        stats.brokenFiles++
        brokenFiles.push({ doc: rel, line: i + 1, target })
        continue
      }
      if (frag === undefined || frag === '') continue
      const want = decodeURIComponent(fragEnc)
      const have = new Set(slugs(resolved).map((s) => s.slug))
      if (!have.has(want)) {
        stats.brokenAnchors++
        brokenAnchors.push({
          doc: rel, line: i + 1, target,
          resolved: path.relative(ROOT, resolved), want,
          closest: [...have].filter((h) => h.startsWith(want.slice(0, 12))).slice(0, 3),
        })
      }
    }
  })
}

console.log(JSON.stringify({ stats, brokenFiles, brokenAnchors }, null, 1))
