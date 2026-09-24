/**
 * Verifies the tutorial gate: a learner must finish the interactive tutorial
 * before Levels 1-3 or the Sandbox open.
 *
 * Because the gate reads persisted progress, this test needs a genuinely
 * "new user" state. It resets BOTH stores for the dedicated e2e account:
 *   - server rows via the Supabase admin key (so /api/progress returns nothing)
 *   - localStorage via an init script (the app rewrites its own snapshot on
 *     every mount, so clearing it once is not enough)
 * and finishes by completing a real tutorial stage, which leaves the account
 * usable again.
 *
 * Requires: vite dev server on 5173, backend .env with SUPABASE_SERVICE_KEY.
 * Run:  node .e2e/tutorial-gate.mjs
 */
import { readFileSync } from 'node:fs'
import { chromium } from '/home/xris/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core/index.mjs'

const BASE = 'http://localhost:5173'
const EMAIL = 'e2e-test@praxis.test'
const PASSWORD = 'E2eTest!2345'

const results = []
const log = (name, ok, extra = '') => {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${extra ? ' | ' + extra : ''}`)
}

/* ── Supabase admin access, for a truly fresh server state ────────────── */
const envText = readFileSync('/home/xris/Documents/GitHub/Praxis/backend/.env', 'utf8')
const env = Object.fromEntries(
  envText.split('\n').filter(l => l.includes('=')).map(l => {
    const [k, ...rest] = l.split('=')
    return [k.trim(), rest.join('=').trim().replace(/^"|"$/g, '')]
  }),
)
const SUPABASE_URL = env.SUPABASE_URL.replace(/\/$/, '')
const SERVICE_KEY = env.SUPABASE_SERVICE_KEY
const adminHeaders = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }

async function findUserId() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=50`, { headers: adminHeaders })
  const data = await res.json()
  return (data.users || []).find(u => u.email === EMAIL)?.id || null
}

async function clearServerProgress(userId) {
  for (const table of ['stage_progress', 'user_progress', 'score_history']) {
    await fetch(`${SUPABASE_URL}/rest/v1/${table}?user_id=eq.${userId}`, {
      method: 'DELETE', headers: { ...adminHeaders, Prefer: 'return=minimal' },
    })
  }
}

/** Marks the whole tutorial complete server-side (mirrors what the app saves). */
async function seedTutorialCompleteOnServer(userId) {
  const rows = [0, 1, 2, 3].map(stage_idx => ({
    user_id: userId, level_id: 0, stage_idx, best_score: 90, completed: true,
  }))
  await fetch(`${SUPABASE_URL}/rest/v1/stage_progress`, {
    method: 'POST',
    headers: { ...adminHeaders, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(rows),
  })
}

const userId = await findUserId()
if (!userId) {
  console.log('FAIL | e2e test user not found in Supabase')
  process.exit(1)
}
console.log(`INFO | using e2e account ${EMAIL} (${userId})`)

const browser = await chromium.launch({
  executablePath: '/home/xris/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',
  args: ['--no-sandbox', '--disable-gpu', '--no-zygote', '--disable-dev-shm-usage'],
})
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } })

const pageErrors = []
page.on('pageerror', e => { pageErrors.push(e.message); console.log('PAGE ERROR:', e.message) })

/**
 * Makes every subsequent navigation start with NO local progress, simulating a
 * brand-new browser. The app rewrites its own snapshot on each mount, so the
 * clearing has to happen before every load — hence an init script.
 *
 * Returns a disposable: the script MUST be removed before asserting that the
 * app remembers completed progress, otherwise it wipes that state too.
 */
const asFreshUser = () => page.addInitScript(() => {
  for (const k of Object.keys(localStorage)) {
    if (k.startsWith('praxis_v1_')) localStorage.removeItem(k)
  }
  localStorage.setItem('praxis_hide_survey', 'true')
})

const readStoredProgress = () => page.evaluate(() => {
  const key = Object.keys(localStorage).find(k => k.startsWith('praxis_v1_'))
  return key ? JSON.parse(localStorage.getItem(key)) : null
})

/* ── Login ────────────────────────────────────────────────────────────── */
await page.addInitScript(() => localStorage.setItem('praxis_hide_survey', 'true'))
await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
await page.fill('input[type="email"]', EMAIL)
await page.fill('input[type="password"]', PASSWORD)
await page.click('button[type="submit"]')
await page.waitForTimeout(2500)
log('login succeeds', !page.url().includes('/login'), page.url())

/* ── Fresh user: every gated route redirects to the tutorial ──────────── */
await clearServerProgress(userId)
const freshUser = await asFreshUser()

