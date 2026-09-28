/**
 * T7 — Workspace mobile UX verification (task-7).
 *
 * Verifies the two user asks plus the five measured mobile defects on the
 * puzzle/workspace screen:
 *
 *   (a) the easy/medium/hard difficulty picker is GONE and the 🎲 randomizer is
 *       kept and still swaps in a new problem
 *   (b) 1. the success popup fits a 390px / 320px tall landscape phone
 *       2. the reset-confirm modal and the laws reference fit too (the laws
 *          reference becomes a full-width sheet on narrow / short viewports)
 *       3. no header control is clipped at 844x390, every one is >= 44px tall
 *       4. the law strip is ONE rail whose first row is the applicable laws —
 *          reference laws live behind the Laws button/drawer
 *       5. a narrow NON-touch window (420x800) gets the compact layout, while
 *          1440x900 keeps the original three columns
 *       6. every tutorial/test hook still resolves
 *
 * Requires: vite dev server on 5173, FastAPI on 8000, e2e user to exist.
 * Run:  node .e2e/mobile-ux-verify.mjs
 */
import {
  launch, seededState, DEVICES, device, nav, reporter, foldReport, noHorizontalScroll, shot,
} from './_harness.mjs'

const { log, section, summary } = reporter('mobile-ux-verify')

const norm = (s) => String(s || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
const canvasText = (page) => page.locator('[data-tutorial="canvas"]').first().innerText()
const box = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return {
    w: Math.round(r.width), h: Math.round(r.height),
    top: Math.round(r.top), bottom: Math.round(r.bottom),
    left: Math.round(r.left), right: Math.round(r.right),
    vw: window.innerWidth, vh: window.innerHeight,
  }
}, sel)

/** Header controls that must never be clipped on a compact tier. */
const HEADER_CONTROLS = '[data-testid="step-history-toggle"], #randomize-btn, [data-tutorial="undo-button"], [data-tutorial="reset-button"], [data-tutorial="hint-button"], [data-tutorial="guide-button"], [data-tutorial="laws-reference-button"]'

