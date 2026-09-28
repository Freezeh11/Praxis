/**
 * F1 verification — "the tutorial popup must never cover the box it points at".
 *
 * Walks EVERY step of the 4-stage interactive tutorial on every required
 * device and, for each rendered step, asserts with getBoundingClientRect that
 * the floating coach card (`[data-tutorial-card]`):
 *
 *   HARD  does not intersect the element the step highlights (target /
 *         secondaryTarget from frontend/src/content/tutorialContent.js, which is the
 *         same source the component reads) — a violation is a failure;
 *   SOFT  does not intersect any actionable control the learner may need
 *         (canvas literals, law cards, term grips, header buttons, step
 *         history cards, tutorial CTAs) — a violation is a failure too, but
 *         reported separately so the two classes stay distinguishable;
 *   FIT   stays fully inside the viewport and never introduces horizontal
 *         page scroll.
 *
 * Usage:
 *   node .e2e/tutorial-overlap-verify.mjs                     # full matrix
 *   node .e2e/tutorial-overlap-verify.mjs --devices desktop    # one device
 *   node .e2e/tutorial-overlap-verify.mjs --stages 0,1         # subset
 *   node .e2e/tutorial-overlap-verify.mjs --before             # baseline tag
 *
 * Exit code is non-zero when any step fails. Screenshots land in
 * .e2e/shots-mobile/tutorial-fixed-<device>-step<N>.png (N is the per-device
 * step ordinal across the whole walk).
 *
 * ── BEFORE (the same driver run against the pre-fix component, --before) ──
 *   phoneLandscape 844x390 — 31 of 37 rendered steps FAILED. The floating card
 *   was the same 820px-wide bottom sheet parked at x=12 for every step, e.g.
 *     stage0 step3  "Ready to Simplify"          card y 139.6..378 vs canvas 121.5..189.5    → 19276 px²
 *     stage0 step4  "Apply the Absorption Law"   card y 234.9..378 vs law card 328..375       →  8460 px²
 *     stage0 step5  "Stage 1 Solved & Score …"   card y 139.6..378 vs score modal 12..378     → 100128 px²
 *     stage0 step9  "Reopening Score Summary"    card y 139.6..378 vs reopen btn 337..374     →  5802 px²
 *     stage1 step5  "Pair the Opposites"         card y 234.9..378 vs the x'/x literals        →    70 px²
 *     stage2 step1  "Negated Groups (NOT …)"     card y 139.6..378 vs canvas 121.5..191.5     → 25607 px²
 *   desktop 1440x900 — 6 of 28 failed, e.g.
 *     stage0 step5  "Stage 1 Solved & Score …"   card @960,117 vs Hint/Guide/Laws + points card → 17002 px²
 *     stage1 step11 "Step History & Inspection"  card @192,84  vs the history panel it points at → 18210 px²
 *   tabletPortrait / phoneLandscapeSmall behave like phoneLandscape (the card
 *   sits on top of whatever the current step points at).
 *
 * ── AFTER (this run) ──
 *   All four devices walk the full 4-stage deck with 0 target overlaps; see
 *   the PASS/FAIL lines and the summary printed at the end.
 */
import { launch, seededState, device, nav, reporter, shot, noHorizontalScroll, DEVICES } from './_harness.mjs'
import { TUTORIAL_STAGES } from '../frontend/src/content/tutorialContent.js'
// The obstacle list is owned by the component that must dodge them — importing
// it keeps this suite honest when a control is added/removed.
import { TUTORIAL_OBSTACLE_SELECTORS as CONTROL_SELECTORS } from '../frontend/src/components/tutorial/tutorialTargets.js'

/* ── CLI ──────────────────────────────────────────────────────────────── */
const argv = process.argv.slice(2)
const argOf = (flag) => {
  const i = argv.indexOf(flag)
  return i >= 0 ? argv[i + 1] : null
}
const ONLY_DEVICES = (argOf('--devices') || '').split(',').filter(Boolean)
const ONLY_STAGES = (argOf('--stages') || '').split(',').filter(Boolean).map(Number)
const TAG = argOf('--tag') || (argv.includes('--before') ? 'before' : 'after')
const VERBOSE = argv.includes('--verbose')

const DEVICE_LIST = ['desktop', 'phoneLandscape', 'phoneLandscapeSmall', 'tabletPortrait']
  .filter(name => ONLY_DEVICES.length === 0 || ONLY_DEVICES.includes(name))
