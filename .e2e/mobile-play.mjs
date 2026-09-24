import { readFileSync } from 'node:fs'
import { chromium } from '/home/xris/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core/index.mjs'

const BASE = 'http://127.0.0.1:5173'
const EMAIL = 'e2e-test@praxis.test'
const PASSWORD = 'E2eTest!2345'
const results = []
const log = (name, ok, extra = '') => {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${extra ? ' | ' + extra : ''}`)
}

const envText = readFileSync('/home/xris/Documents/GitHub/Praxis/backend/.env', 'utf8')
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=')).map(l => {
  const [k, ...rest] = l.split('=')
  return [k.trim(), rest.join('=').trim().replace(/^"|"$/g, '')]
}))
const SERVICE_KEY = env.SUPABASE_SERVICE_KEY
const authHeaders = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
const adminRes = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/admin/users?page=1&per_page=50`, { headers: authHeaders })
const adminData = await adminRes.json()
const user = (adminData.users || []).find(u => u.email === EMAIL)
for (const table of ['stage_progress', 'user_progress', 'score_history']) {
  await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${table}?user_id=eq.${user.id}`, {
    method: 'DELETE', headers: { ...authHeaders, Prefer: 'return=minimal' },
  })
}

const browser = await chromium.launch({
  executablePath: '/home/xris/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',
  args: ['--no-sandbox', '--disable-gpu', '--no-zygote', '--disable-dev-shm-usage'],
})

// iPhone SE 2016-size viewport with touch emulation
const ctx = await browser.newContext({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true })
const page = await ctx.newPage()
await page.addInitScript(() => localStorage.setItem('praxis_hide_survey', 'true'))

// Login on the small screen
await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
await page.fill('input[type="email"]', EMAIL)
await page.fill('input[type="password"]', PASSWORD)
await page.tap('button[type="submit"]')
await page.waitForTimeout(2500)
log('login works on 320px phone', !page.url().includes('/login'))

// Game: Level 1 Stage 1 at 320x568
await page.goto(BASE + '/level/1/stage/0', { waitUntil: 'networkidle' })
await page.waitForSelector('[data-path="R.0"]', { timeout: 8000 })
const mainW = await page.locator('main').evaluate(el => Math.round(el.getBoundingClientRect().width))
log('workspace fills phone width', mainW > 280, `main=${mainW}px`)

// Solve with taps
await page.tap('[data-path="R.0"]')
await page.waitForTimeout(400)
await page.tap('[data-path="R.1"]')
await page.waitForTimeout(600)
const lawBtn = await page.locator('button:has-text("Absorption Law")').count()
log('absorption law appears after taps', lawBtn > 0)
await page.tap('button:has-text("Absorption Law")')
await page.waitForTimeout(3500)
log('stage completes on phone', (await page.locator('text=Stage Complete!').count()) > 0)

// Dismiss modal, open the steps drawer
const review = await page.locator('button:has-text("Review Completed Derivation")').count()
if (review > 0) {
  await page.tap('button:has-text("Review Completed Derivation")')
  await page.waitForTimeout(400)
}
await page.tap('button[title="Step history"]')
await page.waitForTimeout(600)
const drawerVisible = await page.locator('aside').first().evaluate(el => {
  const r = el.getBoundingClientRect()
  return r.left >= -2 && r.width > 200
})
log('step history drawer slides in', drawerVisible === true)
await page.tap('aside button[title="Close"]')
await page.waitForTimeout(500)

// Stages drawer
await page.tap('button[title="Level progress and stages"]')
await page.waitForTimeout(600)
const stagesDrawer = await page.locator('aside').last().evaluate(el => {
  const r = el.getBoundingClientRect()
  return r.right <= window.innerWidth + 2 && r.width > 200
})
log('stages drawer slides in', stagesDrawer === true)

await ctx.close()
await browser.close()

const fails = results.filter(r => !r.ok)
console.log(`\n${results.length - fails.length}/${results.length} passed`)
process.exit(fails.length > 0 ? 1 : 0)