/** Taps rendered nodes until a law becomes applicable (the real click path). */
async function selectUntilLawAppears(page, attempts = 30) {
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

/** Waits until the workspace tree is rendered (progress hydration + level fetch). */
async function waitForWorkspace(page, timeout = 20000) {
  await page.waitForSelector('[data-tutorial="canvas"] [data-path]', { timeout })
  await page.waitForTimeout(400)
}

/** The tutorial gate holds the screen while progress hydrates (2-6s here). */
async function gateCleared(page, timeout = 25000) {
  try {
    await page.waitForFunction(
      () => !document.body.innerText.includes('Loading your progress'),
      null, { timeout },
    )
    return true
  } catch {
    return false
  }
}

/**
 * Opens a route and waits for the real workspace on that exact URL. This
 * checkout is edited by other teammates while the suite runs (dev-server
 * reloads) and the tutorial gate needs a network round-trip before it lets a
 * learner through, so a single navigation is retried rather than reported as a
 * regression.
 */
async function openWorkspace(page, path, attempts = 4) {
  for (let i = 0; i < attempts; i++) {
    await nav(page, path).catch(() => {})
    await gateCleared(page)
    try {
      await waitForWorkspace(page, 15000)
      const landed = await page.evaluate(() => location.pathname)
      if (landed === path) return true
      console.log(`      ↻ retry: ${path} landed on ${landed}`)
    } catch {
      console.log(`      ↻ retry: workspace did not render on ${path}`)
    }
    await page.waitForTimeout(1500)
  }
  return false
}

/**
 * Solves the current workspace problem. The free sandbox Guide pre-selects the
 * terms of the next legal move, which makes this deterministic on a 320px-tall
 * screen where the expression is scrolled inside the canvas.
 */
async function solvePuzzle(page, maxRounds = 16) {
  const isSolved = async () => (await page.locator('text=Problem Simplified!').count()) > 0
    || (await page.locator('text=Stage Complete!').count()) > 0
  const cards = () => page.locator('[data-tutorial^="law-card-"]')
  const applyFirstLaw = async () => {
    if ((await cards().count()) === 0) return false
    await cards().first().click({ force: true })
    await page.waitForTimeout(1700)
    return true
  }
  const guideMove = async () => {
    const guide = page.locator('[data-tutorial="guide-button"]').first()
    if ((await page.locator('[data-tutorial="guide-button"]').count()) === 0) return false
    if (!(await guide.isEnabled().catch(() => false))) return false
    await guide.click({ force: true }).catch(() => {})
    await page.waitForTimeout(900)
    return applyFirstLaw()
  }
  for (let guard = 0; guard < maxRounds; guard++) {
    if (await isSolved()) return true
    if (await applyFirstLaw()) continue
    if (await guideMove()) continue
    if (await selectUntilLawAppears(page, 10)) continue
    // A generated POS problem can need a selection shape the explorer above
    // cannot discover; in the sandbox a fresh puzzle is always one tap away.
    const reroll = page.locator('#randomize-btn').first()
    if ((await page.locator('#randomize-btn').count()) > 0) {
      await reroll.click({ force: true }).catch(() => {})
      await page.waitForTimeout(1600)
      continue
    }
    return await isSolved()
  }
  return await isSolved()
}

const browser = await launch()
const state = await seededState(browser)

/* ══════════════════════════════════════════════════════════════════════════
   1 — Phone landscape 844x390: picker gone, randomizer works, header fits,
       law strip is a single applicable-laws rail
   ══════════════════════════════════════════════════════════════════════════ */
section('1. Phone landscape 844x390')
{
  const { ctx, page, errors } = await device(browser, DEVICES.phoneLandscape, state)
  const ready = await openWorkspace(page, '/sandbox/play')
  log('1.0 the sandbox workspace renders at 844x390', ready)
  await page.waitForTimeout(600)

  const difficulty = await page.locator('[data-difficulty]').count()
  log('1.1 the easy/medium/hard difficulty picker is gone', difficulty === 0, `[data-difficulty] nodes=${difficulty}`)

  const subtitle = norm(await page.locator('main').first().innerText()).slice(0, 80)
  const subtitleNode = norm(await page.evaluate(() =>
    document.querySelector('[data-tutorial="canvas"]')?.closest('main')?.querySelector('div.text-\\[15px\\]')?.parentElement?.innerText || ''))
  log('1.2 the sandbox subtitle no longer implies a difficulty setting',
    /Random practice/i.test(subtitleNode) && !/\b(easy|medium|hard)\b/i.test(subtitleNode),
    `subtitle="${subtitleNode}"`)

  const randomize = page.locator('#randomize-btn')
  log('1.3 the randomizer is present in the header', await randomize.count() === 1, `nodes=${await randomize.count()}`)
  const exprBefore = norm(await canvasText(page))
  await randomize.first().click({ force: true })
  await page.waitForTimeout(1800)
  const exprAfter = norm(await canvasText(page))
  log('1.4 the randomizer still swaps in a new problem', exprBefore.length > 0 && exprAfter !== exprBefore,
    `"${exprBefore.slice(0, 36)}" -> "${exprAfter.slice(0, 36)}"`)

  // ── Defect 3: header controls ──
  const header = await foldReport(page, HEADER_CONTROLS)
  const clipped = header.items.filter(i => !i.inWidth)
  const short = header.items.filter(i => i.h < 44)
  log('1.5 every header control is fully inside the viewport', header.count >= 6 && clipped.length === 0,
    `n=${header.count} clipped=${JSON.stringify(clipped)}`)
  log('1.6 every header control is >= 44px tall', short.length === 0,
    short.length === 0 ? `n=${header.count} minH=${Math.min(...header.items.map(i => i.h))}` : JSON.stringify(short))
  const hscroll1 = await noHorizontalScroll(page)
  log('1.7 no horizontal page scroll at 844x390', hscroll1.ok, `scrollWidth=${hscroll1.scrollWidth} innerWidth=${hscroll1.innerWidth}`)

  await shot(page, 'workspace-after-844x390-puzzle')

  // ── Defect 4: the law strip ──
  const selection = await selectUntilLawAppears(page)
  const strip = await page.evaluate(() => {
    const list = document.querySelector('[data-testid="laws-list"]')
    if (!list) return null
    const kids = [...list.children]
    const rects = kids.map(el => el.getBoundingClientRect())
    const dock = document.querySelector('[data-tutorial="laws-dock"]')
    return {
      layout: list.getAttribute('data-layout'),
      overflowX: getComputedStyle(list).overflowX,
      firstChildIsLaw: kids.length > 0 && (kids[0].getAttribute('data-tutorial') || '').startsWith('law-card-'),
      lawCards: list.querySelectorAll('[data-tutorial^="law-card-"]').length,
      refChipsInStrip: list.querySelectorAll('[data-testid="law-ref-chip"]').length,
      refChipsInDock: dock ? dock.querySelectorAll('[data-testid="law-ref-chip"]').length : 0,
      singleRow: new Set(rects.map(r => Math.round(r.top))).size <= 1,
      railH: Math.round(list.getBoundingClientRect().height),
      dockTop: dock ? Math.round(dock.getBoundingClientRect().top) : null,
      vh: window.innerHeight,
    }
  })
  log('1.8 applicable laws are rendered first in a single-row rail',
    Boolean(strip) && strip.layout === 'strip' && strip.lawCards > 0 && strip.firstChildIsLaw
      && strip.singleRow && strip.railH >= 44,
    `selection=${selection} ${JSON.stringify(strip)}`)
  log('1.9 reference-law chips no longer crowd the strip (they live behind the Laws button)',
    Boolean(strip) && strip.refChipsInStrip === 0 && strip.refChipsInDock === 0,
    `inStrip=${strip?.refChipsInStrip} inDock=${strip?.refChipsInDock}`)
  log('1.10 the law rail is the bottom strip of the compact layout',
    Boolean(strip) && strip.overflowX === 'auto' && strip.dockTop > strip.vh * 0.5,
    `overflowX=${strip?.overflowX} dockTop=${strip?.dockTop} vh=${strip?.vh}`)

  // ── Defect 2: the laws reference becomes a full-width sheet ──
  await page.locator('[data-tutorial="laws-reference-button"]').first().click({ force: true })
  await page.waitForTimeout(700)
  const sheet = await box(page, '[data-testid="laws-sheet"]')
  const closeBtn = await box(page, '[data-testid="laws-close"]')
  log('1.11 the laws reference is a full-width sheet on a landscape phone',
    Boolean(sheet) && Math.abs(sheet.left) <= 1 && Math.abs(sheet.right - sheet.vw) <= 1
      && sheet.bottom <= sheet.vh + 1 && sheet.h >= sheet.vh * 0.5,
    `panel=${JSON.stringify(sheet)}`)
  log('1.12 the sheet close button is reachable and >= 44x44',
    Boolean(closeBtn) && closeBtn.w >= 44 && closeBtn.h >= 44 && closeBtn.bottom <= closeBtn.vh + 1,
    `close=${JSON.stringify(closeBtn)}`)
  await shot(page, 'workspace-after-844x390-laws-sheet')
  await page.locator('[data-testid="laws-close"]').click({ force: true })
  const sheetClosed = await page.waitForSelector('[data-testid="laws-sheet"]', { state: 'detached', timeout: 6000 })
    .then(() => true).catch(() => false)
  log('1.13 the sheet closes again', sheetClosed)

  log('1.14 no uncaught page errors at 844x390', errors.length === 0, errors.slice(0, 3).join(' | '))
  await ctx.close()
}

/* ══════════════════════════════════════════════════════════════════════════
   2 — Success popup: the sandbox variant at 844x390 (acceptance parity) plus
       the graded variant — the exact screen behind phone-L__success-modal.png,
       whose metric rows ran off the bottom — at 844x390 and 568x320
   ══════════════════════════════════════════════════════════════════════════ */

/** Measures the popup panel plus every button inside it against the fold. */
async function measureModal(page) {
  return page.evaluate(() => {
    const panel = document.querySelector('[data-tutorial="score-modal"]')
    if (!panel) return null
    const r = panel.getBoundingClientRect()
    const vh = window.innerHeight
    const vw = window.innerWidth
    const rows = [...panel.querySelectorAll('button')].map(b => {
      const br = b.getBoundingClientRect()
      return {
        label: (b.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 22),
        h: Math.round(br.height),
        bottom: Math.round(br.bottom),
        right: Math.round(br.right),
        inFold: br.height > 0 && br.bottom <= vh + 1 && br.top >= -1,
        inWidth: br.width > 0 && br.right <= vw + 1,
      }
    })
    const body = panel.querySelector('[data-testid="score-modal-body"]')
    return {
      vw,
      vh,
      panelTop: Math.round(r.top), panelBottom: Math.round(r.bottom), panelH: Math.round(r.height),
      panelMaxH: getComputedStyle(panel).maxHeight,
      overflowY: getComputedStyle(panel).overflowY,
      // The panel keeps a fixed action row; the metrics live in a body that
      // scrolls on its own when the viewport is shorter than the content.
      scrollable: body ? body.scrollHeight > body.clientHeight + 1 : panel.scrollHeight > panel.clientHeight + 1,
      bodyScrollH: body ? body.scrollHeight : null,
      bodyClientH: body ? body.clientHeight : null,
      buttons: rows,
    }
  })
}

const MODAL_CASES = [
  { label: 'sandbox @844x390', preset: DEVICES.phoneLandscape, path: '/sandbox/play', shot: 'workspace-after-844x390-sandbox-success-modal' },
  { label: 'graded @844x390', preset: DEVICES.phoneLandscape, path: '/level/1/stage/0', shot: 'workspace-after-844x390-success-modal' },
  { label: 'graded @568x320', preset: DEVICES.phoneLandscapeTiny, path: '/level/1/stage/0', shot: 'workspace-after-568x320-success-modal' },
]

for (const modalCase of MODAL_CASES) {
  section(`2. Success popup ${modalCase.label}`)
  const { ctx, page, errors } = await device(browser, modalCase.preset, state)
  const ready = await openWorkspace(page, modalCase.path)
  if (!ready) log(`2.0 the workspace renders ${modalCase.label}`, false)
  await page.waitForTimeout(400)
  const solved = await solvePuzzle(page)
  const modal = await page.locator('[data-tutorial="score-modal"]').count()
  log(`2.1 the success popup opens ${modalCase.label}`, solved && modal > 0, `solved=${solved} modalNodes=${modal}`)

  const m = await measureModal(page)
  const primary = m?.buttons?.[0]
  log(`2.2 the panel never exceeds the viewport ${modalCase.label}`,
    Boolean(m) && m.panelTop >= -1 && m.panelBottom <= m.vh + 1,
    `panel=${JSON.stringify({ top: m?.panelTop, bottom: m?.panelBottom, h: m?.panelH, maxH: m?.panelMaxH, overflowY: m?.overflowY, bodyScrolls: m?.scrollable, body: `${m?.bodyClientH}/${m?.bodyScrollH}`, vh: m?.vh })}`)
  log(`2.3 the primary popup button is inside the viewport ${modalCase.label}`,
    Boolean(primary) && primary.inFold && primary.inWidth,
    `primary=${JSON.stringify(primary)}`)
  log(`2.4 every popup button is inside the viewport ${modalCase.label}`,
    Boolean(m) && m.buttons.length > 0 && m.buttons.every(b => b.inFold && b.inWidth),
    JSON.stringify(m?.buttons))
  await shot(page, modalCase.shot)
  log(`2.5 no uncaught page errors ${modalCase.label}`, errors.length === 0, errors.slice(0, 3).join(' | '))
  await ctx.close()
}

/* ══════════════════════════════════════════════════════════════════════════
   3 — Reset-confirm modal fits a landscape phone
   ══════════════════════════════════════════════════════════════════════════ */
section('3. Reset confirmation @844x390')
{
  const { ctx, page, errors } = await device(browser, DEVICES.phoneLandscape, state)
  const ready = await openWorkspace(page, '/level/1/stage/0')
  if (!ready) log('3.0 the graded workspace renders', false)
  await page.waitForTimeout(400)
  const solvedForReset = await solvePuzzle(page)
  log('3.0b the problem was solved so the reset prompt can appear', solvedForReset)
  await page.locator('text=Review Completed Derivation').first().click({ force: true }).catch(() => {})
  await page.waitForTimeout(400)
  await page.locator('[data-tutorial="reset-button"]').first().click({ force: true })
  await page.waitForTimeout(500)
  const modal = await page.evaluate(() => {
    const heading = [...document.querySelectorAll('h3')].find(h => /reset this/i.test(h.textContent))
    if (!heading) return null
    const panel = heading.closest('.praxis-modal-panel') || heading.closest('div[class*="rounded-2xl"]')
    const r = panel.getBoundingClientRect()
    const vh = window.innerHeight
    const buttons = [...panel.querySelectorAll('button')].map(b => {
      const br = b.getBoundingClientRect()
      return { label: b.innerText.trim().slice(0, 14), h: Math.round(br.height), bottom: Math.round(br.bottom), inFold: br.bottom <= vh + 1 }
    })
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh, buttons }
  })
  log('3.1 the reset-confirm modal fits the 390px viewport',
    Boolean(modal) && modal.top >= -1 && modal.bottom <= modal.vh + 1, JSON.stringify(modal && { top: modal.top, bottom: modal.bottom, vh: modal.vh }))
  log('3.2 both reset buttons are reachable without scrolling',
    Boolean(modal) && modal.buttons.length === 2 && modal.buttons.every(b => b.inFold && b.h >= 30),
    JSON.stringify(modal?.buttons))
  log('3.3 no uncaught page errors on the reset modal', errors.length === 0, errors.slice(0, 3).join(' | '))
  await ctx.close()
}

