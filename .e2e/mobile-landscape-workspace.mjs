/**
 * T4 — Workspace: custom sandbox play + device-tiered layouts.
 *
 * Drives the REAL workspace and measures the DOM, asserting the two halves of
 * task-4:
 *
 *   A. /sandbox/play renders the expression the learner typed (route state or
 *      sessionStorage), with the Guide enabled and free, no randomizer, no
 *      difficulty picker and no /api/score call.
 *   B. device tiers:
 *        1. phone landscape 844x390 — no rotate overlay, no horizontal page
 *           scroll, every expression target / law chip / header control
 *           >= 44x44, laws are a horizontal strip, step history is a drawer
 *        2. the phone-landscape layout can actually solve a step
 *        3. tablet portrait 768x1024 — laws are a GRID below the expression
 *        4. desktop 1440x900 (no touch) — unchanged three-column layout
 *        5. tablet landscape 1024x768 — history left, canvas centre, laws right
 *
 * Requires: vite dev server on 5173, FastAPI on 8000, e2e user to exist.
 * Run:  node .e2e/mobile-landscape-workspace.mjs [--section=1,2,3,4,5]
 */
import { launch, HIDE_SURVEY, PROGRESS_KEY_PREFIX } from './_harness.mjs'

// The dev server binds to [::1]; 127.0.0.1 also resolves here, localhost is the
// form the other workspace suites use.
const BASE = 'http://localhost:5173'
const EMAIL = 'e2e-test@praxis.test'
const PASSWORD = 'E2eTest!2345'
const MIN_TAP = 44

const onlyArg = process.argv.find(a => a.startsWith('--section='))
const ONLY = onlyArg ? new Set(onlyArg.split('=')[1].split(',').map(s => s.trim())) : null
const want = (n) => !ONLY || ONLY.has(String(n))

