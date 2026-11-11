/**
 * Level-card sizing guard.
 *
 * The user report: "when i select levels they dont have the same sizes when
 * getting pick". The selected card used to be the only unscaled one (the others
 * carried scale-[0.92] translate-y-1) and it grew again when its gate-progress
 * block rendered, so one card was 240x410 while its neighbours were 221x238.
 *
 * The cards now share one box in every state: the row stretches to its tallest
 * card, no card is transformed, and the selected card differs only by border,
 * ring and shadow. This suite pins that down at four viewports, in both the
 * "ungated level selected" and "gated level selected" states.
 *
 * Run:  PRAXIS_PLAYWRIGHT_MODULE=... node .e2e/level-card-sizing.mjs
 * Self-contained: starts its own mocked Vite server, no backend or Supabase.
 */
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
import path from 'node:path'
import {createServer} from '../frontend/node_modules/vite/dist/node/index.js'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PRAXIS_PLAYWRIGHT_MODULE)
const root = fileURLToPath(new URL('../frontend', import.meta.url))
process.chdir(root)

const server = await createServer({ root, configFile: path.join(root, 'vite.config.js'), server: { host: '127.0.0.1', port: 5331, strictPort: true, open: false } })
await server.listen()
const base = server.resolvedUrls.local[0].replace(/\/$/, '')
const browser = await chromium.launch({ headless: true })

const user = { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'levels@example.test', created_at: '2026-01-01T00:00:00Z', app_metadata: { provider: 'email' }, user_metadata: { name: 'Levels' } }
const now = Math.floor(Date.now() / 1000)
const token = [
  Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
  Buffer.from(JSON.stringify({ sub: user.id, aud: 'authenticated', exp: now + 3600, iat: now })).toString('base64url'),
  'e2e-signature',
].join('.')
const session = { access_token: token, refresh_token: 'e2e-refresh', token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, user }
const progress = { points: 0, stageProgress: {}, stageScores: {}, hasCompletedTutorial: false, hasSeenTutorial: false, levelsCompleted: [], stageSolutions: {}, dontAskResetAgain: true }

let passed = 0
let failed = 0
const log = (name, ok, detail = '') => {
  if (ok) passed += 1; else failed += 1
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? `  ${detail}` : ''}`)
}

const measure = page => page.evaluate(() => [...document.querySelectorAll('[data-level-card]')].map(el => {
  const r = el.getBoundingClientRect()
  const s = getComputedStyle(el)
  return {
    id: el.getAttribute('data-level-card'),
    active: el.getAttribute('data-active') === 'true',
    w: Math.round(r.width * 10) / 10,
    h: Math.round(r.height * 10) / 10,
    transform: s.transform,
    border: s.borderTopWidth,
  }
}))

async function openLevels(viewport) {
  const ctx = await browser.newContext({ viewport })
  await ctx.addInitScript(p => {
    localStorage.setItem('praxis-theme', 'light')
    localStorage.setItem('praxis-survey-hidden', 'true')
    localStorage.setItem('praxis_v1_00000000-0000-4000-8000-000000000001', JSON.stringify(p))
  }, progress)
  await ctx.route('**/*', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    if (url.hostname === 'praxis-test.invalid') {
      if (url.pathname.endsWith('/token')) return json(session)
      if (url.pathname.endsWith('/user')) return json(user)
      if (url.pathname.endsWith('/logout')) return route.fulfill({ status: 204 })
      return json(session)
    }
    if (url.origin === new URL(base).origin) {
      if (url.pathname.startsWith('/api/')) return json({ success: true, data: progress, error: null })
      return route.continue()
    }
    return route.abort()
  })
  const page = await ctx.newPage()
  page.setDefaultTimeout(25000)
  const errors = []
  page.on('pageerror', e => errors.push(String(e).slice(0, 200)))
  await page.goto(base + '/login')
  await page.locator('input[type=email]').fill(user.email)
  await page.locator('input[type=password]').fill('local-test-pass')
  await page.locator('button[type=submit]').click()
  await page.waitForURL(u => !u.pathname.startsWith('/login'))
  await page.goto(base + '/levels')
  await page.locator('[data-level-card]').first().waitFor()
  return { ctx, page, errors }
}

function assertUniform(label, cards) {
  const widths = [...new Set(cards.map(c => c.w))]
  const heights = [...new Set(cards.map(c => c.h))]
  const transforms = [...new Set(cards.map(c => c.transform))]
  const borders = [...new Set(cards.map(c => c.border))]
  const active = cards.filter(c => c.active)
  log(`${label}: one active card`, active.length === 1, active.map(c => c.id).join(','))
  log(`${label}: every card is the same width`, widths.length === 1, `widths=${widths.join('/')}`)
  log(`${label}: every card is the same height`, heights.length === 1, `heights=${heights.join('/')}`)
  log(`${label}: no card is transformed`, transforms.length === 1 && transforms[0] === 'none', `transforms=${transforms.join(' | ')}`)
  log(`${label}: every card has the same border width`, borders.length === 1, `borders=${borders.join('/')}`)
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
  const label = `${viewport.width}x${viewport.height}`
  const { ctx, page, errors } = await openLevels(viewport)

  assertUniform(`${label} tutorial selected`, await measure(page))

  await page.locator('[data-level-card="1"]').click()
  await page.waitForTimeout(800)
  const gated = await measure(page)
  assertUniform(`${label} gated level 1 selected`, gated)

  await page.locator('[data-level-card="2"]').click()
  await page.waitForTimeout(800)
  const scoreGated = await measure(page)
  assertUniform(`${label} console-gated level 2 selected`, scoreGated)
  log(`${label}: no uncaught page errors`, errors.length === 0, errors.slice(0, 2).join(' | '))
  await ctx.close()
}

await browser.close()
await server.close()
console.log(JSON.stringify({ passed, failed }))
if (failed > 0) process.exitCode = 1