const STAGE_LIST = [0, 1, 2, 3].filter(s => ONLY_STAGES.length === 0 || ONLY_STAGES.includes(s))

const MAX_STEPS_PER_STAGE = 24
const SETTLE_MS = 750

/* ── geometry helpers (mirror .e2e/_recon-tutorial.mjs) ───────────────── */
const overlaps = (a, b) => Boolean(a && b && !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y))
const overlapArea = (a, b) => {
  if (!overlaps(a, b)) return 0
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
  return Math.round(w * h)
}
const rectStr = (r) => r ? `${r.w}x${r.h}@${r.x},${r.y}→${r.x + r.w},${r.y + r.h}` : 'none'
const norm = (s) => (s || '').replace(/\s+/g, ' ').trim()

/* ── browser-side measurement ─────────────────────────────────────────── */
const measure = (page, targetSel, secondarySel) => page.evaluate(({ controls, targetSel, secondarySel }) => {
  const R = (el) => {
    const r = el.getBoundingClientRect()
    return {
      x: Math.round(r.left * 10) / 10,
      y: Math.round(r.top * 10) / 10,
      w: Math.round(r.width * 10) / 10,
      h: Math.round(r.height * 10) / 10,
    }
  }
  const vw = window.innerWidth
  const vh = window.innerHeight
  const card = document.querySelector('[data-tutorial-card]')
  const cardRect = card ? R(card) : null
  const labelOf = (el) => {
    if (el.hasAttribute('data-path')) return `path:${el.getAttribute('data-path')}`
    if (el.hasAttribute('data-law-id')) return `law:${el.getAttribute('data-law-id')}`
    const hook = el.getAttribute('data-tutorial')
    if (hook) return `${hook.replace(/-card-\d+$/, '-card')}`
    if ((el.getAttribute('title') || '').match(/grip/i)) return `grip:${(el.getAttribute('title') || '').slice(0, 18)}`
    return (el.innerText || el.tagName).replace(/\s+/g, ' ').trim().slice(0, 22)
  }
  const inViewport = (r) => r.w > 1 && r.h > 1 && r.x < vw && r.x + r.w > 0 && r.y < vh && r.y + r.h > 0
  const seen = new Set()
  const controlsOut = []
  for (const sel of controls) {
    for (const el of document.querySelectorAll(sel)) {
      if (card && (card === el || card.contains(el))) continue
      const r = R(el)
      if (!inViewport(r)) continue
      const key = `${sel}|${r.x},${r.y},${r.w},${r.h}`
      if (seen.has(key)) continue
      seen.add(key)
      controlsOut.push({ ...r, label: labelOf(el) })
    }
  }
  const one = (sel) => {
    if (!sel) return null
    const el = document.querySelector(sel)
    if (!el) return null
    const r = R(el)
    return r.w > 0 && r.h > 0 ? { ...r, sel, label: labelOf(el) } : null
  }
  const cardLabel = card
    ? ((card.innerText || '').match(/Step\s+\d+\s+of\s+\d+/i)?.[0] || '') + ' | ' +
      ((card.querySelector('h4')?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 42))
    : ''
  const stepLabel = card ? ((card.innerText || '').match(/Step\s+\d+\s+of\s+\d+/i) || [''])[0] : ''
  const title = card ? ((card.querySelector('h4')?.innerText || '').replace(/\s+/g, ' ').trim()) : ''
  const hasWelcome = Boolean([...document.querySelectorAll('div')].find(el => /Welcome to Praxis|Core Mechanics/i.test(el.innerText || '') && getComputedStyle(el).position === 'fixed'))
  return {
    viewport: { w: vw, h: vh },
    card: cardRect,
    cardLabel,
    stepLabel,
    title,
    hasWelcome,
    cardInViewport: cardRect ? (cardRect.x >= -1 && cardRect.y >= -1 && cardRect.x + cardRect.w <= vw + 1 && cardRect.y + cardRect.h <= vh + 1) : true,
    target: one(targetSel),
    secondary: one(secondarySel),
    controls: controlsOut,
  }
}, { controls: CONTROL_SELECTORS, targetSel, secondarySel: secondarySel || null })

