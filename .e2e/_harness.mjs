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
 *
 * Machine-specific paths live HERE and nowhere else. Each one is overridable
 * from the environment, with this box's value as the default:
 *   PRAXIS_PLAYWRIGHT_MODULE  playwright-core ESM entry
 *   PRAXIS_CHROMIUM           Chromium binary to drive
 *   PRAXIS_ENV_FILE           backend/.env with the Supabase admin credentials
 * Suites import `launch()` / `readEnv()` (or the constants) instead of
 * re-hardcoding a path.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  PROGRESS_KEY_PREFIX,
  progressKey,
  SKIP_TUTORIAL_REPLAY_PROMPT,
  SKIP_RESET_CONFIRM,
  HIDE_ROTATE_BANNER,
} from '../frontend/src/config/storageKeys.js'

/** Repo root, derived from this file's own location — never hardcoded. */
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Absolute playwright-core entry; `launch()` dynamically imports this. */
export const PLAYWRIGHT_MODULE = process.env.PRAXIS_PLAYWRIGHT_MODULE || '/home/xris/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core/index.mjs'
/** Chromium binary used by every suite (override: PRAXIS_CHROMIUM). */
export const CHROMIUM = process.env.PRAXIS_CHROMIUM || '/home/xris/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome'
/** backend/.env holding SUPABASE_URL / SUPABASE_SERVICE_KEY (override: PRAXIS_ENV_FILE). */
export const ENV_FILE = process.env.PRAXIS_ENV_FILE || '/home/xris/Documents/GitHub/Praxis/backend/.env'

export const BASE = process.env.PRAXIS_BASE_URL || 'http://localhost:5173'
export const EMAIL = 'e2e-test@praxis.test'
export const PASSWORD = 'E2eTest!2345'

/**
 * Browser storage keys, re-exported from the app's single source of truth so
 * suites never inline the literals. `HIDE_SURVEY` is the one exception: the app
 * no longer reads it, so it has no entry in storageKeys.js and is owned here.
 */
export {
  PROGRESS_KEY_PREFIX,
  progressKey,
  SKIP_TUTORIAL_REPLAY_PROMPT,
  SKIP_RESET_CONFIRM,
  HIDE_ROTATE_BANNER,
}
export const HIDE_SURVEY = 'praxis_hide_survey'

/** Parses ENV_FILE into a flat { KEY: value } map (same shape the suites used). */
export function readEnv() {
  const envText = readFileSync(ENV_FILE, 'utf8')
  return Object.fromEntries(
    envText.split('\n').filter(l => l.includes('=')).map(l => {
      const [k, ...rest] = l.split('=')
      return [k.trim(), rest.join('=').trim().replace(/^"|"$/g, '')]
    }),
  )
}

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

/**
 * Wipes the dedicated e2e learner's SERVER progress (stage_progress,
 * user_progress, score_history) so a suite can assert first-time behaviour.
 *
 * Suites that grade a stage must call this before they start: the assertions
 * "completing a stage awards points" and "the derivation has steps to undo" are
 * only meaningful for a stage the learner has not already finished, and the
 * shared account keeps its progress between runs. Returns the user id, or null
 * when the credentials/user are unavailable (callers should then skip the
 * first-time assertions rather than fail).
 */
export async function resetE2eProgress() {
  const env = readEnv()
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) return null
  const supabaseUrl = String(env.SUPABASE_URL).replace(/\/$/, '')
  const headers = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` }

  const adminRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=1&per_page=50`, { headers })
  if (!adminRes.ok) return null
  const user = ((await adminRes.json()).users || []).find(u => u.email === EMAIL)
  if (!user) return null

  for (const table of ['stage_progress', 'user_progress', 'score_history']) {
    await fetch(`${supabaseUrl}/rest/v1/${table}?user_id=eq.${user.id}`, {
      method: 'DELETE',
      headers: { ...headers, Prefer: 'return=minimal' },
    })
  }
  return user.id
}

export async function launch() {
  // `import { chromium } from <variable>` is not valid ESM — resolve at call time.
  const { chromium } = await import(PLAYWRIGHT_MODULE)
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
  await page.addInitScript((key) => localStorage.setItem(key, 'true'), HIDE_SURVEY)
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForTimeout(2500)
  await page.goto(BASE + '/level/0/stages', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  await page.evaluate((prefix) => {
    const key = Object.keys(localStorage).find(k => k.startsWith(prefix))
    if (!key) return
    const data = JSON.parse(localStorage.getItem(key))
    data.hasSeenTutorial = true
    data.points = Math.max(Number(data.points) || 0, 150)
    localStorage.setItem(key, JSON.stringify(data))
  }, PROGRESS_KEY_PREFIX)
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
