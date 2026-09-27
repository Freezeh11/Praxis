#!/usr/bin/env node
/**
 * M3 — mobile verification for the NON-workspace screens (owner: pages-mobile).
 *
 * Covers, at real emulated sizes and with getBoundingClientRect (never by eye):
 *   1. Level select  — primary CTA + carousel arrows + header controls, in the
 *                      fold at 844x390 / 667x375 / 568x320, no page h-scroll.
 *   2. Stage select  — tablet portrait 768x1024 and landscape phone 844x390.
 *   3. Landing / Login / Register — 320x568, 390x844 (non-touch, so the
 *                      phone-portrait rotate overlay is not in the way) and
 *                      844x390: fluid column, >=16px inputs, >=48px submit.
 *   4. TutorialGate + ProtectedRoute loading screens: centered, no h-scroll.
 *   5. InteractiveTutorial overlay on a 390px-tall landscape phone: welcome
 *      panel fits (or scrolls) with Continue/Skip reachable + >=44px, and the
 *      coach card never leaves the viewport or traps the learner.
 *   6. Desktop 1440x900: the pre-mobile-pass geometry is unchanged.
 *
 * Exits non-zero when any line fails.
 *
 * Run:  node .e2e/mobile-pages-verify.mjs          (from the repo root)
 *       node .e2e/mobile-pages-verify.mjs --quick  (skip the 3 auth pages)
 */
import {
  launch, seededState, device, DEVICES, reporter, noHorizontalScroll, shot,
} from './_harness.mjs'

const BASE = process.env.PRAXIS_BASE_URL || 'http://127.0.0.1:5173'
const QUICK = process.argv.includes('--quick')

/**
 * Non-touch presets: a phone in PORTRAIT shows the non-dismissible rotate
 * overlay, so a narrow layout can only be inspected with a fine pointer.
 */
const NO_TOUCH = {
  portrait390: { name: 'no-touch-390x844', viewport: { width: 390, height: 844 } },
  narrow320: { name: 'no-touch-320x568', viewport: { width: 320, height: 568 } },
}

const { log, section, summary } = reporter('M3 mobile pages verification')

/* ── helpers ──────────────────────────────────────────────────────────── */

/** Navigates and waits for an explicit hook instead of sniffing body text. */
async function open(page, path, selector, { timeout = 25000, settle = 350 } = {}) {
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded' })
  if (selector) await page.waitForSelector(selector, { timeout })
  else await page.waitForTimeout(900)
  await page.waitForTimeout(settle)
}

/** Geometry of every match for a CSS selector, with fold/width verdicts. */
async function geom(page, selector) {
  return page.evaluate((sel) => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    return [...document.querySelectorAll(sel)].map((el) => {
      const b = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      return {
        text: (el.innerText || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 46),
        w: Math.round(b.width),
        h: Math.round(b.height),
        top: Math.round(b.top),
        bottom: Math.round(b.bottom),
        left: Math.round(b.left),
        right: Math.round(b.right),
        fs: Math.round(parseFloat(cs.fontSize) * 10) / 10,
        display: cs.display,
        overflowY: cs.overflowY,
        visible: b.width > 0 && b.height > 0,
        inFold: b.bottom <= vh + 1 && b.top >= -1,
        inWidth: b.right <= vw + 1 && b.left >= -1,
        vw,
        vh,
      }
    })
  }, selector)
}

async function one(page, selector) {
  const [first] = await geom(page, selector)
  return first || null
}

/** Carousel arrows are text glyphs, so they need their own matcher. */
async function arrows(page) {
  return page.evaluate(() => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    return [...document.querySelectorAll('button')]
      .filter(b => ['‹', '›'].includes(b.innerText.trim()))
      .map((b) => {
        const r = b.getBoundingClientRect()
        return {
          text: b.innerText.trim(),
          w: Math.round(r.width),
          h: Math.round(r.height),
          top: Math.round(r.top),
          bottom: Math.round(r.bottom),
          left: Math.round(r.left),
          right: Math.round(r.right),
          inFold: r.bottom <= vh + 1 && r.top >= -1,
          inWidth: r.right <= vw + 1 && r.left >= -1,
        }
      })
  })
}

const fmt = (g) => (g ? `${g.w}x${g.h} top=${g.top} bottom=${g.bottom} left=${g.left} right=${g.right}` : 'missing')

