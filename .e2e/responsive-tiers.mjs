/**
 * Responsive orientation gate — device-tier detection, rotate overlay, rotate
 * banner and the additive CSS foundation (Feature 2, part 1).
 *
 * Two layers of evidence:
 *   1. CONTRACT — the pure `detectDeviceTier()` decision table from
 *      frontend/src/hooks/useDeviceTier.js, imported directly (the tiered
 *      workspace work codes against exactly this contract).
 *   2. BROWSER — a real Chromium device matrix: the overlay blocks phones in
 *      portrait, disappears on a live resize to landscape (no reload), the
 *      small-tablet banner dismisses and stays dismissed across a reload in the
 *      same session, and iPad/laptop get neither.
 *
 * Requires: vite dev server on 127.0.0.1:5173, FastAPI on 8000, and the e2e
 * test user (e2e-test@praxis.test). Auth is seeded once at desktop size and
 * reused as storageState, because a phone in portrait cannot be logged into —
 * the overlay blocks the form, which is the whole point of the feature.
 *
 * Run:  node .e2e/responsive-tiers.mjs
 */
import { pathToFileURL } from 'node:url'
import { launch, HIDE_SURVEY, HIDE_ROTATE_BANNER, PROGRESS_KEY_PREFIX, REPO_ROOT } from './_harness.mjs'

const BASE = process.env.PRAXIS_BASE_URL || 'http://127.0.0.1:5173'
const EMAIL = 'e2e-test@praxis.test'
const PASSWORD = 'E2eTest!2345'
const HOOK_PATH = `${REPO_ROOT}/frontend/src/hooks/useDeviceTier.js`
const OVERLAY_TESTID = '[data-testid="rotate-overlay"]'
const BANNER_TESTID = '[data-testid="rotate-banner"]'
const OVERLAY_TEXT = 'Praxis works best in landscape mode. Please rotate your device.'
const BANNER_TEXT = 'Rotate for best experience'
const BANNER_KEY = HIDE_ROTATE_BANNER