/* ══════════════════════════════════════════════════════════════════════════
   4 — Narrow NON-touch window 420x800 gets the compact layout
   ══════════════════════════════════════════════════════════════════════════ */
section('4. Narrow non-touch window 420x800')
{
  const { ctx, page, errors } = await device(browser, DEVICES.narrowDesktop, state)
  const ready = await openWorkspace(page, '/level/1/stage/0')
  if (!ready) log('4.0 the graded workspace renders at 420x800', false)
  await page.waitForTimeout(800)
  const layout = await page.evaluate(() => {
    const boxOf = (s) => {
      const el = document.querySelector(s)
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { w: Math.round(r.width), h: Math.round(r.height), left: Math.round(r.left), right: Math.round(r.right) }
    }
    const list = document.querySelector('[data-testid="laws-list"]')
    const panel = document.querySelector('[data-tutorial="step-history-panel"]')
    return {
      vw: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      drawerToggle: document.querySelectorAll('[data-testid="step-history-toggle"]').length,
      historyPanelW: panel ? Math.round(panel.getBoundingClientRect().width) : -1,
      rightPanelNodes: document.querySelectorAll('[data-tutorial="points-and-assistance"]').length,
      canvas: boxOf('[data-tutorial="canvas"]'),
      dock: boxOf('[data-tutorial="laws-dock"]'),
      lawsLayout: list ? list.getAttribute('data-layout') : null,
      headerRail: boxOf('[data-testid="header-control-rail"]'),
      railScrolls: (() => {
        const rail = document.querySelector('[data-testid="header-control-rail"]')
        return rail ? { overflowX: getComputedStyle(rail).overflowX, scrollW: rail.scrollWidth, clientW: rail.clientWidth } : null
      })(),
    }
  })
  log('4.1 a 420px non-touch window uses the compact drawer layout',
    layout.drawerToggle === 1 && layout.historyPanelW === 0 && layout.rightPanelNodes === 0,
    `drawerToggle=${layout.drawerToggle} historyPanelW=${layout.historyPanelW} rightPanelNodes=${layout.rightPanelNodes}`)
  log('4.2 the canvas and the laws dock fit inside the 420px window',
    Boolean(layout.canvas && layout.dock) && layout.canvas.w > 40 && layout.canvas.right <= layout.vw + 1
      && layout.dock.right <= layout.vw + 1,
    JSON.stringify({ canvas: layout.canvas, dock: layout.dock, vw: layout.vw }))
  log('4.3 the laws are the bottom strip and nothing scrolls the page sideways',
    layout.lawsLayout === 'strip' && layout.scrollWidth <= layout.vw + 1,
    `lawsLayout=${layout.lawsLayout} scrollWidth=${layout.scrollWidth} vw=${layout.vw}`)
  log('4.4 the header controls sit in a scroll rail instead of being clipped',
    Boolean(layout.headerRail) && layout.headerRail.right <= layout.vw + 1 && layout.railScrolls?.overflowX === 'auto',
    JSON.stringify({ rail: layout.headerRail, railScrolls: layout.railScrolls }))
  const header420 = await foldReport(page, HEADER_CONTROLS)
  // Scrolling the rail all the way right must bring every control fully into
  // the window — that is what "not clipped" means for an overflow row.
  const railReach = await page.evaluate(async () => {
    const rail = document.querySelector('[data-testid="header-control-rail"]')
    if (!rail) return null
    rail.scrollLeft = rail.scrollWidth
    await new Promise(r => requestAnimationFrame(r))
    const vw = window.innerWidth
    const items = [...rail.querySelectorAll('button')].map(b => {
      const r = b.getBoundingClientRect()
      return { label: (b.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 12), right: Math.round(r.right), inWidth: r.right <= vw + 1 }
    })
    rail.scrollLeft = 0
    return { vw, items }
  })
  log('4.5 every header control can be scrolled fully into the window',
    header420.count >= 6 && Boolean(railReach)
      && railReach.items.every(i => i.inWidth)
      && header420.items.filter(i => i.inWidth).length >= 4,
    `n=${header420.count} railItems=${JSON.stringify(railReach?.items)}`)
  await shot(page, 'workspace-after-420x800-puzzle')
  log('4.6 no uncaught page errors at 420x800', errors.length === 0, errors.slice(0, 3).join(' | '))
  await ctx.close()
}