/** Opens a context for a preset, applies the rotate-banner dismiss, runs body. */
async function withDevice(browser, preset, state, body) {
  const d = await device(browser, preset, state)
  d.consoleErrors = []
  d.page.on('console', (m) => { if (m.type() === 'error') d.consoleErrors.push(m.text().slice(0, 160)) })
  await d.ctx.addInitScript(() => {
    try { sessionStorage.setItem('praxis_hide_rotate_banner', 'true') } catch { /* ignore */ }
  })
  try {
    await body(d)
  } catch (err) {
    // One broken screen must not abort the whole run: report and continue.
    log(`${preset.name}: section completed`, false, `threw: ${String(err.message || err).slice(0, 120)}`)
  } finally {
    await d.ctx.close()
  }
}

/**
 * Logged-OUT context (no storageState). /login and /register bounce an already
 * authenticated learner to '/', so they can only be measured signed out.
 */
async function withAnon(browser, preset, body) {
  const { name, ...opts } = preset
  const ctx = await browser.newContext(opts)
  await ctx.addInitScript(() => {
    try { sessionStorage.setItem('praxis_hide_rotate_banner', 'true') } catch { /* ignore */ }
  })
  const page = await ctx.newPage()
  page.__presetName = name
  try {
    await body({ ctx, page, name })
  } catch (err) {
    log(`${name}: section completed`, false, `threw: ${String(err.message || err).slice(0, 120)}`)
  } finally {
    await ctx.close()
  }
}