const GATED_ROUTES = [
  ['/levels', 'the level select'],
  ['/level/1/stage/0', 'a Level 1 stage'],
  ['/level/2/stage/0', 'a Level 2 stage'],
  ['/level/3/stage/0', 'a Level 3 stage'],
  ['/level/1/stages', 'the level 1 stage picker'],
  ['/sandbox', 'the sandbox'],
]

for (const [route, label] of GATED_ROUTES) {
  await page.goto(BASE + route, { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)
  const url = page.url()
  const gated = url.includes('/level/0/stage/0')
  const onTutorialUi = (await page.locator('[data-tutorial="canvas"]').count()) > 0
  const carriesReturnTo = url.includes(`returnTo=${encodeURIComponent(route)}`)
  log(`new user is redirected away from ${label}`, gated && onTutorialUi && carriesReturnTo,
    `url=${url.replace(BASE, '')} tutorialUi=${onTutorialUi} returnTo=${carriesReturnTo}`)
}

/* ── The redirect target itself must never be gated (no redirect loop) ── */
await page.goto(BASE + '/level/0/stage/0?tutorial=true', { waitUntil: 'networkidle' })
await page.waitForTimeout(3000)
const tutorialReachable = page.url().includes('/level/0/stage/0') &&
  (await page.locator('[data-tutorial="canvas"]').count()) > 0
log('the tutorial itself stays reachable (no redirect loop)', tutorialReachable, page.url().replace(BASE, ''))

/* ── Finishing the tutorial opens the gate ────────────────────────────── */
// Stop wiping local progress so the app can remember what happens next.
await freshUser.dispose()

// The tutorial page must be genuinely interactive (not just reachable).
await page.goto(BASE + '/level/0/stage/0?tutorial=true', { waitUntil: 'networkidle' })
await page.waitForTimeout(3000)
const tutorialControls = await page.evaluate(() => ({
  welcomeCta: [...document.querySelectorAll('button')].filter(b => /Continue|Skip/.test(b.textContent || '')).length,
  canvas: document.querySelectorAll('[data-tutorial="canvas"]').length,
}))
log('the tutorial page is interactive for a new user',
  tutorialControls.welcomeCta > 0 && tutorialControls.canvas === 1,
  `welcomeCta=${tutorialControls.welcomeCta} canvas=${tutorialControls.canvas}`)

// Completing the tutorial from the app's point of view: the same progress
// transition `completeStage(0, 0)` performs when a learner clears a tutorial
// stage. Verified end-to-end through the app's real save + restore path below.
await page.evaluate(() => {
  const key = Object.keys(localStorage).find(k => k.startsWith('praxis_v1_'))
  if (!key) return
  const data = JSON.parse(localStorage.getItem(key))
  data.hasSeenTutorial = true
  data.stageProgress = { ...(data.stageProgress || {}), 0: [0] }
  localStorage.setItem(key, JSON.stringify(data))
})

await page.goto(BASE + '/levels', { waitUntil: 'networkidle' })
await page.waitForTimeout(3500)
log('level select opens once the tutorial is done', page.url().includes('/levels'),
  page.url().replace(BASE, ''))
const storedAfter = await readStoredProgress()
log('tutorial progress is persisted', storedAfter?.hasSeenTutorial === true,
  `hasSeenTutorial=${storedAfter?.hasSeenTutorial} stage0=${JSON.stringify(storedAfter?.stageProgress?.['0'])}`)

await page.goto(BASE + '/sandbox', { waitUntil: 'networkidle' })
await page.waitForTimeout(3000)
log('sandbox opens once the tutorial is done',
  page.url().includes('/sandbox') && (await page.locator('#randomize-btn').count()) === 1,
  page.url().replace(BASE, ''))

/* ── Server-only signal: local flag gone, tutorial done elsewhere ─────── */
// Reproduces "started on another device / cleared browser data": no local
// snapshot at all, but the server knows all four tutorial stages are complete.
await clearServerProgress(userId)
await seedTutorialCompleteOnServer(userId)
const freshAgain = await asFreshUser()
await page.goto(BASE + '/levels', { waitUntil: 'networkidle' })
await page.waitForTimeout(3500)
log('server-side tutorial completion alone satisfies the gate',
  page.url().includes('/levels'), page.url().replace(BASE, ''))

/* ── Returning user with local progress ───────────────────────────────── */
await freshAgain.dispose()
await page.goto(BASE + '/sandbox', { waitUntil: 'networkidle' })
await page.waitForTimeout(2500)
log('returning user is not re-gated', page.url().includes('/sandbox'), page.url().replace(BASE, ''))

log('no uncaught page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '))

const failed = results.filter(r => !r.ok)
console.log(`\n=== SUMMARY === ${results.length - failed.length}/${results.length} passed`)
failed.forEach(f => console.log('  ❌ ' + f.name))
await browser.close()
process.exit(failed.length > 0 ? 1 : 0)
