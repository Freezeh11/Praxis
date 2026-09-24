import { readFileSync } from 'node:fs'
import { chromium } from '/home/xris/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core/index.mjs'

const BASE = 'http://127.0.0.1:5173'
const EMAIL = 'e2e-test@praxis.test'
const PASSWORD = 'E2eTest!2345'

const envText = readFileSync('/home/xris/Documents/GitHub/Praxis/backend/.env', 'utf8')
const env = Object.fromEntries(
  envText.split('\n').filter(l => l.includes('=')).map(l => {
    const [k, ...rest] = l.split('=')
    return [k.trim(), rest.join('=').trim().replace(/^"|"$/g, '')]
  }),
)
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
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } })
await page.addInitScript(() => localStorage.setItem('praxis_hide_survey', 'true'))


// Login
await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
await page.fill('input[type="email"]', EMAIL)
await page.fill('input[type="password"]', PASSWORD)
await page.click('button[type="submit"]')
await page.waitForTimeout(2500)

// SOP stage with 3 steps (L1 stage 3: x'y + xy + xy -> y) — richer derivation
await page.goto(BASE + '/level/1/stage/2', { waitUntil: 'networkidle' })
await page.waitForSelector('[data-path="R.0"]', { timeout: 8000 })
// step 1: idempotent on the two xy terms (R.1, R.2)
await page.locator('[data-path="R.1"]').first().click()
await page.waitForTimeout(250)
await page.locator('[data-path="R.2"]').first().click()
await page.waitForTimeout(600)
await page.screenshot({ path: '/home/xris/Documents/GitHub/Praxis/.e2e/shot-1-laws-available.png' })
await page.click('button:has-text("Idempotent")')
await page.waitForTimeout(2400)
// step 2: distributive factor on x'y + xy -> y(x' + x)
await page.locator('[data-path="R.0"]').first().click()
await page.waitForTimeout(250)
await page.locator('[data-path="R.1"]').first().click()
await page.waitForTimeout(600)
await page.screenshot({ path: '/home/xris/Documents/GitHub/Praxis/.e2e/shot-2-selected.png' })
await page.click('button:has-text("Distributive")')
await page.waitForTimeout(2400)
// step 3: complement on the x' + x sum inside
await page.locator('[data-path="R.0.1.0"]').count().then(async c => {
  if (c > 0) {
    await page.locator('[data-path="R.0.1.0"]').first().click()
    await page.waitForTimeout(250)
    await page.locator('[data-path="R.0.1.1"]').first().click()
    await page.waitForTimeout(600)
    await page.click('button:has-text("Complement")')
    await page.waitForTimeout(2400)
  }
})
await page.waitForTimeout(2500)
await page.screenshot({ path: '/home/xris/Documents/GitHub/Praxis/.e2e/shot-3-law-comments.png' })

// Click the first step's law connector to reveal the context card
const connectors = await page.locator('[data-inspect-trigger="true"]').count()
if (connectors > 0) {
  await page.locator('[data-inspect-trigger="true"]').first().click()
  await page.waitForTimeout(600)
  await page.screenshot({ path: '/home/xris/Documents/GitHub/Praxis/.e2e/shot-4-law-context-card.png' })
}

await browser.close()
console.log('screenshots saved')
