/**
 * Shared browser-harness helpers for the mobile UX pass (Lead-owned).
 *
 * Import it instead of re-deriving the login/storageState dance:
 *
 *   import { launch, seededState, device, reporter, foldReport } from './_harness.mjs'
 *   const browser = await launch()
 *   const state = await seededState(browser)
 *   const ctx = await device(browser, { width: 844, height: 390, isMobile: true, hasTouch: true }, state)
 *
 * Why storageState: a phone in PORTRAIT shows the non-dismissible rotate overlay,
 * so the login form underneath is deliberately unclickable. Auth + a
 * post-tutorial progress snapshot are therefore created once in a desktop
 * context and replayed into every emulated device.
 */
import { chromium } from '/home/xris/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core/index.mjs'

export const BASE = process.env.PRAXIS_BASE_URL || 'http://localhost:5173'
export const EMAIL = 'e2e-test@praxis.test'
export const PASSWORD = 'E2eTest!2345'
export const CHROMIUM = '/home/xris/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome'

/** Device presets used across the mobile suites. */
export const DEVICES = {
  phoneLandscape: { name: 'phone-landscape-844x390', viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true },
  phoneLandscapeSmall: { name: 'phone-landscape-667x375', viewport: { width: 667, height: 375 }, isMobile: true, hasTouch: true },
  phoneLandscapeTiny: { name: 'phone-landscape-568x320', viewport: { width: 568, height: 320 }, isMobile: true, hasTouch: true },
  phonePortrait: { name: 'phone-portrait-390x844', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  tabletPortrait: { name: 'tablet-portrait-768x1024', viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true },
  tabletLandscape: { name: 'tablet-landscape-1024x768', viewport: { width: 1024, height: 768 }, isMobile: true, hasTouch: true },
  narrowDesktop: { name: 'narrow-window-420x800', viewport: { width: 420, height: 800 } },
  desktop: { name: 'desktop-1440x900', viewport: { width: 1440, height: 900 } },
}

export async function launch() {
  return chromium.launch({
    executablePath: CHROMIUM,
    args: ['--no-sandbox', '--disable-gpu', '--no-zygote', '--disable-dev-shm-usage'],
  })
}

/** Logs in once (desktop) and seeds a post-tutorial learner; result is cached. */
export async function seededState(browser) {
  if (seededState._cache) return seededState._cache
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } })
  const page = await ctx.newPage()
  await page.addInitScript(() => localStorage.setItem('praxis_hide_survey', 'true'))
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForTimeout(2500)
  await page.goto(BASE + '/level/0/stages', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  await page.evaluate(() => {
    const key = Object.keys(localStorage).find(k => k.startsWith('praxis_v1_'))
    if (!key) return
    const data = JSON.parse(localStorage.getItem(key))
    data.hasSeenTutorial = true
    data.points = Math.max(Number(data.points) || 0, 150)
    localStorage.setItem(key, JSON.stringify(data))
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
  seededState._cache = await ctx.storageState()
  await ctx.close()
  return seededState._cache
}

/** Opens an emulated device context already authenticated as a seeded learner. */
export async function device(browser, preset, state) {
  const { name, ...opts } = preset
  const ctx = await browser.newContext({ ...opts, storageState: state })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  page.__presetName = name
  return { ctx, page, errors, name }
}

/** Navigates and waits out the "Loading your progress..." gate. */
export async function nav(page, path, { timeout = 30000 } = {}) {
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded' })
  // Wait for REAL content: right after domcontentloaded the body can still be
  // empty (so "no gate text" would be vacuously true) and ProtectedRoute shows
  // its own "Loading..." first. Progress hydration itself takes 1.5-4.5s on
  // this box because it round-trips Supabase.
  await page.waitForFunction(() => {
    const t = document.body.innerText
    if (!t || !t.trim()) return false
    if (t.includes('Loading your progress') || t.includes('Loading...')) return false
    return true
  }, null, { timeout }).catch(() => {})
  await page.waitForTimeout(500)
}

export function reporter(title) {
  const results = []
  const log = (name, ok, extra = '') => {
    results.push({ name, ok: Boolean(ok) })
    console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${extra ? ' | ' + extra : ''}`)
  }
  const section = (t) => console.log(`\n──── ${t} ────`)
  const summary = () => {
    const failed = results.filter(r => !r.ok)
    console.log(`\n=== ${title}: ${results.length - failed.length}/${results.length} passed ===`)
    failed.forEach(f => console.log('  ❌ ' + f.name))
    return failed.length
  }
  return { log, section, summary, results }
}

/**
 * Measures every element matching a selector against the viewport: size and
 * whether it is fully inside the fold (bottom <= innerHeight). This is the
 * objective version of "the button is visible without scrolling".
 */
export async function foldReport(page, selector) {
  return page.evaluate((sel) => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const els = [...document.querySelectorAll(sel)].filter(el => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0
    })
    return {
      viewport: { w: vw, h: vh },
      count: els.length,
      items: els.map(el => {
        const r = el.getBoundingClientRect()
        return {
          label: (el.innerText || el.getAttribute('data-testid') || el.className || '').replace(/\s+/g, ' ').trim().slice(0, 40),
          w: Math.round(r.width),
          h: Math.round(r.height),
          top: Math.round(r.top),
          bottom: Math.round(r.bottom),
          right: Math.round(r.right),
          inFold: r.bottom <= vh + 1 && r.top >= -1,
          inWidth: r.right <= vw + 1 && r.left >= -1,
        }
      }),
    }
  }, selector)
}

/** True when the page itself does not scroll horizontally. */
export async function noHorizontalScroll(page) {
  return page.evaluate(() => ({
    ok: document.documentElement.scrollWidth <= window.innerWidth + 1
      && document.body.scrollWidth <= window.innerWidth + 1,
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }))
}

/** Saves a screenshot under .e2e/shots-mobile/ (workspace-durable). */
export async function shot(page, label) {
  const path = `.e2e/shots-mobile/${label}.png`
  await page.screenshot({ path })
  return path
}
