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

/* ── Read Supabase credentials from backend/.env ── */
const envText = readFileSync('/home/xris/Documents/GitHub/Praxis/backend/.env', 'utf8')
const env = Object.fromEntries(
  envText.split('\n').filter(l => l.includes('=')).map(l => {
    const [k, ...rest] = l.split('=')
    return [k.trim(), rest.join('=').trim().replace(/^"|"$/g, '')]
  }),
)
const SUPABASE_URL = env.SUPABASE_URL.replace(/\/$/, '')
const SERVICE_KEY = env.SUPABASE_SERVICE_KEY

/* ── Reset test user's server progress for a clean run ── */
const authHeaders = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
const adminRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=50`, { headers: authHeaders })
const adminData = await adminRes.json()
const user = (adminData.users || []).find(u => u.email === EMAIL)
if (!user) {
  console.log('FAIL | test user not found in Supabase')
  process.exit(1)
}
const userId = user.id
console.log(`INFO | resetting progress for test user ${userId}`)
for (const table of ['stage_progress', 'user_progress', 'score_history']) {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?user_id=eq.${userId}`, {
    method: 'DELETE',
    headers: { ...authHeaders, Prefer: 'return=minimal' },
  })
}

const browser = await chromium.launch({
  executablePath: '/home/xris/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',
  args: ['--no-sandbox', '--disable-gpu', '--no-zygote', '--disable-dev-shm-usage'],
})
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } })
await page.addInitScript(() => localStorage.setItem('praxis_hide_survey', 'true'))

page.on('pageerror', err => console.log('PAGE ERROR:', err.message))

/* ── 1. Login ── */
await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
await page.fill('input[type="email"]', EMAIL)
await page.fill('input[type="password"]', PASSWORD)
await page.click('button[type="submit"]')
await page.waitForTimeout(2500)
const afterLogin = page.url()
log('login succeeds and lands in app', !afterLogin.includes('/login'), afterLogin)

/* ── 2. Level 1 Stage 1 (SOP): x + xy -> x, verify law comment ── */
await page.goto(BASE + '/level/1/stage/0', { waitUntil: 'networkidle' })
await page.waitForSelector('[data-path="R.0"]', { timeout: 8000 })
await page.locator('[data-path="R.0"]').first().click()
await page.waitForTimeout(400)
await page.locator('[data-path="R.1"]').first().click()
await page.waitForTimeout(600)
const lawBtn1 = await page.locator('button:has-text("Absorption Law")').count()
log('SOP: Absorption Law appears after selecting x and xy', lawBtn1 > 0)
await page.click('button:has-text("Absorption Law")')
await page.waitForTimeout(3500)
const success1 = await page.locator('text=Stage Complete!').count()
const lawComment = await page.locator('text=Absorption Law').count()
log('SOP: stage completes after applying law', success1 > 0)
log('SOP: law comment rendered beside derivation', lawComment > 0, `matches=${lawComment}`)

/* ── 3. Level 1 Stage 2 (POS): x(x + y) -> x ── */
await page.goto(BASE + '/level/1/stage/1', { waitUntil: 'networkidle' })
await page.waitForSelector('[data-path="R.0"]', { timeout: 8000 })
await page.locator('[data-path="R.0"]').first().click()
await page.waitForTimeout(400)
await page.locator('[data-path="R.1"]').first().click()
await page.waitForTimeout(600)
const posLawCount = await page.locator('button:has-text("Absorption")').count()
log('POS: absorption (product) law available on clause selection', posLawCount > 0, `lawButtons=${posLawCount}`)
await page.click('button:has-text("Absorption")')
await page.waitForTimeout(3500)
const success2 = await page.locator('text=Stage Complete!').count()
log('POS: x(x + y) solves to x', success2 > 0)