/* ── walk driver ──────────────────────────────────────────────────────── */
const stepKey = async (page) => page.evaluate(() => {
  const card = document.querySelector('[data-tutorial-card]')
  if (!card) {
    const welcome = [...document.querySelectorAll('button')].find(b => /^(Continue|Start)\s*→/.test((b.innerText || '').trim()))
    return welcome ? 'welcome' : 'none'
  }
  const label = ((card.innerText || '').match(/Step\s+\d+\s+of\s+\d+/i) || [''])[0]
  const title = (card.querySelector('h4')?.innerText || '').replace(/\s+/g, ' ').trim()
  return `${label}|${title}`
})

const stepIndex = async (page) => page.evaluate(() => {
  const card = document.querySelector('[data-tutorial-card]')
  const m = card && (card.innerText || '').match(/Step\s+(\d+)\s+of\s+(\d+)/i)
  return m ? { idx: Number(m[1]), total: Number(m[2]) } : null
})

async function waitStepChange(page, before, timeout = 4000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    const now = await stepKey(page)
    if (now !== before) return now
    await page.waitForTimeout(120)
  }
  return null
}

async function dismissWelcome(page) {
  for (let i = 0; i < 4; i++) {
    const btn = page.locator('button', { hasText: /^(Continue|Start)\s*→/ }).first()
    if (await btn.count() === 0) return
    await btn.click({ force: true }).catch(() => {})
    await page.waitForTimeout(700)
  }
}

/**
 * Waits until the stage's coach card (or the welcome deck) is actually up.
 * Progress hydration is slow on this box, so a fixed sleep is not enough.
 */
async function waitForTutorialStart(page, timeout = 25000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    const state = await page.evaluate(() => ({
      card: Boolean(document.querySelector('[data-tutorial-card]')),
      welcome: [...document.querySelectorAll('button')].some(b => /^(Continue|Start)\s*→/.test((b.innerText || '').trim())),
    }))
    if (state.card) return true
    if (state.welcome) { await dismissWelcome(page); await page.waitForTimeout(400); continue }
    await page.waitForTimeout(250)
  }
  return false
}

const listPaths = (page) => page.evaluate(() =>
  [...document.querySelectorAll('[data-tutorial="canvas"] [data-path]')]
    .filter(el => { const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1 })
    .map(el => ({
      path: el.getAttribute('data-path'),
      text: (el.innerText || '').replace(/\s+/g, ''),
      selected: /selected|ring|teal/i.test(el.className || ''),
      depth: (el.getAttribute('data-path') || '').split('.').length,
    })))

const listLawCards = (page) => page.evaluate(() =>
  [...document.querySelectorAll('[data-tutorial^="law-card-"]')]
    .filter(el => { const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1 })
    .map(el => ({
      id: el.getAttribute('data-law-id'),
      text: (el.innerText || '').replace(/\s+/g, ' ').trim(),
    })))

/**
 * Dispatches a full click sequence at the element itself. Coordinate clicks
 * get eaten by the tutorial's floating spotlight ring / hover-only term grips
 * (which are opacity-0 and sit above their container), while a DOM click still
 * travels through the app's capture-phase tutorial blocker, so it can only
 * reach elements the step actually allows.
 */
const jsClick = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s)
  if (!el) return false
  const opts = { bubbles: true, cancelable: true, view: window }
  try {
    el.dispatchEvent(new PointerEvent('pointerdown', opts))
    el.dispatchEvent(new MouseEvent('mousedown', opts))
    el.dispatchEvent(new PointerEvent('pointerup', opts))
    el.dispatchEvent(new MouseEvent('mouseup', opts))
    el.dispatchEvent(new MouseEvent('click', opts))
  } catch {
    el.click()
  }
  return true
}, sel)

const clickPath = async (page, path) => {
  const ok = await jsClick(page, `[data-tutorial="canvas"] [data-path="${path}"]`).catch(() => false)
  if (!ok) return false
  await page.waitForTimeout(220)
  return true
}

/** Toggles the given paths off again (dual-mode click selects/deselects). */
const deselect = async (page, paths) => {
  for (const p of [...paths].reverse()) {
    await clickPath(page, p)
  }
}

