/**
 * Level-card sizing guard.
 *
 * The user report: "when i select levels they dont have the same sizes when
 * getting pick". The selected card used to be the only unscaled one (the others
 * carried scale-[0.92] translate-y-1) and it grew again when its gate-progress
 * block rendered, so one card was 240x410 while its neighbours were 221x238.
 *
 * The follow-up request: "when they get pick they should get bigger or have
 * like glowing effects animation". The chosen card now lifts by a transform and
 * carries a halo, so it must still not change any card's LAYOUT box: the row
 * may not reflow, and only the active card may be transformed.
 *
 * This suite pins both rules down at four viewports, in the ungated-selected,
 * gated-level-selected and score-gated-selected states.
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
  const halo = el.parentElement.querySelector('.level-glow')
  const hs = halo ? getComputedStyle(halo) : null
  return {
    id: el.getAttribute('data-level-card'),
    active: el.getAttribute('data-active') === 'true',
    layoutW: el.offsetWidth,
    layoutH: el.offsetHeight,
    rectW: Math.round(r.width * 10) / 10,
    rectH: Math.round(r.height * 10) / 10,
    transform: s.transform,
    border: s.borderTopWidth,
    haloOpacity: hs ? Number(hs.opacity) : null,
    haloAnimation: hs ? hs.animationName : null,
    haloBackground: hs ? hs.backgroundImage : null,
  }
}))

async function openLevels(viewport, theme = 'light') {
  const ctx = await browser.newContext({ viewport })
  await ctx.addInitScript(({ p, theme }) => {
    localStorage.setItem('praxis-theme', theme)
    localStorage.setItem('praxis-survey-hidden', 'true')
    localStorage.setItem('praxis_v1_00000000-0000-4000-8000-000000000001', JSON.stringify(p))
  }, { p: progress, theme })
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
  const widths = [...new Set(cards.map(c => c.layoutW))]
  const heights = [...new Set(cards.map(c => c.layoutH))]
  const borders = [...new Set(cards.map(c => c.border))]
  const active = cards.filter(c => c.active)
  const inactive = cards.filter(c => !c.active)
  log(`${label}: one active card`, active.length === 1, active.map(c => c.id).join(','))
  log(`${label}: every card has the same layout width`, widths.length === 1, `widths=${widths.join('/')}`)
  log(`${label}: every card has the same layout height`, heights.length === 1, `heights=${heights.join('/')}`)
  log(`${label}: every card has the same border width`, borders.length === 1, `borders=${borders.join('/')}`)
  log(`${label}: inactive cards are not transformed`, inactive.every(c => c.transform === 'none'), `transforms=${[...new Set(inactive.map(c => c.transform))].join(' | ')}`)
  log(`${label}: inactive cards paint at their layout size`, inactive.every(c => Math.abs(c.rectW - c.layoutW) < 1.2 && Math.abs(c.rectH - c.layoutH) < 1.2))
  const growW = active[0] ? active[0].rectW / active[0].layoutW : 0
  const growH = active[0] ? active[0].rectH / active[0].layoutH : 0
  log(`${label}: the active card is scaled up 2-6%`, growW > 1.02 && growW < 1.06 && growH > 1.02 && growH < 1.06, `grow=${growW.toFixed(3)}/${growH.toFixed(3)}`)
}

const clipping = page => page.evaluate(() => {
  const active = document.querySelector('[data-level-card][data-active="true"]')
  if (!active) return null
  const a = active.getBoundingClientRect()
  const scrolls = document.documentElement.scrollHeight > window.innerHeight + 1
  return { left: a.left, right: window.innerWidth - a.right, top: a.top, bottom: window.innerHeight - a.bottom, scrolls }
})

function assertNoClip(label, box) {
  // On a short landscape viewport the levels page scrolls vertically, so a card may
  // legitimately reach below the fold. Horizontal containment always holds; vertical
  // containment is asserted only when the page cannot scroll to reveal the card.
  const withinSides = box && box.left >= -0.5 && box.right >= -0.5
  const withinHeight = !box || box.scrolls || (box.top >= -0.5 && box.bottom >= -0.5)
  const ok = Boolean(box) && withinSides && withinHeight
  log(`${label}: the lifted card stays inside the viewport`, ok, box ? `l=${box.left.toFixed(1)} r=${box.right.toFixed(1)} t=${box.top.toFixed(1)} b=${box.bottom.toFixed(1)} scrolls=${box.scrolls}` : 'no box')
}

function assertHalo(label, cards) {
  const active = cards.find(c => c.active)
  const inactive = cards.filter(c => !c.active)
  log(`${label}: the active card has a halo`, Boolean(active) && active.haloOpacity > 0.35, `opacity=${active && active.haloOpacity}`)
  log(`${label}: the halo is animated`, Boolean(active) && active.haloAnimation === 'praxis-level-glow', `animation=${active && active.haloAnimation}`)
  log(`${label}: the halo is a gradient, not a flat fill`, Boolean(active) && /gradient/.test(active.haloBackground || ''))
  log(`${label}: other cards carry no halo`, inactive.every(c => c.haloOpacity === 0))
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
  const label = `${viewport.width}x${viewport.height}`
  const { ctx, page, errors } = await openLevels(viewport)

  const initial = await measure(page)
  assertUniform(`${label} tutorial selected`, initial)
  assertHalo(`${label} tutorial selected`, initial)
  assertNoClip(`${label} tutorial selected`, await clipping(page))

  await page.locator('[data-level-card="1"]').click()
  await page.waitForTimeout(900)
  const gated = await measure(page)
  assertUniform(`${label} gated level 1 selected`, gated)
  assertHalo(`${label} gated level 1 selected`, gated)
  assertNoClip(`${label} gated level 1 selected`, await clipping(page))

  await page.locator('[data-level-card="2"]').click()
  await page.waitForTimeout(900)
  const scoreGated = await measure(page)
  assertUniform(`${label} console-gated level 2 selected`, scoreGated)
  assertHalo(`${label} console-gated level 2 selected`, scoreGated)
  assertNoClip(`${label} console-gated level 2 selected`, await clipping(page))
  const brandClear = await page.evaluate(() => {
    const brand = document.querySelector('a[aria-label="Praxis home"]')
    const controls = document.querySelector('header > div:last-child')
    if (!brand || !controls) return null
    return { wordmarkRight: brand.getBoundingClientRect().right, controlsLeft: controls.getBoundingClientRect().left, gap: controls.getBoundingClientRect().left - brand.getBoundingClientRect().right }
  })
  log(`${label}: the wordmark is never squeezed by the header controls`, Boolean(brandClear) && brandClear.gap >= 2, brandClear ? `gap=${brandClear.gap.toFixed(1)}` : 'no header')
  const pageOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  log(`${label}: the page never scrolls sideways`, pageOverflow <= 1, `overflow=${pageOverflow}`)
  log(`${label}: no uncaught page errors`, errors.length === 0, errors.slice(0, 2).join(' | '))

  await ctx.close()

  if (viewport.width === 1440 || viewport.width === 390) {
    for (const theme of viewport.width === 390 ? ['light'] : ['light', 'dark']) {
      const shot = await openLevels(viewport, theme)
      await shot.page.waitForTimeout(900)
      // The script chdirs into frontend/ to run Vite, so resolve the output
      // directory against this file, not the current working directory.
      await shot.page.screenshot({ path: fileURLToPath(new URL(`_results/ui-audit/level-glow-${viewport.width}-${theme}.png`, import.meta.url)) })
      await shot.ctx.close()
    }
  }
}

await browser.close()
await server.close()
console.log(JSON.stringify({ passed, failed }))
if (failed > 0) process.exitCode = 1
