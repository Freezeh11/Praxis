/**
 * Canvas calm evidence: screenshots the sandbox PLAY workspace (/sandbox/play)
 * and a graded stage in both themes, before/after the backdrop fix.
 *
 * Run:  node .e2e/_canvas-calm-shot.mjs <tag>
 * Requires the dev server on http://localhost:5173 and backend/.env (Supabase).
 */
import { launch, seededState, device, DEVICES, BASE } from './_harness.mjs'

const tag = process.argv[2] || 'shot'

async function open(browser, preset, state, theme) {
  const { ctx, page, errors } = await device(browser, preset, state)
  await page.addInitScript((args) => {
    localStorage.setItem(args.key, args.value)
    localStorage.setItem('praxis_hide_survey', 'true')
  }, { key: 'praxis-theme', value: theme })
  return { ctx, page, errors }
}

async function playSandbox(page) {
  await page.goto(BASE + '/sandbox/play', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-testid="derivation-scroll"]', { timeout: 30000 })
  // Let the travelling packets move into view so "before" shows them.
  await page.waitForTimeout(2600)
}

async function playStage(page) {
  await page.goto(BASE + '/level/1/stage/1', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-testid="derivation-scroll"]', { timeout: 30000 })
  await page.waitForTimeout(2000)
}

const browser = await launch()
const state = await seededState(browser)
const results = []

for (const [preset, theme, file] of [
  [DEVICES.desktop, 'dark', `${tag}-sandbox-play-desktop-dark`],
  [DEVICES.desktop, 'light', `${tag}-sandbox-play-desktop-light`],
  [DEVICES.phoneLandscape, 'dark', `${tag}-sandbox-play-phoneLandscape-dark`],
]) {
  const { ctx, page, errors } = await open(browser, preset, state, theme)
  await playSandbox(page)
  const path = `.e2e/shots-review/${file}.png`
  await page.screenshot({ path })
  results.push({ path, errors })
  await ctx.close()
}

{
  const { ctx, page, errors } = await open(browser, DEVICES.desktop, state, 'dark')
  await playStage(page)
  const path = `.e2e/shots-review/${tag}-stage-play-desktop-dark.png`
  await page.screenshot({ path })
  results.push({ path, errors })
  await ctx.close()
}

await browser.close()
for (const r of results) console.log(r.path + (r.errors.length ? '  ERRORS: ' + r.errors.join(' | ') : '  ok'))