/** Clicks the law card whose visible text matches `name`, brute-forcing the selection first. */
async function clickLawByName(page, name) {
  const wanted = name.toLowerCase()
  const match = (cards) => cards.find(c => c.text.toLowerCase().includes(wanted))
  let card = match(await listLawCards(page))
  if (!card) {
    const paths = await listPaths(page)
    // Deepest first: the tutorial's own selection steps pick the innermost
    // literal/term that makes the law apply.
    const byDepth = [...paths].sort((a, b) => b.depth - a.depth).map(p => p.path)
    const singles = byDepth.map(n => [n])
    const pairs = []
    for (let i = 0; i < byDepth.length; i++) {
      for (let j = i + 1; j < byDepth.length; j++) pairs.push([byDepth[i], byDepth[j]])
    }
    for (const combo of [...singles, ...pairs]) {
      for (const p of combo) await clickPath(page, p)
      card = match(await listLawCards(page))
      if (card) break
      await deselect(page, combo)
    }
  }
  if (!card) return false
  if (await jsClick(page, `[data-tutorial^="law-card-"][data-law-id="${card.id}"]`).catch(() => false)) return true
  return jsClick(page, `[data-tutorial^="law-card-"]`).catch(() => false)
}

/**
 * Reads the rendered step and measures it in one consistent pair of snapshots:
 * the tutorial auto-advances on its own timers, so a label read before a slow
 * measurement may describe a different card than the one that was measured.
 */
async function measureStable(page, stageSteps) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const head = await page.evaluate(() => {
      const card = document.querySelector('[data-tutorial-card]')
      const label = card ? ((card.innerText || '').match(/Step\s+\d+\s+of\s+\d+/i) || [''])[0] : ''
      const title = card ? (card.querySelector('h4')?.innerText || '').replace(/\s+/g, ' ').trim() : ''
      return { label, title }
    })
    const idx = Number((head.label.match(/(\d+)\s+of/i) || [])[1] || 0)
    const cfg = stageSteps[idx - 1] || {}
    const m = await measure(page, cfg.target || null, cfg.secondaryTarget || null)
    if (m.stepLabel === head.label && m.title === head.title) return { m, cfg, idx }
    await page.waitForTimeout(250)
  }
  return null
}

const clickCardCta = (page) =>
  jsClick(page, '[data-tutorial-card] .praxis-modal-actions button').catch(() => false)

const clickSelector = async (page, sel) => {
  if (!sel) return false
  const ok = await jsClick(page, sel).catch(() => false)
  if (!ok) {
    const loc = page.locator(sel).first()
    if (await loc.count() === 0) return false
    await loc.click({ force: true }).catch(() => {})
  }
  return true
}

/**
 * Clicks the element a step points at. Term containers must be clicked on the
 * container itself (which select the WHOLE term) — a coordinate click on the
 * middle of "xy" only selects the variable underneath it.
 */
const clickTarget = (page, sel) => (sel ? clickSelector(page, sel) : Promise.resolve(false))

/** HTML5 drag: mouse-driven first, synthetic DragEvents as the fallback. */
async function dragTerm(page, srcSel, dstSel) {
  const src = page.locator(srcSel).first()
  const dst = page.locator(dstSel).first()
  if (await src.count() === 0 || await dst.count() === 0) return false
  const a = await src.boundingBox()
  const b = await dst.boundingBox()
  if (!a || !b) return false
  const from = { x: a.x + a.width / 2, y: a.y + a.height / 2 }
  const to = { x: b.x + b.width / 2, y: b.y + b.height / 2 }
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(from.x + ((to.x - from.x) * i) / 8, from.y + ((to.y - from.y) * i) / 8)
    await page.waitForTimeout(30)
  }
  await page.mouse.up()
  await page.waitForTimeout(900)
  return true
}

/**
 * Runs every strategy that can move the deck forward and returns true when the
 * rendered step actually changed.
 */
async function advanceStep(page, currentStep, targetSel) {
  const before = await stepKey(page)
  const tryOnce = async (fn) => {
    await fn()
    const after = await waitStepChange(page, before, 2600)
    return after !== null
  }

  // 1. Steps gated by the card's own action button (button / next_stage / finish).
  if (['button', 'next_stage', 'finish'].includes(currentStep?.actionType)) {
    if (await tryOnce(() => clickCardCta(page))) return true
  }

  // 2. Direct interaction with the highlighted target.
  if (['select_var', 'click_not', 'click_review', 'button', 'next_stage', 'finish'].includes(currentStep?.actionType)) {
    if (await tryOnce(() => clickTarget(page, targetSel))) return true
  }

  if (currentStep?.actionType === 'select_both') {
    if (await tryOnce(async () => {
      await clickTarget(page, targetSel)
      await clickTarget(page, currentStep.secondaryTarget)
    })) return true
  }

  if (currentStep?.actionType === 'apply_law') {
    const lawName = currentStep.expectedLaw || currentStep._solveLaw
    if (lawName) {
      if (await tryOnce(() => clickLawByName(page, lawName))) return true
    }
  }

  if (currentStep?.actionType === 'swap') {
    if (await tryOnce(() => dragTerm(page, targetSel, currentStep.secondaryTarget))) return true
  }

  // 3. Generic fallbacks for step kinds we could not classify.
  if (await tryOnce(() => clickSelector(page, targetSel))) return true
  if (await tryOnce(() => clickCardCta(page))) return true
  if (await tryOnce(() => clickSelector(page, currentStep?.secondaryTarget))) return true
  return false
}

