import { launch, readEnv, HIDE_SURVEY, progressKey } from './_harness.mjs'

const BASE = process.env.PRAXIS_BASE_URL || 'http://127.0.0.1:5173'
const EMAIL = 'e2e-test@praxis.test'
const PASSWORD = 'E2eTest!2345'
const results = []
const log = (name, ok, extra = '') => {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${extra ? ' | ' + extra : ''}`)
}

const env = readEnv()
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
    stageProgress: { ...(snap.stageProgress || {}), 0: [0, 1, 2, 3] },
    levelsCompleted: [...new Set([...(snap.levelsCompleted || []), 0])],
    points: Math.max(Number(snap.points) || 0, 60),
  }))
}, { key: progressKey(user.id), surveyKey: HIDE_SURVEY })


await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
await page.fill('input[type="email"]', EMAIL)
await page.fill('input[type="password"]', PASSWORD)
await page.click('button[type="submit"]')
await page.waitForTimeout(2500)

// L1 stage 3: x'y + xy + xy -> y (3 steps: Idempotent, Distributive, Complement)
await page.goto(BASE + '/level/1/stage/2', { waitUntil: 'domcontentloaded' })
await page.waitForSelector('[data-path="R.0"]', { timeout: 30000 })

// Step 1: Idempotent on the duplicate xy terms
await page.locator('[data-path="R.1"]').first().click()
await page.waitForTimeout(250)
await page.locator('[data-path="R.2"]').first().click()
await page.waitForTimeout(500)
await page.click('button:has-text("Idempotent")')
await page.waitForTimeout(2400)

// Step 2: Distributive factor on x'y + xy
await page.locator('[data-path="R.0"]').first().click()
await page.waitForTimeout(250)
await page.locator('[data-path="R.1"]').first().click()
await page.waitForTimeout(500)
const distBtn = await page.locator('button:has-text("Distributive")').count()
log('Distributive law offered on x\'y + xy', distBtn > 0)
await page.click('button:has-text("Distributive")')
await page.waitForTimeout(2400)

// Step 3: Complement inside y(x' + x) — the sum is factor R.1
const lit10 = await page.locator('[data-path="R.1.0"]').count()
if (lit10 > 0) {
  await page.locator('[data-path="R.1.0"]').first().click()
  await page.waitForTimeout(250)
  await page.locator('[data-path="R.1.1"]').first().click()
  await page.waitForTimeout(500)
  const compBtn = await page.locator('button:has-text("Complement")').count()
  log('Complement law offered on x\' + x inside product', compBtn > 0)
  await page.click('button:has-text("Complement")')
  await page.waitForTimeout(2400)
}
// Step 4: y·1 -> y — click the constant 1 inside the product for Identity
const constEl = await page.locator('[data-path="R.1"]').count()
if (constEl > 0) {
  await page.locator('[data-path="R.1"]').first().click()
  await page.waitForTimeout(500)
  const idBtn = await page.locator('button:has-text("Identity")').count()
  log('Identity law offered on y·1', idBtn > 0)
  if (idBtn > 0) {
    await page.click('button:has-text("Identity")')
    await page.waitForTimeout(2400)
  }
}
await page.waitForTimeout(2000)

// Completion + law comments
const complete = await page.locator('text=Stage Complete!').count()
log('multi-step derivation completes to y', complete > 0)

// Step-history panel: each step card shows from -> to with a law chip
const historyText = await page.locator('aside').first().innerText().catch(() => '')
const lawsFound = ['Idempotent', 'Distributive', 'Complement', 'Identity']
  .filter(l => historyText.includes(l))
log('step history shows all applied laws beside the equations', lawsFound.length === 4, lawsFound.join(', '))

// Law chips in the step-history panel (each step card has a law badge)
const chipCount = await page.locator('aside').first().locator('text=Law').count().catch(() => 0)
log('step history renders a law badge per applied step', chipCount >= 3, `badges=${chipCount}`)

// The step history cards are clickable to inspect (highlight) a step
const stepCards = await page.locator('aside').first().locator('div.cursor-pointer').count().catch(() => 0)
log('step history cards are clickable for review', stepCards >= 3, `cards=${stepCards}`)

await browser.close()
const fails = results.filter(r => !r.ok)
console.log(`\n${results.length - fails.length}/${results.length} passed`)
process.exit(fails.length > 0 ? 1 : 0)
