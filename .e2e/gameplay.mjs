import { launch, readEnv, HIDE_SURVEY, progressKey } from './_harness.mjs'

const BASE = process.env.PRAXIS_BASE_URL || 'http://127.0.0.1:5173'
const EMAIL = 'e2e-test@praxis.test'
const PASSWORD = 'E2eTest!2345'
const results = []
const log = (name, ok, extra = '') => {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${extra ? ' | ' + extra : ''}`)
}

/* ── Read Supabase credentials from backend/.env (see _harness.mjs ENV_FILE) ── */
const env = readEnv()
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

const browser = await launch()
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } })
// The tutorial gate redirects any learner whose progress says the tutorial is
// unfinished into the interactive tutorial, whose overlay intercepts canvas
// clicks. These suites deliberately wipe SERVER progress for a clean scoring
// run, so the LOCAL snapshot must carry the post-tutorial flag.
await page.addInitScript(({ key, surveyKey }) => {
  localStorage.setItem(surveyKey, 'true')
  let snap = {}
  try { snap = JSON.parse(localStorage.getItem(key)) || {} } catch { snap = {} }
  localStorage.setItem(key, JSON.stringify({
    ...snap,
    hasSeenTutorial: true,
    points: Math.max(Number(snap.points) || 0, 60),
  }))
}, { key: progressKey(userId), surveyKey: HIDE_SURVEY })

page.on('pageerror', err => console.log('PAGE ERROR:', err.message))

/* ── 1. Login ── */
await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
await page.fill('input[type="email"]', EMAIL)
await page.fill('input[type="password"]', PASSWORD)
await page.click('button[type="submit"]')
await page.waitForTimeout(2500)
const afterLogin = page.url()
log('login succeeds and lands in app', !afterLogin.includes('/login'), afterLogin)

/* ── 2. Level 1 Stage 1 (SOP): x + xy -> x, verify law comment ── */
await page.goto(BASE + '/level/1/stage/0', { waitUntil: 'domcontentloaded' })
await page.waitForSelector('[data-path="R.0"]', { timeout: 30000 })
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
await page.goto(BASE + '/level/1/stage/1', { waitUntil: 'domcontentloaded' })
await page.waitForSelector('[data-path="R.0"]', { timeout: 30000 })
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
await page.goto(BASE + '/level/3/stage/0', { waitUntil: 'domcontentloaded' })
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

/* ── 5. Sandbox: input screen -> random workspace ── */
// The sandbox entry point is now the expression input screen (/sandbox); the
// generated-problem workspace it hands off to lives at /sandbox/play.
await page.goto(BASE + '/sandbox', { waitUntil: 'domcontentloaded' })
await page.waitForSelector('[data-testid="sandbox-input"]', { timeout: 30000 })
const randomBtn = page.locator('[data-testid="sandbox-random-btn"]')
log('sandbox entry point offers the random-problem flow', await randomBtn.count() === 1)
await randomBtn.click()
await page.waitForSelector('#randomize-btn', { timeout: 30000 })
const sandboxExpr = await page.locator('[data-tutorial="canvas"]').first().innerText()
log('the random flow opens the workspace with a generated problem',
  sandboxExpr.includes('F ='), sandboxExpr.replace(/\n/g, ' ').slice(0, 80))

// The workspace randomizer swaps in a fresh solver-verified problem.
await page.click('#randomize-btn')
await page.waitForTimeout(2000)
const sandboxExpr2 = await page.locator('[data-tutorial="canvas"]').first().innerText()
log('the workspace randomizer loads a new problem', sandboxExpr2 !== sandboxExpr,
  sandboxExpr2.replace(/\n/g, ' ').slice(0, 80))

/* ── 6. Tutorial: guide highlights on the tutorial level ── */
// The tutorial lives at level 0 (TutorialGate.TUTORIAL_ENTRY), not at /tutorial.
await page.goto(BASE + '/level/0/stage/0?tutorial=true', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(3000)
const tutorialState = await page.evaluate(() => ({
  cta: [...document.querySelectorAll('button')].filter(b => /Continue|Skip/.test(b.textContent || '')).length,
  canvas: document.querySelectorAll('[data-tutorial="canvas"]').length,
}))
log('the interactive tutorial is reachable and interactive',
  tutorialState.cta > 0 && tutorialState.canvas === 1, JSON.stringify(tutorialState))

await browser.close()

const fails = results.filter(r => !r.ok)
console.log(`\n${results.length - fails.length}/${results.length} passed`)
process.exit(fails.length > 0 ? 1 : 0)