/* ══════════════════════════════════════════════════════════════════════════
   5 — Desktop 1440x900 is still the untouched three-column workspace, and the
       sandbox right panel keeps ONE randomizer with no difficulty picker
   ══════════════════════════════════════════════════════════════════════════ */
section('5. Desktop 1440x900 (no touch)')
{
  const { ctx, page, errors } = await device(browser, DEVICES.desktop, state)
  const ready = await openWorkspace(page, '/level/1/stage/0')
  if (!ready) log('5.0 the graded workspace renders on desktop', false)
  await page.waitForTimeout(800)
  // Select a term first: the desktop law list is a wrapped block that only
  // exists once something is applicable.
  const deskSelection = await selectUntilLawAppears(page)
  const desk = await page.evaluate(() => {
    const left = (s) => { const el = document.querySelector(s); return el ? Math.round(el.getBoundingClientRect().left) : null }
    const rect = (s) => { const el = document.querySelector(s); if (!el) return null; const r = el.getBoundingClientRect(); return { left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom) } }
    const list = document.querySelector('[data-testid="laws-list"]')
    return {
      history: rect('[data-tutorial="step-history-panel"]'),
      canvas: rect('[data-tutorial="canvas"]'),
      right: rect('[data-tutorial="points-and-assistance"]'),
      dock: rect('[data-tutorial="laws-dock"]'),
      lawsLayout: list ? list.getAttribute('data-layout') : null,
      zoomIn: document.querySelectorAll('button[title="Zoom in"]').length,
      drawerToggle: document.querySelectorAll('[data-testid="step-history-toggle"]').length,
      headerRail: document.querySelectorAll('[data-testid="header-control-rail"]').length,
      literalFont: parseFloat(getComputedStyle(document.querySelector('[data-tutorial="canvas"] [data-path]')).fontSize),
      headerFont: parseFloat(getComputedStyle(document.querySelector('[data-tutorial="hint-button"]')).fontSize),
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      left,
    }
  })
  log('5.1 desktop keeps the original three-column order (history, canvas, right panel)',
    Boolean(desk.history && desk.canvas && desk.right && desk.dock)
      && desk.history.left < desk.canvas.left && desk.canvas.left < desk.right.left
      && desk.dock.top >= desk.canvas.bottom - 1,
    JSON.stringify({ history: desk.history?.left, canvas: desk.canvas?.left, right: desk.right?.left, dockTop: desk.dock?.top, canvasBottom: desk.canvas?.bottom }))
  log('5.2 desktop chrome is untouched (inline zoom + tutorial toggle, no rail/drawer)',
    desk.zoomIn === 1 && desk.drawerToggle === 0 && desk.headerRail === 0,
    `zoomIn=${desk.zoomIn} drawerToggle=${desk.drawerToggle} headerRail=${desk.headerRail}`)
  log('5.3 desktop keeps its original type scale and law wrap layout',
    desk.literalFont === 22 && desk.headerFont <= 12 && desk.lawsLayout === 'wrap',
    `literal=${desk.literalFont}px header=${desk.headerFont}px lawsLayout=${desk.lawsLayout} selection=${deskSelection}`)
  log('5.4 desktop has no horizontal page scroll', desk.scrollWidth <= desk.innerWidth + 1,
    `innerWidth=${desk.innerWidth} scrollWidth=${desk.scrollWidth}`)

  // Tutorial hooks that must resolve on the graded workspace.
  const gradedHooks = await page.evaluate(() => {
    const present = (s) => document.querySelectorAll(s).length
    return {
      hooks: {
        canvas: present('[data-tutorial="canvas"]'),
        'active-equation': present('[data-tutorial="active-equation"]'),
        'assistance-group': present('[data-tutorial="assistance-group"]'),
        'hint-button': present('[data-tutorial="hint-button"]'),
        'guide-button': present('[data-tutorial="guide-button"]'),
        'laws-reference-button': present('[data-tutorial="laws-reference-button"]'),
        'laws-dock': present('[data-tutorial="laws-dock"]'),
        'step-history-panel': present('[data-tutorial="step-history-panel"]'),
        'undo-reset-group': present('[data-tutorial="undo-reset-group"]'),
        'undo-button': present('[data-tutorial="undo-button"]'),
        'reset-button': present('[data-tutorial="reset-button"]'),
        'points-card': present('[data-tutorial="points-card"]'),
        'points-and-assistance': present('[data-tutorial="points-and-assistance"]'),
      },
      pathCount: present('[data-tutorial="canvas"] [data-path]'),
    }
  })
  const missing = Object.entries(gradedHooks.hooks).filter(([, n]) => n === 0).map(([k]) => k)
  log('5.5 every tutorial hook still resolves on the graded workspace', missing.length === 0 && gradedHooks.pathCount > 0,
    `missing=${JSON.stringify(missing)} paths=${gradedHooks.pathCount}`)

  // Solve it so the completion hooks exist too.
  const solved = await solvePuzzle(page, 6)
  await page.waitForTimeout(600)
  const doneHooks = await page.evaluate(() => ({
    'score-modal': document.querySelectorAll('[data-tutorial="score-modal"]').length,
    'review-derivation-btn': document.querySelectorAll('[data-tutorial="review-derivation-btn"]').length,
    'reopen-score-btn': document.querySelectorAll('[data-tutorial="reopen-score-btn"]').length,
    'next-stage-btn': document.querySelectorAll('[data-tutorial="next-stage-btn"]').length,
    'step-history-card-0': document.querySelectorAll('[data-tutorial^="step-history-card-"]').length,
  }))
  const missingDone = Object.entries(doneHooks).filter(([, n]) => n === 0).map(([k]) => k)
  log('5.6 the completion hooks still resolve after solving', solved && missingDone.length === 0,
    `solved=${solved} missing=${JSON.stringify(missingDone)} ${JSON.stringify(doneHooks)}`)

  // Sandbox right panel: picker gone, exactly one randomizer.
  const sandboxReady = await openWorkspace(page, '/sandbox/play')
  if (!sandboxReady) log('5.7 the sandbox workspace renders on desktop', false)
  await page.waitForTimeout(400)
  const sandbox = await page.evaluate(() => ({
    difficulty: document.querySelectorAll('[data-difficulty]').length,
    newRandomProblem: [...document.querySelectorAll('button')].filter(b => b.innerText.includes('New Random Problem')).length,
    headerRandomize: document.querySelectorAll('#randomize-btn').length,
    subtitle: document.querySelector('[data-tutorial="canvas"]')?.closest('main')?.innerText.split('\n').slice(0, 3).join(' | '),
    refChips: document.querySelectorAll('[data-testid="law-ref-chip"]').length,
  }))
  log('5.7 the sandbox right panel keeps exactly one randomizer and no picker',
    sandbox.difficulty === 0 && sandbox.newRandomProblem === 1 && sandbox.headerRandomize === 1,
    JSON.stringify(sandbox))
  log('5.8 the sandbox subtitle is neutral about difficulty',
    /Random practice/i.test(sandbox.subtitle || '') && !/\b(easy|medium|hard)\b/i.test(sandbox.subtitle || ''),
    `"${(sandbox.subtitle || '').slice(0, 60)}"`)
  await shot(page, 'workspace-after-desktop-1440x900-sandbox')
  log('5.9 no uncaught page errors on desktop', errors.length === 0, errors.slice(0, 3).join(' | '))
  await ctx.close()
}

await browser.close()
const failed = summary()
process.exit(failed === 0 ? 0 : 1)
