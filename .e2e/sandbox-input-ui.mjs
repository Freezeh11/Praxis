/**
 * Browser acceptance test for the SANDBOX INPUT SCREEN (Feature 1, part 2).
 *
 * Asserts the user-visible contract of `/sandbox`:
 *   - a FRESH screen shows NO error: the feedback slot is a neutral helper line,
 *     never "Please enter a Boolean expression." (the user-reported bug)
 *   - that exact message is still reachable at both boundaries: after a real edit
 *     is cleared (typed then cleared), and after an explicit submit attempt while
 *     empty — byte-identical, red, role="alert"
 *   - live, debounced validation renders the exact validator message inline for
 *     non-empty input, with role="alert" while invalid and role="status" once valid
 *   - the label "Enter a Boolean expression" is really bound to the input, and
 *     the data-testids (sandbox-input / sandbox-feedback / sandbox-validate-btn /
 *     sandbox-random-btn) are unchanged
 *   - "Validate & Play" is a real disabled button until the input is valid
 *   - a valid expression opens /sandbox/play with THAT expression on the canvas
 *   - an unsolvable-but-valid expression ("A") stays on /sandbox with the
 *     already-in-its-simplest-form verdict
 *   - Enter submits, 🎲 Random problem still opens the random flow
 *   - the Level Select Sandbox card advertises (and opens) this screen
 *   - MOBILE: at 844x390, 667x375 and 568x320 the input, "Validate & Play" and
 *     the first example chip are fully above the fold with scrollY === 0 (nothing
 *     was auto-scrolled into view); at 320x568 and 420x800 there is no horizontal
 *     page scroll; input font-size is >= 16px, the CTA is >= 48px tall and every
 *     chip is >= 44px tall in every one of those viewports
 *   - no uncaught page errors in any of those viewports
 *
 * Harness: the shared helpers in ./_harness.mjs (Lead-owned). Auth + a
 * post-tutorial progress snapshot are created once in a desktop context and
 * replayed into every emulated device via storageState — a phone in PORTRAIT
 * shows the non-dismissible rotate overlay, so the login form underneath is
 * deliberately unclickable there. That is also why the 320x568 "narrow
 * portrait" measurement is taken in a NON-TOUCH 320px-wide window: on a touch
 * phone that width is portrait, and the app (OrientationGate, by design) covers
 * the screen with "rotate your device" instead of the form.
 *
 * The shared e2e account's SERVER rows are deliberately left untouched: other
 * teammates run their browser tests concurrently against the same account.
 *
 * Requires: vite dev server on 5173 + FastAPI on 8000 (already running).
 * Run:  node .e2e/sandbox-input-ui.mjs
 */
import {
  launch, seededState, device, DEVICES, nav, reporter, foldReport,
  noHorizontalScroll, shot,
} from './_harness.mjs'

const INPUT = '[data-testid="sandbox-input"]'
const FEEDBACK = '[data-testid="sandbox-feedback"]'
const VALIDATE = '[data-testid="sandbox-validate-btn"]'
const RANDOM = '[data-testid="sandbox-random-btn"]'
/** Exactly what sandboxInput.js emits for a blank field — part of the spec. */
const MSG_EMPTY = 'Please enter a Boolean expression.'
/** The chips live in the shared rail; acceptance-features.mjs measures this too. */
const CHIPS = '.praxis-rail > *'

const GREEN = 'rgb(16, 185, 129)' // tailwind token `green`
const RED = 'rgb(239, 68, 68)'   // tailwind token `red`

/** 320x568 portrait-width, pointer-fine: no rotate overlay, real layout. */
const NARROW_320 = { name: 'narrow-320x568', viewport: { width: 320, height: 568 } }
/** Touch phone portrait: proven to be overlay territory, never measured here. */
const TOUCH_PORTRAIT = { name: 'touch-portrait-390x844', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }

const norm = (s) => s.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()

const { log, section, summary } = reporter('sandbox input UI')

/* ══ 1. Harness — replay the seeded learner ════════════════════════════ */
section('1. harness — seeded learner')
const browser = await launch()
const state = await seededState(browser)

const hasAuthToken = (state.origins || []).some(o =>
  (o.localStorage || []).some(entry => entry.name && entry.name.includes('auth-token')))
log('the seeded storageState carries a real auth session', hasAuthToken,
  `origins=${(state.origins || []).length} cookies=${(state.cookies || []).length}`)