const results = []
const log = (name, ok, extra = '') => {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${extra ? ' | ' + extra : ''}`)
}

/* ══════════════════════════════════════════════════════════════════════
   1. FROZEN CONTRACT — pure decision table (no DOM, no browser)
   ══════════════════════════════════════════════════════════════════════ */
let hook = null
try {
  hook = await import(pathToFileURL(HOOK_PATH).href)
} catch (err) {
  console.log('IMPORT ERROR:', err.message)
}

log('hook module imports and exposes the frozen surface', Boolean(hook && hook.detectDeviceTier && hook.default),
  hook ? `exports=${Object.keys(hook).join(',')}` : 'import failed')

if (hook) {
  const { DEVICE_TIERS, detectDeviceTier } = hook

  log('DEVICE_TIERS export has the four frozen tier strings',
    DEVICE_TIERS
    && DEVICE_TIERS.PHONE === 'phone'
    && DEVICE_TIERS.TABLET_SM === 'tablet-sm'
    && DEVICE_TIERS.TABLET === 'tablet'
    && DEVICE_TIERS.DESKTOP === 'desktop',
    JSON.stringify(DEVICE_TIERS))

  const TIER_CASES = [
    {
      name: 'detect: iPhone 390x844 touch portrait -> phone + overlay',
      input: { width: 390, height: 844, isTouch: true, orientation: 'portrait' },
      expect: { tier: 'phone', isPortrait: true, isLandscape: false, showRotateOverlay: true, showRotateBanner: false },
    },
    {
      // Tier is width-based by contract: a 844px-wide touch viewport is
      // tablet-sm even though it is a rotated phone. Nothing shows, because
      // both gates additionally require portrait.
      name: 'detect: same phone rotated 844x390 landscape -> tablet-sm by width, no overlay/banner',
      input: { width: 844, height: 390, isTouch: true, orientation: 'landscape' },
      expect: { tier: 'tablet-sm', isPortrait: false, isLandscape: true, showRotateOverlay: false, showRotateBanner: false },
    },
    {
      name: 'detect: phone boundary 767 portrait -> phone + overlay',
      input: { width: 767, height: 1024, isTouch: true, orientation: 'portrait' },
      expect: { tier: 'phone', isPortrait: true, isLandscape: false, showRotateOverlay: true, showRotateBanner: false },
    },
    {
      name: 'detect: small-tablet boundary 768 portrait -> tablet-sm + banner',
      input: { width: 768, height: 1024, isTouch: true, orientation: 'portrait' },
      expect: { tier: 'tablet-sm', isPortrait: true, isLandscape: false, showRotateOverlay: false, showRotateBanner: true },
    },
    {
      name: 'detect: Android tablet 820x1180 portrait -> tablet-sm + banner',
      input: { width: 820, height: 1180, isTouch: true, orientation: 'portrait' },
      expect: { tier: 'tablet-sm', isPortrait: true, isLandscape: false, showRotateOverlay: false, showRotateBanner: true },
    },
    {
      name: 'detect: small-tablet boundary 1023 landscape -> tablet-sm, nothing',
      input: { width: 1023, height: 768, isTouch: true, orientation: 'landscape' },
      expect: { tier: 'tablet-sm', isPortrait: false, isLandscape: true, showRotateOverlay: false, showRotateBanner: false },
    },
    {
      name: 'detect: iPad 1024x1366 portrait -> tablet, NEITHER overlay nor banner',
      input: { width: 1024, height: 1366, isTouch: true, orientation: 'portrait' },
      expect: { tier: 'tablet', isPortrait: true, isLandscape: false, showRotateOverlay: false, showRotateBanner: false },
    },
    {
      name: 'detect: iPad landscape 1366x1024 -> tablet, nothing',
      input: { width: 1366, height: 1024, isTouch: true, orientation: 'landscape' },
      expect: { tier: 'tablet', isPortrait: false, isLandscape: true, showRotateOverlay: false, showRotateBanner: false },
    },
    {
      name: 'detect: laptop 1440x900 non-touch landscape -> desktop, nothing',
      input: { width: 1440, height: 900, isTouch: false, orientation: 'landscape' },
      expect: { tier: 'desktop', isPortrait: false, isLandscape: true, showRotateOverlay: false, showRotateBanner: false },
    },
    {
      name: 'detect: 390x844 portrait on a NON-touch device -> desktop, nothing',
      input: { width: 390, height: 844, isTouch: false, orientation: 'portrait' },
      expect: { tier: 'desktop', isPortrait: true, isLandscape: false, showRotateOverlay: false, showRotateBanner: false },
    },
    {
      name: 'detect: tablet-sm portrait with bannerDismissed -> no banner',
      input: { width: 768, height: 1024, isTouch: true, orientation: 'portrait', bannerDismissed: true },
      expect: { tier: 'tablet-sm', isPortrait: true, isLandscape: false, showRotateOverlay: false, showRotateBanner: false },
    },
  ]

  for (const testCase of TIER_CASES) {
    const got = detectDeviceTier(testCase.input)
    const mismatch = Object.keys(testCase.expect)
      .filter(key => got[key] !== testCase.expect[key])
      .map(key => `${key}: expected ${testCase.expect[key]}, got ${got[key]}`)
    log(testCase.name, mismatch.length === 0, mismatch.join('; '))
  }
}

/* ══════════════════════════════════════════════════════════════════════
   2. BROWSER — device matrix
   ══════════════════════════════════════════════════════════════════════ */
const browser = await launch()

const browserErrors = []
const watchPage = (page, label) => {
  page.on('pageerror', err => {
    browserErrors.push(`${label}: ${err.message}`)
    console.log(`PAGE ERROR [${label}]:`, err.message)
  })
  return page
}

/** Logs in once at desktop size; the session is reused by every device. */
async function seedAuthState() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await context.addInitScript((key) => { try { localStorage.setItem(key, 'true') } catch { /* ignore */ } }, HIDE_SURVEY)
  const page = watchPage(await context.newPage(), 'auth-seed')
  // Other teammates edit the same dev-server module graph, so a transient
  // compile error can blank the app for a moment — retry rather than flake.
  let lastBody = ''
  let ready = false
  for (let attempt = 1; attempt <= 4 && !ready; attempt++) {
    await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {})
    ready = await page.waitForSelector('input[type="email"]', { timeout: 8000 }).then(() => true).catch(() => false)
    if (!ready) {
      lastBody = await page.evaluate(() => document.body.innerText).catch(() => '')
      console.log(`INFO | /login not ready (attempt ${attempt}/4) — retrying; body="${lastBody.replace(/\s+/g, ' ').slice(0, 160)}"`)
      await page.waitForTimeout(3000)
    }
  }
  if (!ready) throw new Error(`/login never rendered the sign-in form; last body="${lastBody.replace(/\s+/g, ' ').slice(0, 200)}"`)
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => !window.location.pathname.includes('/login'), null, { timeout: 15000 })
    .catch(() => {})
  await page.waitForTimeout(1500)

  // Seed a POST-TUTORIAL learner, exactly like the other suites do. Without
  // this, TutorialGate redirects every derived device context into
  // /level/0/stage/0?tutorial=true (its welcome modal then covers the app by
  // design), and the "app is interactive again" hit test measures the modal.
  // It also makes this suite independent of suites that wipe server progress.
  await page.goto(BASE + '/level/0/stages', { waitUntil: 'domcontentloaded' }).catch(() => {})
  await page.waitForTimeout(1500)
  await page.evaluate((prefix) => {
    const key = Object.keys(localStorage).find(k => k.startsWith(prefix))
    if (!key) return
    const data = JSON.parse(localStorage.getItem(key))
    data.hasSeenTutorial = true
    data.points = Math.max(Number(data.points) || 0, 150)
    localStorage.setItem(key, JSON.stringify(data))
  }, PROGRESS_KEY_PREFIX)
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {})
  await page.waitForTimeout(1500)

  const state = await context.storageState()
  const urls = (state.origins || []).map(o => `${o.origin}(${o.localStorage.length})`)
  log('auth session seeded for the device matrix', !page.url().includes('/login'),
    `url=${page.url()} origins=${urls.join(',')}`)
  await context.close()
  return state
}

async function openDevice({ label, viewport, isMobile = false, hasTouch = false, storageState }) {
  const context = await browser.newContext({ viewport, isMobile, hasTouch, storageState })
  await context.addInitScript((key) => { try { localStorage.setItem(key, 'true') } catch { /* ignore */ } }, HIDE_SURVEY)
  const page = watchPage(await context.newPage(), label)
  return { context, page }
}

/** Navigates to an authenticated route and waits for the app shell. */
async function openShell(page, path = '/levels') {
  for (let attempt = 1; attempt <= 3; attempt++) {
    // `networkidle` is flaky while other teammates' tests hit the same dev
    // server, so wait for the app shell explicitly instead.
    const navigated = await page
      .goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 20000 })
      .then(() => true)
      .catch(err => { console.log(`INFO | ${path} navigation failed: ${err.message.split('\n')[0]}`); return false })
    if (!navigated) {
      await page.waitForTimeout(3000)
      continue
    }
    const mounted = await page
      .waitForFunction(() => {
        // "App shell rendered" = the router mounted real content, not just the
        // progress-hydration spinner (which has no controls at all).
        const root = document.getElementById('root')
        const hasControls = document.querySelectorAll('#root a, #root button, #root [role="button"]').length > 0
        return (root?.children.length ?? 0) > 0 && hasControls
      }, null, { timeout: 15000 })
      .then(() => true)
      .catch(() => false)
    if (mounted) {
      await page.waitForTimeout(700) // hook mount reconciliation
      return
    }
    console.log(`INFO | ${path} rendered no app shell (attempt ${attempt}/3) — retrying`)
    await page.waitForTimeout(3000)
  }
}

/**
 * One round-trip DOM snapshot: gate state, overlay geometry/paint, scroll lock,
 * app-shell presence and the first interactive app control (marked with
 * data-e2e-probe so a hit test can prove whether it is reachable).
 */
function probe(bannerKey) {
  const overlay = document.querySelector('[data-testid="rotate-overlay"]')
  const banner = document.querySelector('[data-testid="rotate-banner"]')
  const inGate = el => Boolean(el && el.closest('[data-testid="rotate-overlay"], [data-testid="rotate-banner"]'))
  const bodyStyle = getComputedStyle(document.body)

  const controls = [...document.querySelectorAll('#root a, #root button, #root [role="button"]')]
    .filter(el => !inGate(el))
    .map(el => ({ el, rect: el.getBoundingClientRect() }))
    .filter(({ rect }) => rect.width > 8 && rect.height > 8
      && rect.top >= 0 && rect.left >= 0
      && rect.bottom <= window.innerHeight && rect.right <= window.innerWidth)

  // Prefer a labelled control, so the hit test names something recognisable
  // (the first element in DOM order is often an unlabelled logo link).
  const labelled = controls.filter(({ el }) => (el.innerText || el.getAttribute('aria-label') || '').trim().length > 0)
  const chosen = labelled.length ? [labelled[0]] : controls

  let control = null
  if (chosen.length) {
    const { el, rect } = chosen[0]
    el.setAttribute('data-e2e-probe', 'app-control')
    control = {
      tag: el.tagName,
      text: (el.innerText || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 40),
      cx: Math.round(rect.left + rect.width / 2),
      cy: Math.round(rect.top + rect.height / 2),
    }
  }

  let overlayInfo = null
  if (overlay) {
    const r = overlay.getBoundingClientRect()
    const cs = getComputedStyle(overlay)
    const svg = overlay.querySelector('svg')
    overlayInfo = {
      rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      coversViewport: r.x <= 0 && r.y <= 0 && r.width >= window.innerWidth - 1 && r.height >= window.innerHeight - 1,
      backgroundColor: cs.backgroundColor,
      position: cs.position,
      zIndex: cs.zIndex,
      pointerEvents: cs.pointerEvents,
      text: (overlay.innerText || '').replace(/\s+/g, ' ').trim(),
      buttons: overlay.querySelectorAll('button').length,
      tier: overlay.getAttribute('data-device-tier'),
      animationName: svg ? getComputedStyle(svg).animationName : null,
    }
  }

  let bannerInfo = null
  if (banner) {
    const cs = getComputedStyle(banner)
    const r = banner.getBoundingClientRect()
    bannerInfo = {
      text: (banner.innerText || '').replace(/\s+/g, ' ').trim(),
      position: cs.position,
      zIndex: cs.zIndex,
      top: Math.round(r.top),
      height: Math.round(r.height),
      tier: banner.getAttribute('data-device-tier'),
      hasDismiss: Boolean(banner.querySelector('[data-testid="rotate-banner-dismiss"]')),
    }
  }

  return {
    url: window.location.href,
    viewport: { w: window.innerWidth, h: window.innerHeight },
    rootChildren: document.getElementById('root')?.children.length ?? 0,
    controlCount: controls.length,
    control,
    overlay: overlayInfo,
    banner: bannerInfo,
    bodyClass: document.body.className,
    bodyOverflow: bodyStyle.overflow,
    bodyOverscroll: bodyStyle.overscrollBehavior,
    bodyTouchAction: bodyStyle.touchAction,
    pageScrollable: document.documentElement.scrollHeight > window.innerHeight + 2,
    scrollY: window.scrollY,
    storedBannerFlag: (() => { try { return sessionStorage.getItem(bannerKey) } catch { return 'THREW' } })(),
  }
}

const screenshotFree = p => JSON.stringify(p)

/* ── A. iPhone 13 portrait: overlay is up and nothing underneath is usable ── */
const auth = await seedAuthState()

const iphone = await openDevice({
  label: 'iphone',
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  storageState: auth,
})
await openShell(iphone.page, '/levels')
let p = await iphone.page.evaluate(probe, HIDE_ROTATE_BANNER)

log('iPhone portrait (390x844): app shell renders behind the gate',
  p.rootChildren > 0 && p.controlCount > 0, `rootChildren=${p.rootChildren} appControls=${p.controlCount} url=${p.url}`)
log('iPhone portrait: rotate overlay is present',
  Boolean(p.overlay), p.overlay ? screenshotFree(p.overlay) : 'no overlay')
log('iPhone portrait: overlay is a fixed, opaque, z-[9999] full-viewport layer',
  Boolean(p.overlay)
  && p.overlay.position === 'fixed'
  && p.overlay.coversViewport
  && p.overlay.zIndex === '9999'
  && /^rgb\(/.test(p.overlay.backgroundColor),
  p.overlay ? `position=${p.overlay.position} rect=${JSON.stringify(p.overlay.rect)} z=${p.overlay.zIndex} bg=${p.overlay.backgroundColor}` : 'n/a')
log('iPhone portrait: overlay copy is exactly the frozen sentence',
  Boolean(p.overlay) && p.overlay.text.includes(OVERLAY_TEXT) && p.overlay.text.length > OVERLAY_TEXT.length,
  p.overlay ? `"${p.overlay.text}"` : 'n/a')
log('iPhone portrait: overlay has no dismiss control (non-dismissible)',
  Boolean(p.overlay) && p.overlay.buttons === 0, p.overlay ? `buttons=${p.overlay.buttons}` : 'n/a')
log('iPhone portrait: rotating-device animation from index.css is applied',
  Boolean(p.overlay) && p.overlay.animationName === 'praxisRotateDevice',
  p.overlay ? `animationName=${p.overlay.animationName}` : 'n/a')

const hitPortrait = await iphone.page.evaluate(({ x, y }) => {
  const el = document.elementFromPoint(x, y)
  const overlay = document.querySelector('[data-testid="rotate-overlay"]')
  return {
    tag: el ? el.tagName : null,
    testid: el ? el.getAttribute('data-testid') : null,
    inOverlay: Boolean(el && overlay && overlay.contains(el)),
    isAppControl: Boolean(el && el.closest('[data-e2e-probe="app-control"]')),
  }
}, p.control ? { x: p.control.cx, y: p.control.cy } : { x: 10, y: 10 })

log('iPhone portrait: the app is NOT interactive — hit test at the control lands on the overlay',
  hitPortrait.inOverlay && !hitPortrait.isAppControl,
  `probe=${p.control ? p.control.tag + ' "' + p.control.text + '"' : 'none'} hit=${hitPortrait.tag}/${hitPortrait.testid} inOverlay=${hitPortrait.inOverlay} isAppControl=${hitPortrait.isAppControl}`)

log('iPhone portrait: scrolling is locked while the overlay is mounted',
  p.bodyClass.includes('praxis-overlay-open')
  && p.bodyOverflow === 'hidden'
  && p.bodyOverscroll === 'none'
  && p.bodyTouchAction === 'none',
  `class="${p.bodyClass}" overflow=${p.bodyOverflow} overscroll=${p.bodyOverscroll} touch-action=${p.bodyTouchAction}`)

// `overflow: hidden` blocks USER scrolling, not programmatic scrollTo, so the
// lock has to be probed with a real wheel gesture. The app's own pages scroll
// in inner containers, so give the document something to scroll first
// (test-only element, removed again) and release/re-take the lock around a
// second gesture to prove the gesture itself works.
await iphone.page.evaluate(() => {
  const spacer = document.createElement('div')
  spacer.setAttribute('data-e2e-lock-probe', 'true')
  spacer.style.height = '3000px'
  document.body.appendChild(spacer)
})
const contentHeight = await iphone.page.evaluate(() => document.documentElement.scrollHeight)
await iphone.page.mouse.move(195, 420)
await iphone.page.mouse.wheel(0, 700)
await iphone.page.waitForTimeout(500)
const lockedScrollY = await iphone.page.evaluate(() => window.scrollY)
const lockApplied = await iphone.page.evaluate(() => document.body.classList.contains('praxis-overlay-open'))

// Release the lock for one gesture (synchronously, test-only; restored below).
await iphone.page.evaluate(() => document.body.classList.remove('praxis-overlay-open'))
await iphone.page.mouse.wheel(0, 700)
await iphone.page.waitForFunction(() => window.scrollY > 0, null, { timeout: 4000 }).catch(() => {})
const unlockedScrollY = await iphone.page.evaluate(() => window.scrollY)

const lockRestored = await iphone.page.evaluate(() => {
  document.body.classList.add('praxis-overlay-open')
  document.querySelector('[data-e2e-lock-probe]')?.remove()
  window.scrollTo(0, 0)
  return {
    classRestored: document.body.classList.contains('praxis-overlay-open'),
    probeRemoved: !document.querySelector('[data-e2e-lock-probe]'),
  }
})
log('iPhone portrait: the lock really blocks user scrolling (wheel is inert while locked, scrolls once released)',
  lockApplied
  && contentHeight > 844
  && lockedScrollY === 0
  && unlockedScrollY > 0
  && lockRestored.classRestored
  && lockRestored.probeRemoved,
  `contentHeight=${contentHeight} viewport=844 wheel scrollY locked=${lockedScrollY} unlocked=${unlockedScrollY} restored=${JSON.stringify(lockRestored)}`)

/* ── A2. Same context, live resize to landscape (NO reload) ───────────── */
await iphone.page.setViewportSize({ width: 844, height: 390 })
await iphone.page.waitForSelector(OVERLAY_TESTID, { state: 'detached', timeout: 5000 }).catch(() => {})
await iphone.page.waitForTimeout(400)
p = await iphone.page.evaluate(probe, HIDE_ROTATE_BANNER)

log('iPhone rotated to landscape (setViewportSize, no reload): overlay disappears',
  !p.overlay, p.overlay ? screenshotFree(p.overlay) : `no overlay at ${p.viewport.w}x${p.viewport.h}`)
log('iPhone landscape: scroll lock is released on unmount',
  !p.bodyClass.includes('praxis-overlay-open') && p.bodyOverflow !== 'hidden',
  `class="${p.bodyClass}" overflow=${p.bodyOverflow}`)

const hitLandscape = await iphone.page.evaluate(({ x, y }) => {
  const el = document.elementFromPoint(x, y)
  return {
    tag: el ? el.tagName : null,
    isAppControl: Boolean(el && el.closest('[data-e2e-probe="app-control"]')),
  }
}, p.control ? { x: p.control.cx, y: p.control.cy } : { x: 10, y: 10 })
log('iPhone landscape: the app is interactive again (hit test reaches the control)',
  hitLandscape.isAppControl,
  `probe=${p.control ? `${p.control.tag} "${p.control.text}" @${p.control.cx},${p.control.cy}` : 'none'} hit=${hitLandscape.tag} isAppControl=${hitLandscape.isAppControl}`)

let trialClickError = null
try {
  await iphone.page.locator('[data-e2e-probe="app-control"]').first().click({ trial: true, timeout: 3000 })
} catch (err) {
  trialClickError = err.message.split('\n')[0]
}
log('iPhone landscape: a trial click on the app control passes actionability checks',
  trialClickError === null, trialClickError || 'click({ trial: true }) reached the element')

/* ── A3. Rotating back re-arms the gate, including on public routes ───── */
await iphone.page.setViewportSize({ width: 390, height: 844 })
await iphone.page.waitForSelector(OVERLAY_TESTID, { state: 'visible', timeout: 5000 }).catch(() => {})
await iphone.page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {})
await iphone.page.waitForFunction(() => (document.getElementById('root')?.children.length ?? 0) > 0, null, { timeout: 15000 }).catch(() => {})
await iphone.page.waitForTimeout(700)
const landing = await iphone.page.evaluate(probe, HIDE_ROTATE_BANNER)
log('iPhone portrait: the gate re-arms when rotated back, and is global (covers the public landing page)',
  Boolean(landing.overlay), `url=${landing.url} overlay=${Boolean(landing.overlay)} tier=${landing.overlay?.tier}`)
log('iPhone portrait: the landing page is likewise not interactive (hit test lands on the overlay)',
  Boolean(landing.overlay) && landing.controlCount > 0 && landing.bodyOverflow === 'hidden',
  `appControls=${landing.controlCount} bodyOverflow=${landing.bodyOverflow} bodyClass="${landing.bodyClass}"`)

await iphone.context.close()

/* ── B. Android phone portrait ───────────────────────────────────────── */
const android = await openDevice({
  label: 'android',
  viewport: { width: 360, height: 740 },
  isMobile: true,
  hasTouch: true,
  storageState: auth,
})
await openShell(android.page, '/levels')
p = await android.page.evaluate(probe, HIDE_ROTATE_BANNER)
log('Android portrait (360x740): overlay present, banner absent',
  Boolean(p.overlay) && !p.banner,
  p.overlay ? `tier=${p.overlay.tier} text="${p.overlay.text.slice(0, 60)}" banner=${Boolean(p.banner)}` : 'no overlay')
log('Android portrait: overlay reports the phone tier',
  Boolean(p.overlay) && p.overlay.tier === 'phone', p.overlay ? `tier=${p.overlay.tier}` : 'n/a')
await android.context.close()

/* ── C. Small tablet portrait: banner + session-persistent dismissal ──── */
const tablet = await openDevice({
  label: 'tablet-sm',
  viewport: { width: 768, height: 1024 },
  isMobile: true,
  hasTouch: true,
  storageState: auth,
})
const tabletPage = tablet.page
await openShell(tabletPage, '/levels')
p = await tabletPage.evaluate(probe, HIDE_ROTATE_BANNER)

log('small tablet portrait (768x1024): banner present, NO overlay',
  Boolean(p.banner) && !p.overlay,
  `banner=${p.banner ? JSON.stringify({ tier: p.banner.tier, pos: p.banner.position, top: p.banner.top, h: p.banner.height }) : 'none'} overlay=${Boolean(p.overlay)}`)
log('small tablet portrait: banner shows the exact frozen copy + a dismiss control',
  Boolean(p.banner) && p.banner.text.includes(BANNER_TEXT) && p.banner.hasDismiss,
  p.banner ? `text="${p.banner.text}" hasDismiss=${p.banner.hasDismiss}` : 'n/a')
log('small tablet portrait: banner sticks to the top of the viewport',
  Boolean(p.banner) && p.banner.position === 'sticky' && p.banner.top <= 1 && p.banner.zIndex === '9998',
  p.banner ? `position=${p.banner.position} top=${p.banner.top} z=${p.banner.zIndex}` : 'n/a')
log('small tablet portrait: banner dismissal flag starts unset',
  p.storedBannerFlag === null, `sessionStorage[${BANNER_KEY}]=${p.storedBannerFlag}`)

await tabletPage.click('[data-testid="rotate-banner-dismiss"]')
await tabletPage.waitForSelector(BANNER_TESTID, { state: 'detached', timeout: 4000 }).catch(() => {})
await tabletPage.waitForTimeout(250)
p = await tabletPage.evaluate(probe, HIDE_ROTATE_BANNER)
log('small tablet portrait: ✕ dismisses the banner immediately',
  !p.banner && p.storedBannerFlag === 'true',
  `banner=${Boolean(p.banner)} sessionStorage[${BANNER_KEY}]=${p.storedBannerFlag}`)

await tabletPage.reload({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {})
await tabletPage.waitForFunction(() => {
  const root = document.getElementById('root')
  const hasControls = document.querySelectorAll('#root a, #root button, #root [role="button"]').length > 0
  return (root?.children.length ?? 0) > 0 && hasControls
}, null, { timeout: 15000 }).catch(() => {})
await tabletPage.waitForTimeout(800)
p = await tabletPage.evaluate(probe, HIDE_ROTATE_BANNER)
log('small tablet portrait: after a reload in the same session the banner stays gone',
  !p.banner && !p.overlay && p.rootChildren > 0 && p.controlCount > 0,
  `banner=${Boolean(p.banner)} overlay=${Boolean(p.overlay)} appControls=${p.controlCount} url=${p.url}`)

// sessionStorage is per-tab: a NEW tab is a new session, so the banner is
// allowed (and expected) to come back there. Proves the flag is session-scoped.
const tabletTab2 = watchPage(await tablet.context.newPage(), 'tablet-sm-newtab')
await openShell(tabletTab2, '/levels')
const p2 = await tabletTab2.evaluate(probe, HIDE_ROTATE_BANNER)
log('small tablet: dismissal is session-scoped (a fresh tab shows the banner again)',
  Boolean(p2.banner) && p2.storedBannerFlag === null,
  `banner=${Boolean(p2.banner)} sessionStorage[${BANNER_KEY}]=${p2.storedBannerFlag}`)
await tablet.context.close()

/* ── D. iPad portrait: neither gate ──────────────────────────────────── */
const ipad = await openDevice({
  label: 'ipad',
  viewport: { width: 1024, height: 1366 },
  isMobile: true,
  hasTouch: true,
  storageState: auth,
})
await openShell(ipad.page, '/levels')
p = await ipad.page.evaluate(probe, HIDE_ROTATE_BANNER)
log('iPad portrait (1024x1366): NO overlay, NO banner, app renders',
  !p.overlay && !p.banner && p.rootChildren > 0 && p.controlCount > 0,
  `overlay=${Boolean(p.overlay)} banner=${Boolean(p.banner)} rootChildren=${p.rootChildren} appControls=${p.controlCount} url=${p.url}`)
await ipad.context.close()

/* ── E/F. Laptop + desktop: neither gate ─────────────────────────────── */
for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 800 }]) {
  const laptop = await openDevice({ label: `desktop-${viewport.width}`, viewport, storageState: auth })
  await openShell(laptop.page, '/levels')
  p = await laptop.page.evaluate(probe, HIDE_ROTATE_BANNER)
  log(`desktop ${viewport.width}x${viewport.height} (no touch): NO overlay, NO banner, app renders`,
    !p.overlay && !p.banner && p.rootChildren > 0 && p.controlCount > 0,
    `overlay=${Boolean(p.overlay)} banner=${Boolean(p.banner)} appControls=${p.controlCount} url=${p.url}`)

  if (viewport.width === 1440) {
    // The CSS utility the tiered workspace (T4) composes with, measured live.
    const utility = await laptop.page.evaluate(() => {
      const el = document.createElement('span')
      el.className = 'praxis-touch-target'
      el.textContent = '✕'
      document.body.appendChild(el)
      const cs = getComputedStyle(el)
      const r = el.getBoundingClientRect()
      const out = {
        minWidth: cs.minWidth, minHeight: cs.minHeight, display: cs.display,
        alignItems: cs.alignItems, justifyContent: cs.justifyContent,
        w: Math.round(r.width), h: Math.round(r.height),
      }
      el.remove()
      return out
    })
    log('.praxis-touch-target CSS utility enforces a 44x44 inline-flex target',
      utility.minWidth === '44px' && utility.minHeight === '44px' && utility.display === 'inline-flex'
      && utility.alignItems === 'center' && utility.justifyContent === 'center'
      && utility.w >= 44 && utility.h >= 44,
      JSON.stringify(utility))
  }
  await laptop.context.close()
}

/* ── No regressions ──────────────────────────────────────────────────── */
log('no uncaught page errors across the device matrix',
  browserErrors.length === 0, browserErrors.slice(0, 3).join(' | ') || 'clean')

/* ── Summary ─────────────────────────────────────────────────────────── */
const failed = results.filter(r => !r.ok)
console.log(`\n=== SUMMARY === ${results.length - failed.length}/${results.length} passed`)
failed.forEach(f => console.log('  ❌ ' + f.name))
await browser.close()
process.exit(failed.length > 0 ? 1 : 0)