/* ── the walk ─────────────────────────────────────────────────────────── */
const rep = reporter('F1 tutorial popup overlap')
const browser = await launch()
const state = await seededState(browser)

/** Stage-3 challenge solve: the tutorial takes any valid derivation (gameData stage 4 optimalHint). */
const CHALLENGE_SOLVE_SEQUENCE = ['Distributive (Factor)', 'Complement', 'Identity', 'Absorption', 'Idempotent']

const canvasText = (page) => page.evaluate(() =>
  (document.querySelector('[data-tutorial="canvas"]')?.innerText || '').replace(/\s+/g, ' ').trim())

/**
 * Drives the free challenge stage to its goal by applying whatever law the
 * current selection offers, watching the canvas text to confirm real progress.
 */
async function solveChallenge(page, maxMoves = 8) {
  for (let move = 0; move < maxMoves; move++) {
    if (await page.evaluate(() => Boolean(document.querySelector('[data-tutorial="score-modal"]')))) return true
    const before = await canvasText(page)
    let progressed = false
    for (const lawName of CHALLENGE_SOLVE_SEQUENCE) {
      if (!await clickLawByName(page, lawName)) continue
      await page.waitForTimeout(1400)
      const now = await canvasText(page)
      if (now && now !== before) { progressed = true; break }
    }
    if (!progressed) return Boolean(await page.evaluate(() => Boolean(document.querySelector('[data-tutorial="score-modal"]'))))
  }
  return Boolean(await page.evaluate(() => Boolean(document.querySelector('[data-tutorial="score-modal"]'))))
}

let screenshotOrdinal = 0
const beforeOverlaps = []