const desktop = await device(browser, DEVICES.desktop, state)
const page = desktop.page
const pageErrors = desktop.errors
page.on('pageerror', err => console.log('PAGE ERROR:', err.message))

const feedbackOf = async (target = page) => {
  const loc = target.locator(FEEDBACK)
  if (await loc.count() === 0) return { text: '', exists: false, role: null, color: null, tone: null }
  const first = loc.first()
  return {
    text: norm(await first.innerText()),
    exists: true,
    role: await first.getAttribute('role'),
    tone: await first.getAttribute('data-tone'),
    color: await first.evaluate(el => getComputedStyle(el).color),
    ariaInvalid: await target.locator(INPUT).first().getAttribute('aria-invalid'),
  }
}

/** Types like a learner, then waits past the required ~300ms debounce. */
const typeExpression = async (value, target = page) => {
  const input = target.locator(INPUT).first()
  await input.click()
  await input.fill('')
  if (value) await input.type(value, { delay: 12 })
  await target.waitForTimeout(600)
}

const playDisabled = (target = page) => target.locator(VALIDATE).first().isDisabled()

/** Canvas text, tolerant of being on the wrong screen (never throws). */
const canvasText = async () => {
  const canvas = page.locator('[data-tutorial="canvas"]')
  if (await canvas.count() === 0) return '<no canvas>'
  // The drag grips are visually hidden but still part of innerText.
  return norm(await canvas.first().innerText()).replace(/⠿/g, '')
}

/** Explains a failed workspace-handoff assertion without pretending it passed. */
const blocked = (what, why) => console.log(`INFO | ${what} is blocked: ${why}`)

/** Bounded wait for the workspace canvas; false instead of throwing. */
const waitForCanvas = async (timeout = 10000) =>
  page.waitForSelector('[data-tutorial="canvas"]', { timeout }).then(() => true).catch(() => false)

const sidestep = async (path) => {
  await nav(page, path)
  if (path === '/sandbox') await page.waitForSelector(INPUT, { timeout: 30000 })
  await page.waitForTimeout(700) // > the 300ms debounce: verdicts have settled
}

/* ══ 2. Verdict timing — all three boundaries ══════════════════════════ */
section('2. verdict timing (the reported bug)')

/* Boundary 0 — FIRST PAINT, nothing touched. */
await sidestep('/sandbox')
let fb = await feedbackOf()
log('fresh paint: feedback does NOT contain "Please enter a Boolean expression."',
  !fb.text.includes(MSG_EMPTY), `"${fb.text}"`)
log('fresh paint: the neutral helper line is shown instead',
  fb.tone === 'idle' && fb.text.includes("Accepted: A, A', AB, A(B + C)"),
  `tone=${fb.tone} "${fb.text}"`)
log('fresh paint: no error glyph and no red',
  !fb.text.includes('✗') && fb.color !== RED, `color=${fb.color}`)
log('fresh paint: role="status" (not an alert) and aria-invalid="false"',
  fb.role === 'status' && fb.ariaInvalid === 'false', `role=${fb.role} aria-invalid=${fb.ariaInvalid}`)
log('fresh paint: "Validate & Play" is still disabled', await playDisabled())

/* Boundary 1 — typed then cleared with real keystrokes. */
await sidestep('/sandbox')
{
  const input = page.locator(INPUT).first()
  await input.click()
  await input.type('A', { delay: 12 })
  await page.waitForTimeout(600)
  const typed = await feedbackOf()
  log('"A" -> ✓ "Valid expression" while the field is non-empty',
    typed.text.includes('Valid expression') && typed.tone === 'ok' && !(await playDisabled()),
    `feedback="${typed.text}"`)
  await input.press('Backspace')
  await page.waitForTimeout(700)
  fb = await feedbackOf()
  log('typed then cleared -> the exact empty message appears',
    fb.text.includes(MSG_EMPTY), `"${fb.text}"`)
  log('typed then cleared -> red ✗, role="alert", Play disabled',
    fb.text.startsWith('✗') && fb.color === RED && fb.role === 'alert' && await playDisabled(),
    `color=${fb.color} role=${fb.role} disabled=${await playDisabled()}`)
}

/* Boundary 1b — the same via the acceptance helper's fill('') path. */
await typeExpression('A')
await typeExpression('')
fb = await feedbackOf()
log('typed then cleared (fill("") path) -> the exact empty message appears',
  fb.text.includes(MSG_EMPTY), `"${fb.text}"`)