const results = []
const log = (name, ok, extra = '') => {
  results.push({ name, ok: Boolean(ok) })
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${extra ? ' | ' + extra : ''}`)
}
const section = (t) => console.log(`\n──── ${t} ────`)
const norm = (s) => String(s || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()

const browser = await launch()

/** Logs in and seeds a post-tutorial learner (the tutorial gate guards both routes). */
async function makeLearner(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  const apiCalls = []
  page.on('request', r => { if (r.url().includes('/api/')) apiCalls.push(`${r.method()} ${r.url().replace(BASE, '')}`) })
  await page.addInitScript((key) => localStorage.setItem(key, 'true'), HIDE_SURVEY)
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForTimeout(2500)

  // The gate reads `hasSeenTutorial`; the graded Guide reads `points`. Seed from
  // the ungated tutorial route, then remount so useProgress re-reads it.
  await page.goto(BASE + '/level/0/stages', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  await page.evaluate((prefix) => {
    const key = Object.keys(localStorage).find(k => k.startsWith(prefix))
    if (!key) return
    const data = JSON.parse(localStorage.getItem(key))
    data.points = Math.max(Number(data.points) || 0, 120)
    data.hasSeenTutorial = true
    localStorage.setItem(key, JSON.stringify(data))
  }, PROGRESS_KEY_PREFIX)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
  return { ctx, page, errors, apiCalls }
}

/** Measures the tap targets the task cares about, in CSS px. */
function measureTargets(page) {
  return page.evaluate(() => {
    const box = el => {
      const r = el.getBoundingClientRect()
      return { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), left: Math.round(r.left) }
    }
    const visible = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
    const collect = sel => [...document.querySelectorAll(sel)].filter(visible).map(box)
    return {
      literals: collect('[data-tutorial="canvas"] [data-path]'),
      notCapsules: collect('[data-tutorial="canvas"] [data-tutorial="not-capsule"]'),
      grips: collect('[data-tutorial="canvas"] button[title*="grip" i]'),
      lawCards: collect('[data-tutorial^="law-card-"]'),
      lawRefChips: collect('[data-testid="law-ref-chip"]'),
      headerButtons: collect('[data-tutorial="hint-button"], [data-tutorial="guide-button"], [data-tutorial="laws-reference-button"], [data-tutorial="undo-button"], [data-tutorial="reset-button"], [data-testid="step-history-toggle"]'),
      literalFontSize: (() => {
        const el = document.querySelector('[data-tutorial="canvas"] [data-path]')
        return el ? parseFloat(getComputedStyle(el).fontSize) : 0
      })(),
      headerFontSizes: [...document.querySelectorAll('[data-tutorial="hint-button"], [data-tutorial="guide-button"], [data-tutorial="laws-reference-button"], [data-testid="step-history-toggle"]')]
        .filter(visible).map(el => parseFloat(getComputedStyle(el).fontSize)),
      lawCardFontSizes: [...document.querySelectorAll('[data-tutorial^="law-card-"], [data-testid="law-ref-chip"]')]
        .filter(visible).map(el => parseFloat(getComputedStyle(el).fontSize)),
    }
  })
}

/** Waits until the workspace tree is rendered (progress hydration + level fetch). */
async function waitForWorkspace(page, timeout = 30000) {
  await page.waitForSelector('[data-tutorial="canvas"] [data-path]', { timeout })
  await page.waitForTimeout(500)
}

const undersized = (list) => list.filter(r => r.w < MIN_TAP || r.h < MIN_TAP)
const range = (list) => (list.length === 0 ? 'n/a' : `${Math.min(...list.map(r => r.w))}x${Math.min(...list.map(r => r.h))} .. ${Math.max(...list.map(r => r.w))}x${Math.max(...list.map(r => r.h))}`)

/** Selects rendered nodes until a law becomes applicable (the real click path). */
async function selectUntilLawAppears(page, attempts = 40) {
  const paths = await page.evaluate(() =>
    [...document.querySelectorAll('[data-tutorial="canvas"] [data-path]')]
      .filter(el => el.getBoundingClientRect().width > 0)
      .map(el => el.getAttribute('data-path')))
  const nodeAt = (p) => page.locator(`[data-tutorial="canvas"] [data-path="${p}"]`).first()
  const cards = () => page.locator('[data-tutorial^="law-card-"]')
  for (let i = 0; i < paths.length && i < attempts; i++) {
    await nodeAt(paths[i]).click({ force: true })
    await page.waitForTimeout(140)
    if ((await cards().count()) > 0) return paths[i]
    for (let j = i + 1; j < paths.length; j++) {
      await nodeAt(paths[j]).click({ force: true })
      await page.waitForTimeout(150)
      if ((await cards().count()) > 0) return `${paths[i]}+${paths[j]}`
      await nodeAt(paths[j]).click({ force: true })
      await page.waitForTimeout(80)
    }
    await nodeAt(paths[i]).click({ force: true })
    await page.waitForTimeout(80)
  }
  return null
}

/* ══════════════════════════════════════════════════════════════════════════
   1 + 2 — Phone landscape: usable, tap-sized, no page scroll, strip + drawer
   ══════════════════════════════════════════════════════════════════════════ */
if (want(1) || want(2)) {
  section('1. Phone landscape 844x390')
  const { ctx, page, errors } = await makeLearner({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true })
  await page.goto(BASE + '/level/1/stage/0', { waitUntil: 'domcontentloaded' })
  await waitForWorkspace(page)

  log('1.1 no rotate overlay in landscape', await page.locator('[data-testid="rotate-overlay"]').count() === 0)

  const scroll = await page.evaluate(() => ({
    html: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    inner: window.innerWidth,
    htmlH: document.documentElement.scrollHeight,
    innerH: window.innerHeight,
  }))
  log('1.2 no horizontal page scroll',
    scroll.html <= scroll.inner + 1 && scroll.body <= scroll.inner + 1,
    `innerWidth=${scroll.inner} html=${scroll.html} body=${scroll.body}`)
  log('1.3 no vertical page scroll either (shell is viewport-sized)',
    scroll.htmlH <= scroll.innerH + 1, `innerHeight=${scroll.innerH} html=${scroll.htmlH}`)

  const atLoad = await measureTargets(page)
  log('1.4 literals are >= 44x44', undersized(atLoad.literals).length === 0,
    `n=${atLoad.literals.length} min-range=${range(atLoad.literals)} undersized=${undersized(atLoad.literals).length}`)
  log('1.5 term grips (⠿) are >= 44x44 and visible without hover',
    atLoad.grips.length > 0 && undersized(atLoad.grips).length === 0,
    `n=${atLoad.grips.length} min-range=${range(atLoad.grips)} undersized=${undersized(atLoad.grips).length}`)
  log('1.6 header controls are >= 44x44',
    atLoad.headerButtons.length >= 5 && undersized(atLoad.headerButtons).length === 0,
    `n=${atLoad.headerButtons.length} min-range=${range(atLoad.headerButtons)} undersized=${undersized(atLoad.headerButtons).length}`)

  // Law chips only exist once something is selected — that is gameplay, not a
  // layout filter: the strip renders every applicable law it is given.
  const firstSelection = await selectUntilLawAppears(page)
  const withLaws = await measureTargets(page)
  log('1.7 law chips are >= 44x44', withLaws.lawCards.length > 0 && undersized(withLaws.lawCards).length === 0,
    `selection=${firstSelection} n=${withLaws.lawCards.length} min-range=${range(withLaws.lawCards)} undersized=${undersized(withLaws.lawCards).length}`)
  // The 10 reference laws moved OUT of the strip (user request: the strip was a
  // two-row jumble) and now live behind the Laws button / bottom sheet, so the
  // strip must contain no reference chips at all.
  log('1.8 the strip carries gameplay laws only — reference chips live behind the Laws sheet',
    withLaws.lawRefChips.length === 0,
    `referenceChipsInStrip=${withLaws.lawRefChips.length}`)

  // Type floor: literals >= 16px, chrome text >= 14px.
  log('1.9 expression literals are >= 16px', withLaws.literalFontSize >= 16, `fontSize=${withLaws.literalFontSize}px`)
  const chromeMin = withLaws.headerFontSizes.length ? Math.min(...withLaws.headerFontSizes) : 0
  const lawMin = withLaws.lawCardFontSizes.length ? Math.min(...withLaws.lawCardFontSizes) : 0
  log('1.10 header + law chip text is >= 14px', chromeMin >= 14 && lawMin >= 14,
    `header min=${chromeMin}px law chips min=${lawMin}px`)

  const dock = await page.evaluate(() => {
    const d = document.querySelector('[data-tutorial="laws-dock"]')
    if (!d) return null
    const r = d.getBoundingClientRect()
    const scrollers = [...d.querySelectorAll('*')]
      .filter(el => el.scrollWidth > el.clientWidth + 4)
      .map(el => ({ testid: el.getAttribute('data-testid') || el.tagName, overflowX: getComputedStyle(el).overflowX, scrollW: el.scrollWidth, clientW: el.clientWidth }))
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), viewportH: window.innerHeight, scrollers }
  })
  // The strip is a rail that scrolls horizontally whenever its content is wider
  // than the dock. With the reference chips gone a single law card no longer
  // overflows, so assert the rail's scroll CONFIGURATION plus its bottom
  // placement instead of requiring an actual overflow at this moment.
  const railCfg = await page.evaluate(() => {
    const rail = document.querySelector('[data-testid="laws-list"]')
    if (!rail) return null
    const cs = getComputedStyle(rail)
    return { overflowX: cs.overflowX, scrollW: rail.scrollWidth, clientW: rail.clientWidth }
  })
  log('1.11 the laws rail sits at the bottom and is configured to scroll sideways',
    Boolean(dock) && Boolean(railCfg) && railCfg.overflowX === 'auto'
      && dock.top > dock.viewportH * 0.5,
    `top=${dock?.top} viewportH=${dock?.viewportH} rail=${JSON.stringify(railCfg)} scrollers=${dock?.scrollers?.length ?? 0}`)

  // Step history: a toggle that opens an overlay drawer holding the same panel.
  const toggle = page.locator('[data-testid="step-history-toggle"]')
  log('1.12 header exposes the step-history toggle', await toggle.count() === 1, `count=${await toggle.count()}`)
  const panelWidthBefore = await page.evaluate(() => document.querySelector('[data-tutorial="step-history-panel"]')?.getBoundingClientRect().width ?? -1)
  await toggle.first().click()
  await page.waitForTimeout(600)
  const drawer = await page.evaluate(() => {
    const panel = document.querySelector('[data-tutorial="step-history-panel"]')
    if (!panel) return null
    const r = panel.getBoundingClientRect()
    const drawerEl = document.querySelector('[data-testid="step-history-drawer"]')
    return {
      visible: r.width > 0 && r.height > 0 && r.left >= 0,
      width: Math.round(r.width),
      insideDrawer: Boolean(drawerEl && drawerEl.contains(panel)),
      backdrop: Boolean(document.querySelector('[data-testid="step-history-backdrop"]')),
    }
  })
  log('1.13 the drawer contains the step-history panel and overlays the canvas',
    Boolean(drawer) && drawer.visible && drawer.insideDrawer && drawer.backdrop && panelWidthBefore === 0,
    `closedWidth=${panelWidthBefore} ${JSON.stringify(drawer)}`)
  await page.locator('[data-testid="step-history-backdrop"]').click({ position: { x: 800, y: 200 } }).catch(() => {})
  await page.waitForTimeout(400)
  log('1.14 backdrop tap closes the drawer',
    await page.evaluate(() => document.querySelector('[data-tutorial="step-history-panel"]')?.getBoundingClientRect().width === 0))

  // A NOT capsule is a distinct target; stage 6 opens with (xy)' + x'y.
  await page.goto(BASE + '/level/1/stage/6', { waitUntil: 'domcontentloaded' })
  await waitForWorkspace(page)
  const notStage = await measureTargets(page)
  log('1.15 NOT capsules are >= 44x44',
    notStage.notCapsules.length > 0 && undersized(notStage.notCapsules).length === 0,
    `n=${notStage.notCapsules.length} min-range=${range(notStage.notCapsules)} undersized=${undersized(notStage.notCapsules).length}`)
  log('1.16 stage 6 keeps literals + grips at >= 44x44',
    undersized(notStage.literals).length === 0 && notStage.grips.length > 0 && undersized(notStage.grips).length === 0,
    `literals=${notStage.literals.length} grips=${notStage.grips.length}`)

  if (want(2)) {
    section('2. Phone landscape is operable')
    await page.goto(BASE + '/level/1/stage/0', { waitUntil: 'domcontentloaded' })
    await waitForWorkspace(page)
    const before = norm(await page.locator('[data-tutorial="canvas"]').first().innerText())
    const selection = await selectUntilLawAppears(page)
    const cardCount = await page.locator('[data-tutorial^="law-card-"]').count()
    log('2.1 a term can be selected by tapping and a law becomes applicable',
      Boolean(selection) && cardCount > 0, `selection=${selection} lawCards=${cardCount}`)
    if (cardCount > 0) {
      await page.locator('[data-tutorial^="law-card-"]').first().click()
      // The law is applied after its animation finishes, so wait for the
      // recorded step rather than for a fixed delay.
      await page.waitForFunction(
        () => document.querySelectorAll('[data-tutorial^="step-history-card-"]').length >= 1,
        null,
        { timeout: 15000 },
      ).catch(() => {})
      await page.waitForTimeout(600)
      const after = norm(await page.locator('[data-tutorial="canvas"]').first().innerText())
      const diag = await page.evaluate(() => ({
        steps: document.querySelectorAll('[data-tutorial^="step-history-card-"]').length,
        modal: Boolean(document.querySelector('[data-tutorial="score-modal"]')),
        pill: (document.querySelector('[data-tutorial="canvas"]')?.parentElement?.innerText || '').replace(/\n/g, ' | ').slice(0, 80),
      }))
      log('2.2 applying the law solves a step in the mobile layout',
        after !== before && diag.steps >= 1,
        `stepCards=${diag.steps} modal=${diag.modal} pill="${diag.pill}" "${before.slice(0, 30)}" -> "${after.slice(0, 30)}"`)
      // Solving pops the success modal (z-50); dismiss it the way a user does
      // before reaching the header again.
      await page.locator('[data-tutorial="review-derivation-btn"]').first().click({ timeout: 8000 }).catch(() => {})
      await page.waitForTimeout(500)
      await page.locator('[data-testid="step-history-toggle"]').first().click()
      await page.waitForTimeout(600)
      log('2.3 the recorded step is visible in the drawer',
        await page.locator('[data-tutorial="step-history-card-0"]').first().isVisible().catch(() => false))
    } else {
      log('2.2 applying the law solves a step in the mobile layout', false, 'no law card appeared')
    }
  }

  log('1.17 no uncaught page errors in phone landscape', errors.length === 0, errors.slice(0, 3).join(' | '))
  await ctx.close()
}

/* ══════════════════════════════════════════════════════════════════════════
   3 — Tablet portrait 768x1024: two columns, laws as a grid below
   ══════════════════════════════════════════════════════════════════════════ */
if (want(3)) {
  section('3. Tablet portrait 768x1024')
  const { ctx, page, errors } = await makeLearner({ viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true })
  await page.goto(BASE + '/level/1/stage/0', { waitUntil: 'domcontentloaded' })
  await waitForWorkspace(page)

  const layout = await page.evaluate(() => {
    const canvas = document.querySelector('[data-tutorial="canvas"]')
    const dock = document.querySelector('[data-tutorial="laws-dock"]')
    const list = document.querySelector('[data-testid="laws-list"]')
    return {
      hasCanvas: Boolean(canvas), hasDock: Boolean(dock),
      canvasBottom: canvas ? Math.round(canvas.getBoundingClientRect().bottom) : null,
      dockTop: dock ? Math.round(dock.getBoundingClientRect().top) : null,
      listDisplay: list ? getComputedStyle(list).display : null,
      listLayout: list ? list.getAttribute('data-layout') : null,
      leftPanelWidth: document.querySelector('[data-tutorial="step-history-panel"]')?.getBoundingClientRect().width ?? -1,
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }
  })
  log('3.1 expression on top, law panel below it',
    layout.hasCanvas && layout.hasDock && layout.dockTop >= layout.canvasBottom - 1,
    `canvasBottom=${layout.canvasBottom} dockTop=${layout.dockTop}`)
  await selectUntilLawAppears(page)
  const grid = await page.evaluate(() => {
    const list = document.querySelector('[data-testid="laws-list"]')
    if (!list) return null
    const style = getComputedStyle(list)
    return {
      display: style.display,
      layout: list.getAttribute('data-layout'),
      columns: style.gridTemplateColumns.split(' ').filter(Boolean).length,
      cards: list.querySelectorAll('[data-tutorial^="law-card-"]').length,
    }
  })
  log('3.2 law cards are laid out as a 2-3 column grid',
    Boolean(grid) && grid.display === 'grid' && grid.columns >= 2 && grid.columns <= 3,
    JSON.stringify(grid))
  const tabletTargets = await measureTargets(page)
  log('3.3 tablet portrait tap targets are >= 44x44',
    undersized(tabletTargets.literals).length === 0
    && tabletTargets.grips.length > 0 && undersized(tabletTargets.grips).length === 0
    && tabletTargets.lawCards.length > 0 && undersized(tabletTargets.lawCards).length === 0
    && undersized(tabletTargets.headerButtons).length === 0,
    `literals=${range(tabletTargets.literals)} grips=${range(tabletTargets.grips)} laws=${range(tabletTargets.lawCards)} header=${range(tabletTargets.headerButtons)}`)
  log('3.4 tablet portrait has no horizontal page scroll', layout.scrollWidth <= layout.innerWidth + 1,
    `innerWidth=${layout.innerWidth} scrollWidth=${layout.scrollWidth}`)
  log('3.5 no uncaught page errors on tablet portrait', errors.length === 0, errors.slice(0, 3).join(' | '))
  await ctx.close()
}

/* ══════════════════════════════════════════════════════════════════════════
   4 — Desktop 1440x900, no touch: unchanged three-column design
   ══════════════════════════════════════════════════════════════════════════ */
if (want(4)) {
  section('4. Desktop 1440x900 (pointer only)')
  const { ctx, page, errors } = await makeLearner({ viewport: { width: 1440, height: 900 } })
  await page.goto(BASE + '/level/1/stage/0', { waitUntil: 'domcontentloaded' })
  await waitForWorkspace(page)

  const desk = await page.evaluate(() => {
    const box = sel => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { left: Math.round(r.left), top: Math.round(r.top), bottom: Math.round(r.bottom), width: Math.round(r.width), height: Math.round(r.height) } }
    const list = document.querySelector('[data-testid="laws-list"]')
    return {
      history: box('[data-tutorial="step-history-panel"]'),
      canvas: box('[data-tutorial="canvas"]'),
      dock: box('[data-tutorial="laws-dock"]'),
      rightPanel: box('[data-tutorial="points-and-assistance"]'),
      zoomIn: document.querySelectorAll('button[title="Zoom in"]').length,
      drawerToggle: document.querySelectorAll('[data-testid="step-history-toggle"]').length,
      listDisplay: list ? getComputedStyle(list).display : null,
      literalFont: parseFloat(getComputedStyle(document.querySelector('[data-tutorial="canvas"] [data-path]')).fontSize),
      headerFont: parseFloat(getComputedStyle(document.querySelector('[data-tutorial="hint-button"]')).fontSize),
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }
  })
  log('4.1 three columns present in the original order',
    Boolean(desk.history && desk.canvas && desk.dock && desk.rightPanel)
    && desk.history.left < desk.canvas.left
    && desk.canvas.left < desk.rightPanel.left
    && desk.dock.top >= desk.canvas.bottom - 1,
    JSON.stringify({ history: desk.history?.left, canvas: desk.canvas?.left, right: desk.rightPanel?.left, dockTop: desk.dock?.top, canvasBottom: desk.canvas?.bottom }))
  log('4.2 desktop chrome is unchanged (zoom controls in the header, no drawer toggle)',
    desk.zoomIn === 1 && desk.drawerToggle === 0, `zoomIn=${desk.zoomIn} drawerToggle=${desk.drawerToggle}`)
  log('4.3 desktop keeps its original type scale (11-12px chrome, 22px expression)',
    desk.literalFont === 22 && desk.headerFont <= 12, `literal=${desk.literalFont}px header=${desk.headerFont}px`)
  log('4.4 desktop has no horizontal page scroll', desk.scrollWidth <= desk.innerWidth + 1,
    `innerWidth=${desk.innerWidth} scrollWidth=${desk.scrollWidth}`)
  await page.setViewportSize({ width: 1024, height: 800 })
  await page.waitForTimeout(900)
  const narrow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    canvas: document.querySelectorAll('[data-tutorial="canvas"]').length,
    dock: document.querySelectorAll('[data-tutorial="laws-dock"]').length,
  }))
  log('4.5 1024px-wide desktop window still renders the workspace without page scroll',
    narrow.scrollWidth <= narrow.innerWidth + 1 && narrow.canvas === 1 && narrow.dock === 1, JSON.stringify(narrow))
  log('4.6 no uncaught page errors on desktop', errors.length === 0, errors.slice(0, 3).join(' | '))
  await ctx.close()
}

/* ══════════════════════════════════════════════════════════════════════════
   5 — Tablet landscape 1024x768: history left, canvas centre, laws right
   ══════════════════════════════════════════════════════════════════════════ */
if (want(5)) {
  section('5. Tablet landscape 1024x768')
  const { ctx, page, errors } = await makeLearner({ viewport: { width: 1024, height: 768 }, isMobile: true, hasTouch: true })
  await page.goto(BASE + '/level/1/stage/0', { waitUntil: 'domcontentloaded' })
  await waitForWorkspace(page)
  const land = await page.evaluate(() => {
    const box = sel => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) } }
    return {
      history: box('[data-tutorial="step-history-panel"]'),
      canvas: box('[data-tutorial="canvas"]'),
      dock: box('[data-tutorial="laws-dock"]'),
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }
  })
  log('5.1 three columns: history left, expression centre, laws right',
    Boolean(land.history && land.canvas && land.dock)
    && land.history.left < land.canvas.left && land.canvas.right <= land.dock.left + 1,
    JSON.stringify(land))
  log('5.2 tablet landscape has no horizontal page scroll', land.scrollWidth <= land.innerWidth + 1,
    `innerWidth=${land.innerWidth} scrollWidth=${land.scrollWidth}`)
  log('5.3 no uncaught page errors on tablet landscape', errors.length === 0, errors.slice(0, 3).join(' | '))
  await ctx.close()
}

/* ══════════════════════════════════════════════════════════════════════════
   6 — Custom sandbox expression: the real /sandbox -> /sandbox/play flow
   ══════════════════════════════════════════════════════════════════════════ */
if (want(6)) {
  section('6. Custom sandbox expression (typed on /sandbox, played on /sandbox/play)')
  const { ctx, page, apiCalls, errors } = await makeLearner({ viewport: { width: 1440, height: 900 } })

  await page.goto(BASE + '/sandbox', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-testid="sandbox-input"]', { timeout: 20000 })
  await page.locator('[data-testid="sandbox-input"]').fill("A(B + A')")
  await page.waitForTimeout(900) // live validator debounce

  const validateBtn = page.locator('[data-testid="sandbox-validate-btn"]')
  log('6.1 "A(B + A\')" validates on the input screen',
    await validateBtn.count() === 1 && !(await validateBtn.isDisabled()),
    `disabled=${await validateBtn.isDisabled().catch(() => 'missing')}`)

  await validateBtn.click()
  await page.waitForURL('**/sandbox/play', { timeout: 20000 }).catch(() => {})
  await waitForWorkspace(page)

  const canvasText = norm(await page.locator('[data-tutorial="canvas"]').first().innerText())
  log('6.2 the workspace renders that exact expression',
    canvasText.includes("A(B + A')") && page.url().endsWith('/sandbox/play'), canvasText.slice(0, 110))
  log('6.3 the typed expression is kept in view inside the canvas',
    await page.locator('[data-testid="custom-expression-label"]').count() === 1)

  const guide = page.locator('[data-tutorial="guide-button"]').first()
  log('6.4 Guide is enabled in the sandbox',
    await guide.count() === 1 && !(await guide.isDisabled()),
    `disabled=${await guide.isDisabled().catch(() => 'missing')}`)

  const pointsBefore = await page.evaluate((prefix) => {
    const key = Object.keys(localStorage).find(k => k.startsWith(prefix))
    return key ? localStorage.getItem(key) : null
  }, PROGRESS_KEY_PREFIX)
  await guide.click()
  await page.waitForTimeout(900)
  const pointsAfter = await page.evaluate((prefix) => {
    const key = Object.keys(localStorage).find(k => k.startsWith(prefix))
    return key ? localStorage.getItem(key) : null
  }, PROGRESS_KEY_PREFIX)
  // The Guide pre-selects the move it recommends, so a guided sandbox shows law
  // cards (or asks for a single highlighted click). It must stay free.
  const guideRun = await page.evaluate(() => ({
    cards: document.querySelectorAll('[data-tutorial^="law-card-"]').length,
    pill: (document.querySelector('[data-tutorial="canvas"]')?.parentElement?.innerText || '').replace(/\n/g, ' | ').slice(0, 110),
  }))
  log('6.5 the sandbox Guide runs and is free',
    (guideRun.cards > 0 || /Guide:/i.test(guideRun.pill)) && pointsAfter === pointsBefore,
    `lawCards=${guideRun.cards} pointsChanged=${pointsAfter !== pointsBefore} pill="${guideRun.pill}"`)

  // Clear whatever the Guide pre-selected before playing explicitly.
  await page.locator('[data-tutorial="reset-button"]').first().click()
  await page.waitForTimeout(900)

  log('6.6 custom mode hides the randomizer and the difficulty picker',
    await page.locator('#randomize-btn').count() === 0 && await page.locator('[data-difficulty="easy"]').count() === 0,
    `randomize=${await page.locator('#randomize-btn').count()} difficulty=${await page.locator('[data-difficulty="easy"]').count()}`)
  log('6.7 custom mode offers "New expression"',
    await page.locator('[data-tutorial="new-expression-btn"]').count() === 1)

  // The workspace must offer every applicable law — no layout filter may hide a
  // card. A(B + A') needs the complement-guarded Distributive (Expand) law.
  // A factor renders a capsule and its literal with the SAME data-path, so the
  // literal is the nested one. The player's path is literal A + clause (B + A').
  const litInside = (p) => page.locator(`[data-tutorial="canvas"] [data-path="${p}"] [data-path="${p}"]`).first()
  const nodeAt = (p) => page.locator(`[data-tutorial="canvas"] [data-path="${p}"]`).first()
  await litInside('R.0').click({ force: true })
  await page.waitForTimeout(250)
  await nodeAt('R.1').click({ force: true })
  await page.waitForTimeout(500)
  const offered = await page.evaluate(() =>
    [...document.querySelectorAll('[data-tutorial^="law-card-"]')].map(el => el.getAttribute('data-law-id')))
  log('6.8 the Expand law is offered by the workspace for A(B + A\')',
    offered.some(id => /expand|distributive/.test(String(id))), `offered=${offered.join(',') || 'none'}`)

  if (offered.some(id => /expand|distributive/.test(String(id)))) {
    const idx = offered.findIndex(id => /expand|distributive/.test(String(id)))
    await page.locator('[data-tutorial^="law-card-"]').nth(idx).click()
    await page.waitForFunction(
      () => document.querySelectorAll('[data-tutorial^="step-history-card-"]').length >= 1,
      null,
      { timeout: 15000 },
    ).catch(() => {})
    const steps = await page.locator('[data-tutorial^="step-history-card-"]').count()
    log('6.9 the Expand law applies and records a step', steps >= 1, `stepCards=${steps}`)
  } else {
    log('6.9 the Expand law applies and records a step', false, 'no Expand card offered')
  }

  // Refresh keeps the same expression: history.state is stripped first so this
  // proves the sessionStorage fallback rather than route state surviving reload.
  await page.evaluate(() => window.history.replaceState({}, '', '/sandbox/play'))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await waitForWorkspace(page)
  const afterReload = norm(await page.locator('[data-tutorial="canvas"]').first().innerText())
  log('6.10 refreshing /sandbox/play keeps the custom expression',
    afterReload.includes("A(B + A')"), afterReload.slice(0, 100))

  log('6.11 sandbox play never POSTs a score',
    apiCalls.filter(c => c.includes('/api/score')).length === 0,
    apiCalls.filter(c => c.includes('/api/score')).join(', ') || 'none')

  await page.locator('[data-tutorial="new-expression-btn"]').first().click()
  await page.waitForTimeout(1200)
  log('6.12 "New expression" returns to the input screen', page.url().endsWith('/sandbox'), page.url())

  log('6.13 no uncaught page errors in the sandbox', errors.length === 0, errors.slice(0, 3).join(' | '))
  await ctx.close()
}

/* ── Summary ──────────────────────────────────────────────────────────── */
const failed = results.filter(r => !r.ok)
console.log(`\n=== SUMMARY === ${results.length - failed.length}/${results.length} passed`)
failed.forEach(f => console.log('  ❌ ' + f.name))
await browser.close()
process.exit(failed.length > 0 ? 1 : 0)