for (const deviceName of DEVICE_LIST) {
  const preset = DEVICES[deviceName]
  const d = await device(browser, preset, state)
  const page = d.page
  const deviceFailures = []
  let walked = 0
  let deviceStep = 0

  rep.section(`${deviceName} (${preset.viewport.width}x${preset.viewport.height})`)

  for (const stageIdx of STAGE_LIST) {
    const stageSteps = TUTORIAL_STAGES[stageIdx] || []
    await nav(page, `/level/0/stage/${stageIdx}?tutorial=true`)
    const started = await waitForTutorialStart(page)
    if (!started) {
      rep.log(`stage ${stageIdx} tutorial renders`, false, 'no coach card / welcome deck within 25s')
      deviceFailures.push({ stage: stageIdx, reason: 'tutorial never started' })
      continue
    }
    await page.waitForTimeout(900)

    const seenTitles = new Map()
    let lastCfg = null
    let stageStuck = false
    for (let guard = 0; guard < MAX_STEPS_PER_STAGE; guard++) {
      // Wait for a card to be mounted (it unmounts during law transformations).
      let cardUp = await page.evaluate(() => Boolean(document.querySelector('[data-tutorial-card]')))
      if (!cardUp) {
        const key = await stepKey(page)
        if (key === 'welcome') { await dismissWelcome(page); continue }
        if (lastCfg && ['finish', 'next_stage'].includes(lastCfg.actionType)) break
        cardUp = await waitForTutorialStart(page, 9000)
        if (!cardUp) {
          const why = key === 'welcome' ? 'welcome modal stuck' : `no coach card after "${key}"`
          rep.log(`stage ${stageIdx} step renders`, false, why)
          deviceFailures.push({ stage: stageIdx, reason: why })
          break
        }
      }

      await page.waitForTimeout(SETTLE_MS)
      const stable = await measureStable(page, stageSteps)
      if (!stable) continue
      const { m, cfg, idx } = stable
      lastCfg = cfg
      const targetSel = cfg.target || null
      const title = norm(m.title)
      walked++
      deviceStep++
      screenshotOrdinal++

      const seen = (seenTitles.get(title) || 0) + 1
      seenTitles.set(title, seen)
      if (seen > 3) {
        rep.log(`stage ${stageIdx} "${title}" advances`, false, `revisited ${seen}x — walk stuck`)
        deviceFailures.push({ stage: stageIdx, step: idx, reason: `loop on "${title}"` })
        stageStuck = true
        break
      }

      const hardHits = []
      const softHits = []
      if (m.card) {
        if (m.target && overlaps(m.card, m.target)) hardHits.push(`target ${m.target.label}(${m.target.sel}) area=${overlapArea(m.card, m.target)}`)
        if (m.secondary && overlaps(m.card, m.secondary)) hardHits.push(`secondary ${m.secondary.label}(${m.secondary.sel}) area=${overlapArea(m.card, m.secondary)}`)
        for (const c of m.controls) {
          if (overlaps(m.card, c)) softHits.push(`${c.label}(${c.w}x${c.h}@${c.x},${c.y}) area=${overlapArea(m.card, c)}`)
        }
      }
      const fitBad = m.card ? !m.cardInViewport : false
      const ok = Boolean(m.card) && hardHits.length === 0 && softHits.length === 0 && !fitBad

      const tag = `${deviceName} stage${stageIdx} step${idx}`
      rep.log(
        `${tag} [${norm(m.title).slice(0, 34) || 'welcome'}]`,
        ok,
        ok
          ? `card=${rectStr(m.card)} target=${rectStr(m.target)} y=${TAG}`
          : `card=${rectStr(m.card)} target=${rectStr(m.target)} hard=[${hardHits.join('; ')}] soft=[${softHits.slice(0, 4).join('; ')}]${fitBad ? ' OFFSCREEN' : ''} y=${TAG}`,
      )
      if (VERBOSE && ok) {
        console.log(`      controls=${m.controls.length} labels=${m.controls.slice(0, 8).map(c => c.label).join(',')}`)
      }

      await shot(page, `tutorial-fixed-${deviceName}-step${deviceStep}`)

      if (!ok) {
        deviceFailures.push({
          stage: stageIdx, step: idx, title,
          card: m.card, target: m.target, secondary: m.secondary,
          hardHits, softHits, fitBad,
        })
        if (TAG === 'before') {
          beforeOverlaps.push({ device: deviceName, stage: stageIdx, step: idx, title, card: m.card, target: m.target, hits: [...hardHits, ...softHits] })
        }
      }

      // Advance. Stage 3's free challenge step needs a real derivation.
      let advanced
      if (stageIdx === 3 && cfg.id === 'challenge-solve') {
        const before = await stepKey(page)
        await solveChallenge(page)
        advanced = Boolean(await waitStepChange(page, before, 4000))
        if (!advanced) advanced = await advanceStep(page, cfg, targetSel)
      } else {
        advanced = await advanceStep(page, cfg, targetSel)
      }
      if (!advanced) {
        rep.log(`${tag} advances`, false, `no strategy moved the deck from "${title}"`)
        deviceFailures.push({ stage: stageIdx, step: idx, reason: `cannot advance from "${title}"` })
        break
      }
    }
    if (stageStuck) continue

    // Leaving a stage: the last step's CTA ends the tutorial for that stage.
    await page.waitForTimeout(400)
  }

  const scroll = await noHorizontalScroll(page)
  rep.log(`${deviceName} no horizontal page scroll`, scroll.ok, `scrollWidth=${scroll.scrollWidth} inner=${scroll.innerWidth}`)
  console.log(`[${deviceName}] walked ${walked} steps; failures=${deviceFailures.length}; pageErrors=${d.errors.length}`)
  if (d.errors.length) console.log(`  pageErrors: ${d.errors.slice(0, 3).join(' | ')}`)
  await d.ctx.close()
}

const failed = rep.summary()
console.log(`\nsteps walked: see per-device counts above (screenshot ordinal reached ${screenshotOrdinal})`)
if (beforeOverlaps.length) {
  console.log('\n── BEFORE/AFTER overlap ledger ──')
  for (const o of beforeOverlaps) {
    console.log(`  ${o.device} stage${o.stage} step${o.step} "${o.title}" card=${rectStr(o.card)} target=${rectStr(o.target)} hits=${o.hits.join(' | ')}`)
  }
}
await browser.close()
process.exit(failed > 0 ? 1 : 0)