/* Boundary 2 — explicit submit attempt while empty. */
await sidestep('/sandbox')
await page.locator(INPUT).first().press('Enter')
await page.waitForTimeout(700)
fb = await feedbackOf()
log('explicit submit attempt while empty -> the exact empty message appears',
  fb.text.includes(MSG_EMPTY) && fb.tone === 'error' && fb.role === 'alert',
  `tone=${fb.tone} role=${fb.role} "${fb.text}"`)

/* Boundary 3 — the message stays byte-identical to the spec string. */
await sidestep('/sandbox')
await typeExpression('A')
await typeExpression('')
fb = await feedbackOf()
log(`the string is byte-identical: "${MSG_EMPTY}"`,
  fb.text === '✗ ' + MSG_EMPTY, `innerText="${fb.text}"`)

/* ══ 3. Label ⇄ input binding + frozen testids ═════════════════════════ */
section('3. input + label binding')
await sidestep('/sandbox')
const labelText = await page.locator('label').filter({ hasText: 'Enter a Boolean expression' }).count()
const byLabel = page.getByLabel('Enter a Boolean expression', { exact: true })
const boundInput = (await byLabel.count()) === 1
  ? await byLabel.first().getAttribute('data-testid')
  : null
log('the label "Enter a Boolean expression" is visible', labelText > 0, `labels=${labelText}`)
log('the label is bound (htmlFor/id) to data-testid="sandbox-input"',
  boundInput === 'sandbox-input', `getByLabel resolves to testid=${boundInput}`)
log('frozen testids exist exactly once (input / feedback / validate / random)',
  (await page.locator(INPUT).count()) === 1
  && (await page.locator(FEEDBACK).count()) === 1
  && (await page.locator(VALIDATE).count()) === 1
  && (await page.locator(RANDOM).count()) === 1,
  `input=${await page.locator(INPUT).count()} feedback=${await page.locator(FEEDBACK).count()} ` +
  `validate=${await page.locator(VALIDATE).count()} random=${await page.locator(RANDOM).count()}`)

/* ══ 4. Live validation (debounced) — non-empty behaviour unchanged ════ */
section('4. live validation (non-empty input unchanged)')
const cases = [
  ['A++B', 'Two operators in a row', 'two operators in a row', '✗', RED],
  ['A & B @ C', 'Invalid character(s) found: @', 'invalid characters name "@"', '✗', RED],
  ['ABCDEFG', 'Sandbox supports up to 6 variables. Your expression uses 7',
    'the 6-variable ceiling is reported with the real count', '✗', RED],
  ['(A+B', 'Unbalanced parentheses', 'unbalanced parentheses', '✗', RED],
  ['A !', 'A NOT symbol must attach to a variable', 'stray NOT', '✗', RED],
]
for (const [value, expected, name, glyph, color] of cases) {
  await typeExpression(value)
  fb = await feedbackOf()
  const disabled = await playDisabled()
  log(`"${value}" -> ${name}`,
    fb.text.includes(expected) && disabled && fb.text.startsWith(glyph) && fb.color === color,
    `feedback="${fb.text.slice(0, 100)}" disabled=${disabled} color=${fb.color}`)
}

await typeExpression('A & B @ C')
fb = await feedbackOf()
log('invalid-character message lists the allowed set',
  fb.text.includes("Only letters, +, ·, *, ., &, |, ', !, ¬, (), 0, 1 are allowed"),
  fb.text.slice(0, 170))

/* ══ 5. Valid input → workspace with THAT expression ════════════════════ */
section('5. valid input -> workspace')
await typeExpression("A(B + A')")
fb = await feedbackOf()
let disabled = await playDisabled()
log(`"A(B + A')" -> green ✓ "Valid expression", Play enabled`,
  fb.text.includes('Valid expression') && fb.text.startsWith('✓') && fb.color === GREEN && !disabled,
  `feedback="${fb.text}" color=${fb.color} disabled=${disabled}`)
log('valid feedback is announced as role="status"', fb.role === 'status', `role=${fb.role}`)

await page.locator(VALIDATE).first().click()
await page.waitForTimeout(2500)

