#!/usr/bin/env node
/**
 * Extract every ```mermaid fence from a markdown file and parse it with the real
 * Mermaid parser (v12) inside a jsdom DOM. Exits non-zero if any fence fails.
 *
 * Usage: node validate-mermaid.mjs <file.md>
 *
 * Staging-only tool for task-7 (diagrams). Deleted with .mermaid-check/ before delivery.
 */
import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'

const file = process.argv[2]
if (!file) {
  console.error('usage: node validate-mermaid.mjs <file.md>')
  process.exit(2)
}

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { pretendToBeVisual: true })
globalThis.window = dom.window
globalThis.document = dom.window.document
globalThis.DOMPurify = (await import('dompurify')).default(dom.window)
if (!globalThis.navigator) {
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true })
}

const mermaid = (await import('mermaid')).default
mermaid.initialize({ startOnLoad: false, securityLevel: 'loose' })

const md = readFileSync(file, 'utf8')
const lines = md.split('\n')

const fences = []
let current = null
lines.forEach((line, i) => {
  const m = line.match(/^```(\w[\w-]*)\s*$/)
  if (m && !current) {
    current = { start: i + 1, body: m[1] === 'mermaid' ? [] : null }
    return
  }
  if (/^```\s*$/.test(line) && current) {
    if (current.body) fences.push({ start: current.start, end: i + 1, text: current.body.join('\n') })
    current = null
    return
  }
  if (current && current.body) current.body.push(line)
})

console.log(`File: ${file}`)
console.log(`Mermaid fences found: ${fences.length}`)

let failures = 0
for (const [idx, fence] of fences.entries()) {
  const firstLine = fence.text.split('\n').find((l) => l.trim()) || '(empty)'
  const label = `#${idx + 1} (line ${fence.start}) ${firstLine.trim()}`
  try {
    const res = await mermaid.parse(fence.text)
    const type = res && res.diagramType ? res.diagramType : 'ok'
    console.log(`  PASS ${label} -> ${type}`)
  } catch (err) {
    failures++
    console.log(`  FAIL ${label}`)
    console.log(`       ${String(err.message || err).split('\n').slice(0, 14).join('\n       ')}`)
  }
}
console.log(failures === 0 ? `\nALL ${fences.length} MERMAID FENCES PARSE OK` : `\n${failures} FENCE(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