/* ── 4. Level 3 Stage 1 (4-var): wxyz + wxz + wyz + w -> wxz + w ── */
await page.goto(BASE + '/level/3/stage/0', { waitUntil: 'networkidle' })
await page.waitForSelector('[data-path="R.3"]', { timeout: 8000 })
// Step 1: absorb wxyz into wxz (select R.1=wxz, R.0=wxyz)
await page.locator('[data-path="R.1"]').first().click()
await page.waitForTimeout(300)
await page.locator('[data-path="R.0"]').first().click()
await page.waitForTimeout(500)
const fourVarLaw1 = await page.locator('button:has-text("Absorption Law")').count()
log('4-var: law available on wxz + wxyz selection', fourVarLaw1 > 0)
await page.click('button:has-text("Absorption Law")')
await page.waitForTimeout(2400)
// After absorption the terms shift: R.0=wxz, R.1=wyz, R.2=w
// Step 2: absorb wyz into w (select R.2=w, R.1=wyz)
await page.locator('[data-path="R.2"]').first().click()
await page.waitForTimeout(300)
await page.locator('[data-path="R.1"]').first().click()
await page.waitForTimeout(500)
const fourVarLaw2 = await page.locator('button:has-text("Absorption Law")').count()
log('4-var: law available on w + wyz selection', fourVarLaw2 > 0)
await page.click('button:has-text("Absorption Law")')
await page.waitForTimeout(3500)
const success3 = await page.locator('text=Stage Complete!').count()
log('4-var Level 3: wxyz + wxz + wyz + w solves to wxz + w', success3 > 0)

/* ── 5. Sandbox: dice randomize with hover tooltip ── */
await page.goto(BASE + '/sandbox', { waitUntil: 'networkidle' })
await page.waitForSelector('button[title*="Randomize"]', { timeout: 8000 })
const dice = page.locator('button[title*="Randomize"]')
// Hover shows the explanatory tooltip
await dice.hover()
await page.waitForTimeout(300)
const tooltipVisible = await page.locator('text=Randomize the equation with a solver-verified problem').count()
log('sandbox dice button hover tooltip explains what it does', tooltipVisible === 1)
// Clicking the dice fills the expression input
await dice.click()
await page.waitForTimeout(600)
const filledValue = await page.inputValue('input[placeholder*="x\'y"]')
log('dice button loads a random equation into the input', filledValue.length > 3, filledValue)
// Start the randomized equation
await page.click('text=Start simplifying')
await page.waitForTimeout(2500)
const sandboxGoal = await page.locator('text=Goal:').first().textContent().catch(() => '')
log('sandbox starts the randomized equation', sandboxGoal.includes('Goal:'), sandboxGoal.trim())
// The workspace header Randomize button loads a fresh problem
await page.click('button[title*="new random, solver-verified equation"]')
await page.waitForTimeout(2500)
const sandboxGoal2 = await page.locator('text=Goal:').first().textContent().catch(() => '')
log('sandbox workspace randomize button loads a new problem', sandboxGoal2.includes('Goal:'), sandboxGoal2.trim())

/* ── 6. Tutorial: blinking guide highlights ── */
await page.goto(BASE + '/tutorial', { waitUntil: 'networkidle' })
await page.click('button:has-text("Start the tutorial")')
await page.waitForTimeout(400)
// Step 2: the term x (R.0) must carry the pulsing guide highlight
const guideClass = await page.locator('[data-path="R.0"]').first().evaluate(el => el.className || '')
log('tutorial blinks the term x to click', guideClass.includes('guidePulse'), '')
// Select x and xy to reach the law step, then check the law card blinks
await page.locator('[data-path="R.0"]').first().click()
await page.waitForTimeout(900)
await page.locator('[data-path="R.1"]').first().click()
await page.waitForTimeout(900)
const lawHighlight = await page.locator('button.law-highlight').count()
log('tutorial blinks the Absorption Law card to apply', lawHighlight === 1, `highlighted=${lawHighlight}`)

await browser.close()

const fails = results.filter(r => !r.ok)
console.log(`\n${results.length - fails.length}/${results.length} passed`)
process.exit(fails.length > 0 ? 1 : 0)