const handedOff = page.url().includes('/sandbox/play') && await waitForCanvas()
const customCanvas = handedOff ? await canvasText() : '<stayed on /sandbox>'
log(`"A(B + A')" -> Validate & Play opens /sandbox/play with that expression on the canvas`,
  handedOff && /A\s*\(\s*B\s*\+\s*A'?\s*\)/.test(customCanvas),
  `url=${page.url()} canvas="${customCanvas.slice(0, 140)}"`)
if (!handedOff) {
  const verdict = await feedbackOf()
  blocked('the workspace handoff for "A(B + A\')"',
    `buildSandboxPuzzle rejected it ("${verdict.text || 'no feedback'}"). The engine has NO legal move for prod(A, sum(B, A')) — engine/solver.js getLegalTransitions() — so it reports already-simplest. Fix is shared task-5 (gated distributive-expansion law, owner validator-dev; do NOT swap the expression out).`)
}

/* Independent proof of the same page -> workspace handoff, with an expression
   the engine can play TODAY (one of the four required example chips). */
section('5b. valid + engine-playable expression -> workspace')
await sidestep('/sandbox')
await typeExpression("!(A * B) + C'")
fb = await feedbackOf()
log(`"!(A * B) + C'" is accepted and the expression that reaches the workspace is "(AB)' + C'"`,
  fb.text.includes('Valid expression') && !(await playDisabled()), `feedback="${fb.text}"`)
await page.locator(VALIDATE).first().click()
await page.waitForTimeout(2500)
const playableHandoff = page.url().includes('/sandbox/play') && await waitForCanvas()
const playableCanvas = playableHandoff ? await canvasText() : '<stayed on /sandbox>'
log('Validate & Play opens /sandbox/play for a playable expression', playableHandoff, page.url())
log('the workspace canvas renders that exact expression',
  /\(AB\)'?\s*\+\s*C/.test(playableCanvas), `canvas="${playableCanvas.slice(0, 140)}"`)

/* ══ 6. Valid but unsolvable ("A") stays on the input screen ════════════ */
section('6. already-simplest keeps the learner on /sandbox')
await sidestep('/sandbox')
await typeExpression('A')
log('"A" is syntactically valid -> Play enabled', !(await playDisabled()))
await page.locator(VALIDATE).first().click()
await page.waitForTimeout(2500)
fb = await feedbackOf()
log('"A" -> "already in its simplest form" verdict, URL stays /sandbox',
  page.url().endsWith('/sandbox') && fb.text.includes('already in its simplest form'),
  `url=${page.url()} feedback="${fb.text.slice(0, 120)}"`)

await typeExpression('AB')
await page.waitForTimeout(400)
const afterEdit = await feedbackOf()
log('editing clears the build verdict and re-runs live validation',
  afterEdit.text.includes('Valid expression'), `feedback="${afterEdit.text}"`)

/* ══ 7. Enter submits · 🎲 Random flow preserved ════════════════════════ */
section('7. Enter key + random flow')
await typeExpression('A + AB')
await page.locator(INPUT).first().press('Enter')
await page.waitForTimeout(2500)
await waitForCanvas()
log('Enter submits a valid expression', page.url().includes('/sandbox/play'), page.url())
const enterCanvas = await canvasText()
log('Enter landed on that expression', /A\s*\+\s*AB/.test(enterCanvas), `canvas="${enterCanvas.slice(0, 140)}"`)

await sidestep('/sandbox')
log('🎲 Random problem button exists', (await page.locator(RANDOM).count()) === 1)
await page.locator(RANDOM).first().click()
await page.waitForTimeout(2500)
await waitForCanvas()
const randomCanvas = await canvasText()
log('🎲 Random problem still opens the generated-problem flow',
  page.url().includes('/sandbox/play') && randomCanvas.includes('F ='),
  `url=${page.url()} canvas="${randomCanvas.slice(0, 90)}"`)

/* ══ 8. Level Select entry point ════════════════════════════════════════ */
section('8. Level Select entry point')
await nav(page, '/levels')
await page.waitForSelector('#start-level-btn', { timeout: 30000 })
await page.waitForTimeout(1200)

const descCount = await page.locator('text=type your own expression').count()
log('Sandbox card advertises typing your own expression', descCount > 0, `matches=${descCount}`)

const nextBtn = page.locator('button:has-text("›")')
for (let i = 0; i < 8; i++) {
  const label = await page.locator('#start-level-btn').innerText()
  if (label.toUpperCase().includes('SANDBOX')) break
  if (await nextBtn.isDisabled()) break
  await nextBtn.click()
  await page.waitForTimeout(180)
}
const startLabel = norm(await page.locator('#start-level-btn').innerText())
log('Sandbox card is unlocked and actionable', startLabel.toUpperCase().includes('SANDBOX'), `label="${startLabel}"`)

await page.click('#start-level-btn')
await page.waitForTimeout(2000)
log('Sandbox card opens /sandbox', page.url().endsWith('/sandbox'), page.url())

/* ══ 9. Fluid at 320px + example chips ═════════════════════════════════ */
section('9. narrow layout + example chips')
await page.setViewportSize({ width: 320, height: 720 })
await sidestep('/sandbox')
const narrow = await noHorizontalScroll(page)
log('320px wide: no horizontal page scroll', narrow.ok, JSON.stringify(narrow))
log('320px wide: label, input and Play button all visible',
  (await page.locator(INPUT).first().isVisible())
  && (await page.locator(VALIDATE).first().isVisible())
  && (await page.getByLabel('Enter a Boolean expression', { exact: true }).count()) === 1)
log('320px wide: the chips live in the shared rail',
  (await page.locator('.praxis-rail > *').count()) === 4,
  `railChildren=${await page.locator('.praxis-rail > *').count()}`)

const chips = page.locator('button[data-example]')
const chipLabels = await chips.allInnerTexts()
// The recommended inputs are all PLAYABLE puzzles now (the two former dead
// ends AB + A'C and (x+y)(x'+z) still validate but report already-simplest, so
// they are no longer advertised as chips).
const EXPECTED_CHIPS = ["A(B + A')", 'A + AB', "!(A * B) + C'", '(A + B)(A + B\')']
log('four example chips are offered',
  chipLabels.length === 4
  && chipLabels.map(norm).join('|') === EXPECTED_CHIPS.join('|'),
  chipLabels.map(norm).join(' | '))

await chips.nth(1).click()
await page.waitForTimeout(600)
const chipValue = await page.locator(INPUT).first().inputValue()
fb = await feedbackOf()
log('an example chip fills the input and validates it',
  chipValue === 'A + AB' && fb.text.includes('Valid expression') && !(await playDisabled()),
  `value="${chipValue}" feedback="${fb.text}"`)

/* ══ 10. Mobile fold + layout ══════════════════════════════════════════ */
section('10. mobile fold + layout')

/**
 * Opens one emulated device, measures the actionable stack against the fold and
 * its own tap-target minimums. `expectFold` is set where the whole stack must be
 * visible without scrolling; the narrow portrait windows are allowed to scroll
 * vertically (a phone held upright always does), so there only the horizontal
 * overflow + tap-target rules are enforced.
 */
async function checkDevice(preset, { expectFold, keepShot }) {
  const d = await device(browser, preset, state)
  const p = d.page

  await nav(p, '/sandbox')
  await p.waitForSelector(INPUT, { timeout: 30000 })
  await p.waitForTimeout(900) // > debounce, and the layout has settled

  const inputFold = await foldReport(p, INPUT)
  const btnFold = await foldReport(p, VALIDATE)
  const chipFold = await foldReport(p, CHIPS)
  const scroll = await p.evaluate(() => ({
    scrollY: window.scrollY, scrollX: window.scrollX,
    scrollHeight: document.documentElement.scrollHeight,
    innerHeight: window.innerHeight,
  }))
  const hscroll = await noHorizontalScroll(p)
  const overlay = await p.evaluate(() => document.body.classList.contains('praxis-overlay-open'))
  const fbText = norm(await p.locator(FEEDBACK).first().innerText().catch(() => ''))
  const sizes = await p.evaluate(() => {
    const rect = (el) => { const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) } }
    const input = document.querySelector('[data-testid="sandbox-input"]')
    const btn = document.querySelector('[data-testid="sandbox-validate-btn"]')
    const chips = [...document.querySelectorAll('.praxis-rail > *')]
    const rail = document.querySelector('.praxis-rail')
    /* Every interactive control on the screen, for the WCAG 2.5.5 tap-target rule. */
    const taps = [...document.querySelectorAll('a, button')]
      .filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 })
      .map(el => ({
        label: (el.innerText || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 24),
        h: Math.round(el.getBoundingClientRect().height),
      }))
    return {
      inputFontPx: parseFloat(getComputedStyle(input).fontSize),
      btn: rect(btn),
      chips: chips.map(rect),
      rail: rail ? { scrollWidth: rail.scrollWidth, clientWidth: rail.clientWidth } : null,
      taps,
    }
  })

  const inputIn = Boolean(inputFold.items[0]?.inFold)
  const btnIn = Boolean(btnFold.items[0]?.inFold)
  const firstChipIn = Boolean(chipFold.items[0]?.inFold)

  log(`@${d.name}: no rotate overlay covering the page (body.praxis-overlay-open)`,
    !overlay, `overlay=${overlay}`)

  if (expectFold) {
    log(`@${d.name}: input, Validate & Play and the first chip are FULLY above the fold`,
      inputIn && btnIn && firstChipIn,
      `input=${JSON.stringify(inputFold.items[0])} button=${JSON.stringify(btnFold.items[0])} chip1=${JSON.stringify(chipFold.items[0])}`)
    log(`@${d.name}: nothing had to be scrolled to reach them (scrollY === 0, no auto-scroll)`,
      scroll.scrollY === 0 && scroll.scrollX === 0, JSON.stringify(scroll))
  } else {
    console.log(`INFO | @${d.name}: fold (informational; vertical scrolling is expected here) ` +
      `inputBottom=${inputFold.items[0]?.bottom}/${inputFold.viewport.h} buttonBottom=${btnFold.items[0]?.bottom} ` +
      `chip1Bottom=${chipFold.items[0]?.bottom} scrollY=${scroll.scrollY} docScrollHeight=${scroll.scrollHeight}`)
  }

  log(`@${d.name}: no horizontal page scroll`, hscroll.ok, JSON.stringify(hscroll))
  log(`@${d.name}: input font-size >= 16px (no iOS zoom-on-focus)`,
    sizes.inputFontPx >= 16, `fontSize=${sizes.inputFontPx}px`)
  log(`@${d.name}: "Validate & Play" >= 48px tall`, sizes.btn.h >= 48, `button=${JSON.stringify(sizes.btn)}`)
  log(`@${d.name}: every chip >= 44px tall, 4 chips in one rail row`,
    sizes.chips.length === 4 && sizes.chips.every(c => c.h >= 44),
    `chips=${JSON.stringify(sizes.chips)} rail=${JSON.stringify(sizes.rail)}`)
  log(`@${d.name}: EVERY interactive control is >= 44px tall (WCAG 2.5.5)`,
    sizes.taps.length > 0 && sizes.taps.every(t => t.h >= 44),
    `${sizes.taps.map(t => `${t.label}:${t.h}`).join(' | ')}`)
  log(`@${d.name}: a fresh phone screen shows no premature empty error`,
    !fbText.includes(MSG_EMPTY), `feedback="${fbText.slice(0, 60)}"`)

  if (keepShot) {
    const shotPath = await shot(p, `sandbox-after-${d.name}`)
    console.log(`SHOT | ${shotPath} (${d.name})`)
  }

  log(`@${d.name}: no uncaught page errors`, d.errors.length === 0, d.errors.slice(0, 3).join(' | '))

  await d.ctx.close()
}

