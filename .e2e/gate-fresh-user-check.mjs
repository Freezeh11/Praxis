// Decisive gate check: wipe the account's server progress, then confirm a
// browser with NO local snapshot is redirected into the tutorial from every
// gated route — and that the tutorial is still reachable.
import { launch, readEnv, HIDE_SURVEY, PROGRESS_KEY_PREFIX, BASE, EMAIL, PASSWORD } from './_harness.mjs'
const env = readEnv()
const admin = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` }
const users = await (await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/admin/users?page=1&per_page=50`, { headers: admin })).json()
const user = (users.users || []).find(u => u.email === EMAIL)
for (const t of ['stage_progress', 'user_progress', 'score_history']) {
  await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${t}?user_id=eq.${user.id}`, { method: 'DELETE', headers: { ...admin, Prefer: 'return=minimal' } })
}
const browser = await launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
await page.addInitScript((key) => localStorage.setItem(key, 'true'), HIDE_SURVEY)
await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1500)
await page.fill('input[type="email"]', EMAIL); await page.fill('input[type="password"]', PASSWORD)
await page.click('button[type="submit"]'); await page.waitForTimeout(2500)
const clearLocal = () => page.evaluate((prefix) => { Object.keys(localStorage).filter(k => k.startsWith(prefix)).forEach(k => localStorage.removeItem(k)) }, PROGRESS_KEY_PREFIX)
let fails = 0

// 1. Fresh user can access /levels without being redirected
await clearLocal()
await page.goto(BASE + '/levels', { waitUntil: 'domcontentloaded' })
await page.waitForFunction(() => { const t = document.body.innerText; return t && !t.includes('Loading your progress') }, null, { timeout: 25000 }).catch(() => {})
await page.waitForTimeout(2200)
const onLevels = page.url().replace(BASE, '').includes('/levels') && !page.url().includes('tutorial=true')
if (!onLevels) fails++
console.log(`${onLevels ? 'PASS' : 'FAIL'} | fresh user can view /levels -> ${page.url().replace(BASE, '')}`)

// 2. Gated routes redirect to tutorial
for (const path of ['/level/1/stage/0', '/level/2/stage/0', '/level/1/stages', '/sandbox']) {
  await clearLocal()
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => { const t = document.body.innerText; return t && !t.includes('Loading your progress') }, null, { timeout: 25000 }).catch(() => {})
  await page.waitForTimeout(2200)
  const url = page.url().replace(BASE, '')
  const redirected = url.includes('/level/0/stage/0') && url.includes('tutorial=true')
  const returnTo = decodeURIComponent(url.split('returnTo=')[1] || '') === path
  if (!redirected) fails++
  console.log(`${redirected ? 'PASS' : 'FAIL'} | fresh user blocked from ${path} -> ${url}${returnTo ? ' (returnTo preserved)' : ''}`)
}
await clearLocal()
await page.goto(BASE + '/level/0/stage/0?tutorial=true', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3000)
const tutorialOk = (await page.locator('[data-tutorial="canvas"]').count()) === 1
console.log(`${tutorialOk ? 'PASS' : 'FAIL'} | the tutorial route itself stays reachable`)
await browser.close()
console.log(fails === 0 && tutorialOk ? '\nGATE CHECK: PASS' : '\nGATE CHECK: FAIL')
process.exit(fails === 0 && tutorialOk ? 0 : 1)