/** Runs a check body and turns a throw into a FAIL line instead of a crash. */
async function safely(label, body) {
  try {
    await body()
  } catch (err) {
    log(label, false, `threw: ${String(err.message || err).slice(0, 120)}`)
  }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const browser = await launch()
const state = await seededState(browser)

/* ══ 1. LEVEL SELECT — landscape phones ═══════════════════════════════ */
const LANDSCAPE = [DEVICES.phoneLandscape, DEVICES.phoneLandscapeSmall, DEVICES.phoneLandscapeTiny]

for (const preset of LANDSCAPE) {
  section(`level select @ ${preset.name}`)
  await withDevice(browser, preset, state, async ({ page, name, errors, consoleErrors }) => {
    await open(page, '/levels', '#start-level-btn')

    const cta = await one(page, '#start-level-btn')
    log(`${name}: #start-level-btn fully in fold (${fmt(cta)})`, cta && cta.inFold && cta.inWidth)
    log(`${name}: #start-level-btn touch height >= 44 (h=${cta?.h})`, cta && cta.h >= 44)
    log(`${name}: CTA label is a known contract string ("${cta?.text}")`,
      Boolean(cta) && ['START LEVEL', 'ENTER SANDBOX'].includes(cta.text))

    const ar = await arrows(page)
    log(`${name}: carousel arrows present (found ${ar.length})`, ar.length === 2)
    log(`${name}: arrows >= 44x44 (${ar.map(a => `${a.w}x${a.h}`).join(', ')})`,
      ar.length === 2 && ar.every(a => a.w >= 44 && a.h >= 44))
    log(`${name}: arrows inside viewport (fold+width)`,
      ar.length === 2 && ar.every(a => a.inFold && a.inWidth))

    const active = await one(page, '[data-level-card][data-active="true"]')
    log(`${name}: selected level card inside viewport (${fmt(active)})`,
      active && active.inWidth && active.top >= -1 && active.bottom <= active.vh + 1)

    const hs = await noHorizontalScroll(page)
    log(`${name}: no horizontal page scroll (scrollW=${hs.scrollWidth} vw=${hs.innerWidth})`, hs.ok)

    if (preset === DEVICES.phoneLandscape) {
      const header = await geom(page, 'header button')
      const texts = header.map(b => b.text)
      log(`${name}: header controls reachable (Tutorial/Laws/Sign Out)`,
        texts.some(t => t === 'Tutorial') && texts.some(t => t.includes('📖')) && texts.some(t => t === 'Sign Out'))
      log(`${name}: header controls >= 44px tall (${header.map(b => `${b.text.slice(0, 8)}:${b.h}`).join(', ')})`,
        header.length > 0 && header.every(b => b.h >= 44))
      log(`${name}: no header control clipped`,
        header.every(b => b.inFold && b.inWidth))

      const xp = await geom(page, '[data-level-card]')
      log(`${name}: carousel renders every entry (${xp.length} cards)`, xp.length >= 2)
      const noisy = [...errors, ...consoleErrors].slice(0, 1).join(' | ')
      log(`${name}: no page/console errors on level select (${noisy || 'clean'})`,
        errors.length === 0 && consoleErrors.length === 0)
      await shot(page, 'pages-after-phone-landscape-844x390__levels')

      // The "Restart the Walkthrough?" replay popup is opened from the header;
      // it is the other popup this screen can raise, so it has to fit too.
      await page.locator('header button', { hasText: 'Tutorial' }).first().click()
      const promptUp = await page.waitForSelector('.praxis-modal-panel', { timeout: 5000 }).then(() => true).catch(() => false)
      log(`${name}: replay popup opens from the Tutorial control`, promptUp)
      if (promptUp) {
        const promptPanel = await one(page, '.praxis-modal-panel')
        const promptButtons = await geom(page, '.praxis-modal-panel button')
        log(`${name}: replay popup fits the viewport (${fmt(promptPanel)})`,
          promptPanel && promptPanel.top >= -1 && promptPanel.bottom <= promptPanel.vh + 1)
        log(`${name}: replay popup buttons >= 44px + reachable`,
          promptButtons.length > 0 && promptButtons.every(b => b.h >= 44 && b.inFold && b.inWidth))
        await page.locator('.praxis-modal-panel button', { hasText: 'Cancel' }).first().click()
        await page.waitForTimeout(400)
      }
    }
  })
}

section('level select @ narrow windows (pointer: fine)')
await withDevice(browser, DEVICES.narrowDesktop, state, async ({ page, name }) => {
  await open(page, '/levels', '#start-level-btn')
  const cta = await one(page, '#start-level-btn')
  const ar = await arrows(page)
  const hs = await noHorizontalScroll(page)
  log(`${name}: #start-level-btn fully in fold (${fmt(cta)})`, cta && cta.inFold && cta.inWidth)
  log(`${name}: arrows inside viewport (${ar.map(a => `x=${a.left}..${a.right}`).join(', ')})`,
    ar.length === 2 && ar.every(a => a.inWidth && a.inFold))
  log(`${name}: no horizontal page scroll (scrollW=${hs.scrollWidth} vw=${hs.innerWidth})`, hs.ok)
  await shot(page, 'pages-after-narrow-window-420x800__levels')
})

await withDevice(browser, NO_TOUCH.narrow320, state, async ({ page, name }) => {
  await open(page, '/levels', '#start-level-btn')
  const hs = await noHorizontalScroll(page)
  const cta = await one(page, '#start-level-btn')
  const active = await one(page, '[data-level-card][data-active="true"]')
  log(`${name}: no horizontal page scroll @320px (scrollW=${hs.scrollWidth} vw=${hs.innerWidth})`, hs.ok)
  log(`${name}: CTA inside viewport width @320px (${fmt(cta)})`, cta && cta.inWidth && cta.visible)
  // 320x568 portrait scrolls by design; the CTA must be reachable, not clipped.
  const reachable = await page.evaluate(() => {
    const el = document.querySelector('#start-level-btn')
    el.scrollIntoView({ block: 'center' })
    const r = el.getBoundingClientRect()
    return r.bottom <= window.innerHeight + 1 && r.top >= -1
  })
  log(`${name}: CTA reachable by scrolling @320px`, reachable)
  log(`${name}: selected card inside viewport @320px (${fmt(active)})`, active && active.inWidth)
  await shot(page, 'pages-after-no-touch-320x568__levels')
})

/* ══ 2. STAGE SELECTOR ════════════════════════════════════════════════ */
section(`stage selector @ ${DEVICES.tabletPortrait.name}`)
await withDevice(browser, DEVICES.tabletPortrait, state, async ({ page, name }) => {
  await open(page, '/level/1/stages', '[data-stage-card]')
  const cards = await geom(page, '[data-stage-card]')
  const hs = await noHorizontalScroll(page)
  log(`${name}: stage cards rendered (${cards.length})`, cards.length > 0)
  log(`${name}: every stage card >= 44px tall (min h=${Math.min(...cards.map(c => c.h))})`,
    cards.every(c => c.h >= 44))
  log(`${name}: every stage card inside the viewport width (max right=${Math.max(...cards.map(c => c.right))})`,
    cards.every(c => c.inWidth && c.left >= -1))
  log(`${name}: stage grid spans the content column (min w=${Math.min(...cards.map(c => c.w))})`,
    cards.length > 0 && Math.min(...cards.map(c => c.w)) >= 140)
  log(`${name}: no horizontal page scroll (scrollW=${hs.scrollWidth} vw=${hs.innerWidth})`, hs.ok)
  await shot(page, 'pages-after-tablet-portrait-768x1024__stages')
})

section(`stage selector @ ${DEVICES.phoneLandscape.name}`)
await withDevice(browser, DEVICES.phoneLandscape, state, async ({ page, name }) => {
  await open(page, '/level/1/stages', '[data-stage-card]')
  const cards = await geom(page, '[data-stage-card]')
  const header = await geom(page, 'header button')
  const hs = await noHorizontalScroll(page)
  const firstTop = Math.min(...cards.map(c => c.top))
  log(`${name}: first stage row starts above the fold (top=${firstTop} < vh=${cards[0]?.vh})`,
    cards.length > 0 && firstTop < cards[0].vh)
  log(`${name}: header controls >= 44px tall (${header.map(b => b.h).join(', ')})`,
    header.length > 0 && header.every(b => b.h >= 44))
  log(`${name}: no header control clipped`, header.every(b => b.inFold && b.inWidth))
  log(`${name}: every stage card inside the viewport width`,
    cards.every(c => c.inWidth && c.left >= -1))
  log(`${name}: no horizontal page scroll (scrollW=${hs.scrollWidth} vw=${hs.innerWidth})`, hs.ok)
  await shot(page, 'pages-after-phone-landscape-844x390__stages')
})

/* ══ 3. LANDING / LOGIN / REGISTER ════════════════════════════════════ */
const AUTH_SIZES = [
  { key: '320x568', preset: NO_TOUCH.narrow320 },
  { key: '390x844', preset: NO_TOUCH.portrait390 },
  { key: '844x390', preset: DEVICES.phoneLandscape },
]

for (const { key, preset } of AUTH_SIZES) {
  section(`auth pages @ ${key}`)
  await withAnon(browser, preset, async ({ page }) => {
    await open(page, '/', 'h1')
    const landing = await one(page, 'h1')
    const landingScroll = await noHorizontalScroll(page)
    log(`${key}: landing hero not clipped (top=${landing?.top} right=${landing?.right}/${landing?.vw})`,
      landing && landing.top >= -1 && landing.inWidth && landing.visible)
    log(`${key}: landing no horizontal scroll`, landingScroll.ok)
    if (key === '844x390') await shot(page, 'pages-after-phone-landscape-844x390__landing')

    await open(page, '/login', 'button[type=submit]')
    const lInput = await one(page, 'input[type=email]')
    const lSubmit = await one(page, 'button[type=submit]')
    const lHero = await one(page, 'h1')
    const lScroll = await noHorizontalScroll(page)
    log(`${key}: login inputs >= 16px font (${lInput?.fs}px)`, lInput && lInput.fs >= 16)
    log(`${key}: login submit >= 48px tall (h=${lSubmit?.h})`, lSubmit && lSubmit.h >= 48)
    log(`${key}: login submit full width of its card (w=${lSubmit?.w})`, lSubmit && lSubmit.w >= 200)
    log(`${key}: login hero not clipped (top=${lHero?.top})`, lHero && lHero.top >= -1 && lHero.inWidth)
    log(`${key}: login no horizontal scroll (scrollW=${lScroll.scrollWidth})`, lScroll.ok)
    const lLogo = await one(page, 'img[alt="Praxis"]')
    log(`${key}: login logo not clipped (top=${lLogo?.top})`, lLogo && lLogo.top >= -1)
    if (key === '390x844') await shot(page, 'pages-after-no-touch-390x844__login')

    if (!QUICK) {
      await open(page, '/register', 'button[type=submit]')
      const rInput = await one(page, 'input[type=email]')
      const rSubmit = await one(page, 'button[type=submit]')
      const rScroll = await noHorizontalScroll(page)
      log(`${key}: register inputs >= 16px font (${rInput?.fs}px)`, rInput && rInput.fs >= 16)
      log(`${key}: register submit >= 48px tall (h=${rSubmit?.h})`, rSubmit && rSubmit.h >= 48)
      log(`${key}: register no horizontal scroll (scrollW=${rScroll.scrollWidth})`, rScroll.ok)
      if (key === '320x568') await shot(page, 'pages-after-no-touch-320x568__register')
    }
  })
}

/* ══ 4. LOADING SCREENS ═══════════════════════════════════════════════ */
async function assertCenteredLoading(d, label, selector, hsSelector) {
  const gate = await one(d.page, selector)
  const hs = await noHorizontalScroll(d.page)
  const centered = gate
    && Math.abs((gate.left + gate.right) / 2 - gate.vw / 2) <= 3
    && Math.abs((gate.top + gate.bottom) / 2 - gate.vh / 2) <= 3
  log(`${label}: loading block horizontally+vertically centered (${fmt(gate)})`, Boolean(centered))
  log(`${label}: loading screen covers the viewport (${hsSelector})`, Boolean(gate) && gate.vh > 0 && gate.w > 0)
  log(`${label}: loading screen no horizontal scroll (scrollW=${hs.scrollWidth} vw=${hs.innerWidth})`, hs.ok)
  if (hsSelector) {
    const root = await one(d.page, hsSelector)
    log(`${label}: loading root is full-viewport (h=${root?.h} vh=${root?.vh})`, root && root.h >= root.vh - 1)
  }
}

for (const preset of [NO_TOUCH.portrait390, DEVICES.phoneLandscape]) {
  section(`loading screens @ ${preset.name}`)

  await withDevice(browser, preset, state, async (d) => {
    // Hold /api/progress so the TutorialGate hold screen stays on screen.
    await d.page.route('**/api/progress*', async (route) => { await sleep(6000); route.continue() })
    await d.page.goto(BASE + '/levels', { waitUntil: 'domcontentloaded' })
    try {
      await d.page.waitForSelector('[data-testid="tutorial-gate-loading"]', { timeout: 12000 })
      await assertCenteredLoading(d, `${preset.name}: TutorialGate`, '[data-testid="tutorial-gate-loading"]', '[data-testid="tutorial-gate-loading-root"]')
      const text = await d.page.evaluate(() => document.body.innerText)
      log(`${preset.name}: TutorialGate keeps "Loading your progress..." copy`, text.includes('Loading your progress'))
    } catch {
      log(`${preset.name}: TutorialGate loading screen observable`, false, 'not rendered')
    }
  })

  await withDevice(browser, preset, state, async (d) => {
    // Freeze supabase auth (expired token → forced refresh) so ProtectedRoute
    // stays in its isPending branch long enough to be measured.
    await d.ctx.addInitScript(() => {
      try {
        const key = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
        if (!key) return
        const raw = JSON.parse(localStorage.getItem(key))
        const patch = (o) => { if (o && typeof o === 'object') o.expires_at = 1 }
        patch(raw)
        patch(raw?.currentSession)
        patch(raw?.session)
        localStorage.setItem(key, JSON.stringify(raw))
      } catch { /* ignore */ }
    })
    await d.page.route('**supabase.co/**', async (route) => { await sleep(6000); route.continue() })
    await d.page.goto(BASE + '/levels', { waitUntil: 'domcontentloaded' })
    try {
      await d.page.waitForSelector('[data-testid="protected-loading"]', { timeout: 12000 })
      await assertCenteredLoading(d, `${preset.name}: ProtectedRoute`, '[data-testid="protected-loading"]', '[data-testid="protected-loading-root"]')
    } catch {
      log(`${preset.name}: ProtectedRoute loading screen observable`, false, 'not rendered (session resolved before paint)')
    }
  })
}

/* ══ 5. INTERACTIVE TUTORIAL OVERLAY @ 844x390 ════════════════════════ */
section(`tutorial overlay @ ${DEVICES.phoneLandscape.name}`)
await withDevice(browser, DEVICES.phoneLandscape, state, async ({ page, name }) => {
  await safely(`${name}: tutorial overlay checks`, async () => {
  await open(page, '/level/0/stage/0?tutorial=true', 'button:has-text("Skip")')
  await page.waitForTimeout(700)

  const panel = await one(page, '.praxis-modal-panel')
  const hs = await noHorizontalScroll(page)
  log(`${name}: welcome panel fits the viewport (${fmt(panel)})`,
    panel && panel.top >= -1 && panel.bottom <= panel.vh + 1 && panel.right <= panel.vw + 1)
  log(`${name}: welcome panel scrolls instead of overflowing (overflow-y=${panel?.overflowY})`,
    Boolean(panel) && ['auto', 'scroll'].includes(panel.overflowY))

  const reach = async (text) => page.evaluate((t) => {
    const el = [...document.querySelectorAll('button')].find(b => (b.innerText || '').replace(/\s+/g, ' ').trim().includes(t))
    if (!el) return null
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    const r = el.getBoundingClientRect()
    return {
      h: Math.round(r.height), w: Math.round(r.width), top: Math.round(r.top), bottom: Math.round(r.bottom),
      reachable: r.bottom <= window.innerHeight + 1 && r.top >= -1 && r.width > 0,
    }
  }, text)

  const skip = await reach('Skip')
  const cont = await reach('Continue')
  log(`${name}: Skip control reachable + >=44px (${JSON.stringify(skip)})`, Boolean(skip) && skip.reachable && skip.h >= 44)
  log(`${name}: Continue control reachable + >=44px (${JSON.stringify(cont)})`, Boolean(cont) && cont.reachable && cont.h >= 44)

  // Functional: Continue advances the deck, last slide closes it.
  const slideBefore = await page.evaluate(() => document.body.innerText)
  await page.locator('button', { hasText: 'Continue' }).first().click()
  await page.waitForTimeout(800)
  const slideState = await page.evaluate(() => ({
    text: document.body.innerText,
    hasBack: [...document.querySelectorAll('button')].some(b => b.innerText.includes('Back')),
  }))
  log(`${name}: Continue advances the welcome deck (back control + copy changed)`,
    slideState.text !== slideBefore && slideState.hasBack)
  const start = await reach('Start')
  log(`${name}: final slide action reachable + >=44px (${JSON.stringify(start)})`, Boolean(start) && start.reachable && start.h >= 44)
  await page.locator('button', { hasText: 'Start' }).first().click()
  await page.waitForTimeout(1200)

  const coach = await one(page, '[data-tutorial-card]')
  log(`${name}: coach card fully inside the viewport (${fmt(coach)})`,
    coach && coach.top >= -1 && coach.bottom <= coach.vh + 1 && coach.left >= -1 && coach.right <= coach.vw + 1)
  const exit = await reach('Exit Tutorial')
  log(`${name}: coach "Exit Tutorial" reachable + >=44px (${JSON.stringify(exit)})`,
    Boolean(exit) && exit.reachable && exit.h >= 44)
  await shot(page, 'pages-after-phone-landscape-844x390__tutorial')

  if (exit?.reachable) {
    await page.locator('button', { hasText: 'Exit Tutorial' }).first().click()
    await page.waitForTimeout(900)
    const left = await page.evaluate(() => document.querySelectorAll('[data-tutorial-card]').length)
    log(`${name}: Exit Tutorial dismisses the overlay (cards left=${left})`, left === 0)
  }
  log(`${name}: tutorial overlay no horizontal scroll (scrollW=${hs.scrollWidth})`, hs.ok)
  })
})

/* ══ 6. DESKTOP UNCHANGED ═════════════════════════════════════════════ */
section(`desktop unchanged @ ${DEVICES.desktop.name}`)
await withDevice(browser, DEVICES.desktop, state, async ({ page, name }) => {
  await open(page, '/levels', '#start-level-btn')
  const header = await one(page, 'header')
  const h1 = await one(page, 'h1')
  const card = await one(page, '[data-level-card]')
  const ar = await arrows(page)
  const cta = await one(page, '#start-level-btn')
  const hs = await noHorizontalScroll(page)

  log(`${name}: header height unchanged (${header?.h}px)`, header && header.h === 72)
  log(`${name}: hero title font-size unchanged (${h1?.fs}px)`, h1 && h1.fs === 32)
  log(`${name}: level card width unchanged (${card?.w}px)`, card && card.w === 240)
  log(`${name}: carousel arrows unchanged (${ar.map(a => `${a.w}x${a.h}`).join(', ')})`,
    ar.length === 2 && ar.every(a => a.w === 40 && a.h === 40))
  log(`${name}: CTA in fold unchanged (${fmt(cta)})`, cta && cta.inFold)
  log(`${name}: no horizontal scroll`, hs.ok)
  await shot(page, 'pages-after-desktop-1440x900__levels')
})

await withAnon(browser, DEVICES.desktop, async ({ page, name }) => {
  await open(page, '/login', 'button[type=submit]')
  const lCard = await one(page, 'form')
  const lSubmit = await one(page, 'button[type=submit]')
  const lScroll = await noHorizontalScroll(page)
  log(`${name}: login stays a <=400px single column (form w=${lCard?.w})`, lCard && lCard.w <= 400)
  log(`${name}: login submit in fold + >=48px (h=${lSubmit?.h} bottom=${lSubmit?.bottom})`,
    lSubmit && lSubmit.h >= 48 && lSubmit.inFold)
  log(`${name}: login no horizontal scroll`, lScroll.ok)
  await shot(page, 'pages-after-desktop-1440x900__login')
})

const failed = summary()
await browser.close()
process.exit(failed > 0 ? 1 : 0)