/* The viewports the fix is graded at: everything actionable above the fold. */
for (const preset of [DEVICES.phoneLandscape, DEVICES.phoneLandscapeSmall, DEVICES.phoneLandscapeTiny]) {
  await checkDevice(preset, { expectFold: true, keepShot: preset !== DEVICES.phoneLandscapeTiny })
}

/* Narrow windows (pointer-fine, so no rotate gate): tap targets + no sideways scroll. */
await checkDevice(NARROW_320, { expectFold: false, keepShot: false })
await checkDevice(DEVICES.narrowDesktop, { expectFold: false, keepShot: false })

/* Why 320x568 is measured without touch: on a touch phone that viewport is
   portrait, and the app deliberately replaces the screen with the rotate gate. */
{
  const d = await device(browser, TOUCH_PORTRAIT, state)
  await nav(d.page, '/sandbox')
  await d.page.waitForTimeout(900)
  const overlay = await d.page.evaluate(() => document.body.classList.contains('praxis-overlay-open'))
  console.log(`INFO | @${d.name}: body.praxis-overlay-open=${overlay} — a touch phone in portrait is ` +
    'covered by the rotate gate by design (OrientationGate), which is why the narrow-portrait ' +
    'layout measurement above uses a non-touch 320px window.')
  console.log(`INFO | @${d.name}: page errors=${d.errors.length}`)
  await d.ctx.close()
}

/* ══ 11. Page health (desktop context) ═════════════════════════════════ */
section('11. page health')
log('no uncaught page errors on desktop', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '))

/* ── Summary ──────────────────────────────────────────────────────────── */
const failed = summary()
await browser.close()
process.exit(failed > 0 ? 1 : 0)
