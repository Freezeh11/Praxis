import { chromium } from '/home/xris/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core/index.mjs'

const BASE = 'http://127.0.0.1:5173'
const results = []
const log = (name, ok, extra = '') => {
  results.push({ name, ok, extra })
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${extra ? ' | ' + extra : ''}`)
}

const browser = await chromium.launch({
  executablePath: '/home/xris/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',
  args: ['--no-sandbox', '--disable-gpu'],
})

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.addInitScript(() => localStorage.setItem('praxis_hide_survey', 'true'))

page.on('pageerror', err => console.log('PAGE ERROR:', err.message))

/* ── 1. Landing page: secondary mode links present ── */
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
const tutorialLink = await page.locator('a[href="/tutorial"]').count()
log('landing shows tutorial link for logged-out users', tutorialLink === 1)
const sandboxLinkLoggedOut = await page.locator('a[href="/sandbox"]').count()
log('landing hides sandbox link when logged out', sandboxLinkLoggedOut === 0, `count=${sandboxLinkLoggedOut}`)

/* ── Sandbox route is protected: logged-out visit bounces to login ── */
await page.goto(BASE + '/sandbox', { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
log('sandbox route redirects logged-out users to login', page.url().includes('/login'), page.url())

/* ── 4. Tutorial: full interactive click-through (11 stages) ── */
await page.goto(BASE + '/tutorial', { waitUntil: 'networkidle' })
const step1 = await page.locator('text=Step 1 of 11').count()
log('tutorial shows intro step', step1 === 1)

await page.click('button:has-text("Start the tutorial")')
await page.waitForTimeout(300)
const step2 = await page.locator('text=Step 2 of 11').count()
log('start button advances to step 2', step2 === 1)

// Click the term x (term capsule for path R.0)
await page.locator('[data-path="R.0"]').first().click()
await page.waitForTimeout(900)
const step3 = await page.locator('text=Step 3 of 11').count()
log('clicking x advances to step 3', step3 === 1)

// Click the term xy (term capsule for path R.1)
await page.locator('[data-path="R.1"]').first().click()
await page.waitForTimeout(900)
const step4 = await page.locator('text=Step 4 of 11').count()
log('clicking xy advances to step 4', step4 === 1)

// Apply the Absorption Law
await page.click('button:has-text("Absorption Law")')
await page.waitForTimeout(2300)
const step5 = await page.locator('text=Step 5 of 11').count()
log('applying absorption advances to step 5', step5 === 1)

// Step 6: goal info — press Next
await page.waitForTimeout(1200)
await page.click('button:has-text("Next")')
await page.waitForTimeout(400)
const step6 = await page.locator('text=Step 7 of 11').count()
log('next button advances to the undo step', step6 === 1)

// Step 7: undo
await page.click('button[title="Undo last step"]')
await page.waitForTimeout(900)
const step7 = await page.locator('text=Step 8 of 11').count()
log('undo advances to hint step', step7 === 1)

// Step 8: hint
await page.click('button[title*="Get a hint"]')
await page.waitForTimeout(1100)
const step8 = await page.locator('text=Step 9 of 11').count()
log('hint advances to reset step', step8 === 1)

// Step 9: reset
await page.click('button[title="Reset problem to start"]')
await page.waitForTimeout(900)
const step9 = await page.locator('text=Step 10 of 11').count()
log('reset advances to the final solve step', step9 === 1)

// Step 10: solve again unassisted
await page.locator('[data-path="R.0"]').first().click()
await page.waitForTimeout(300)
await page.locator('[data-path="R.1"]').first().click()
await page.waitForTimeout(600)
await page.click('button:has-text("Absorption Law")')
await page.waitForTimeout(2300)
await page.waitForTimeout(1200)
const done = await page.locator("text=You're ready!").count()
log('tutorial reaches completion after final solve', done === 1)
const stored = await page.evaluate(() => localStorage.getItem('praxis_tutorial_completed'))
log('tutorial marks localStorage completed', stored === 'true', `stored=${stored}`)

/* ── 5. First-visit welcome modal on /levels ── */
await page.evaluate(() => localStorage.removeItem('praxis_tutorial_seen'))
await page.goto(BASE + '/levels', { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
const url = page.url()
const welcomeVisible = await page.locator('text=New to Praxis').count()
log('levels page behavior (modal or login redirect)', welcomeVisible === 1 || url.includes('/login'), `url=${url}, modal=${welcomeVisible}`)

await browser.close()

const fails = results.filter(r => !r.ok)
console.log(`\n${results.length - fails.length}/${results.length} passed`)
process.exit(fails.length > 0 ? 1 : 0)
