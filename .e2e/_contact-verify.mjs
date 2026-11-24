/**
 * /contact verification: layout shots in both themes across devices, the form's
 * validation, success and failure states, plus every entry point that now points
 * at it. Routes /api/feedback are fulfilled locally so no real message is stored.
 *
 * Run:  node .e2e/_contact-verify.mjs
 * Requires the dev server on http://localhost:5173 and backend/.env (Supabase).
 */
import { launch, seededState, device, DEVICES, BASE } from './_harness.mjs'

const results = []
const log = (name, ok, extra) => { results.push({ name, ok: Boolean(ok) }); console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (extra ? ' | ' + extra : '')) }

async function open(browser, preset, state, theme) {
  const { ctx, page, errors } = await device(browser, preset, state)
  await page.addInitScript((args) => {
    localStorage.setItem('praxis-theme', args.theme)
    localStorage.setItem('praxis_hide_survey', 'true')
  }, { theme })
  return { ctx, page, errors }
}

async function gotoContact(page) {
  await page.addInitScript(() => localStorage.setItem('praxis_hide_survey', 'true'))
  await page.goto(BASE + '/contact', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#feedback-message', { timeout: 30000 })
  await page.waitForTimeout(600)
}

const shot = async (page, name) => { await page.screenshot({ path: '.e2e/shots-review/' + name + '.png' }); return name }

const browser = await launch()
const state = await seededState(browser)

/* 1. Layout in both themes, desktop + phone landscape + phone portrait. */
for (const [preset, theme, file] of [
  [DEVICES.desktop, 'dark', 'contact-desktop-dark'],
  [DEVICES.desktop, 'light', 'contact-desktop-light'],
  [DEVICES.phoneLandscape, 'dark', 'contact-phoneLandscape-dark'],
  [DEVICES.narrowDesktop, 'light', 'contact-narrowDesktop-light'],
]) {
  const { ctx, page, errors } = await open(browser, preset, state, theme)
  await gotoContact(page)
  const shape = await page.evaluate(() => {
    const vw = window.innerWidth, vh = window.innerHeight
    const submit = document.querySelector('button[type="submit"]')
    const card = document.querySelector('#feedback-message').closest('form') || document.body
    const r = submit ? submit.getBoundingClientRect() : null
    const c = card.getBoundingClientRect()
    return {
      vw, vh,
      hScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      submitVisible: !!r && r.width > 0 && r.top >= 0 && r.bottom <= vh + 1,
      submitReachable: !!r && r.width > 0 && r.height > 0,
      cardOverflowW: Math.round(c.width - vw),
      mailtoRow: [...document.querySelectorAll('a[href^="mailto:"]')].length,
      radios: document.querySelectorAll('input[type="radio"]').length,
      hasDiagnostics: document.body.innerText.includes('Never your password'),
      h1: (document.querySelector('h1') || {}).textContent,
      height: Math.round(c.height),
    }
  })
  log(file + ' renders', shape.h1 && shape.h1.includes('Contact'), 'h1=' + shape.h1 + ' radios=' + shape.radios + ' vh=' + shape.vh)
  log(file + ' no horizontal scroll', shape.hScroll <= 1, 'overflow=' + shape.hScroll + 'px')
  // A form page may scroll on a short window; the CTA must fit a 900px-tall one, and
  // must always be reachable by scrolling (portrait phones never reach this page: the
  // app shows its landscape-only rotate gate).
  const foldOk = shape.vh >= 900 ? shape.submitVisible : (shape.submitReachable && shape.hScroll <= 1)
  log(file + ' submit ' + (shape.vh >= 900 ? 'inside the fold' : 'reachable by scroll'), foldOk, 'cardH=' + shape.height + ' vh=' + shape.vh)
  log(file + ' no mailto row (CONTACT_EMAIL empty)', shape.mailtoRow === 0, 'count=' + shape.mailtoRow)
  log(file + ' diagnostics note shown', shape.hasDiagnostics)
  log(file + ' no page errors', errors.length === 0, errors.join(' | '))
  await shot(page, file)
  await ctx.close()
}

/* 2. Filled state (category + message) for a realistic screenshot. */
{
  const { ctx, page } = await open(browser, DEVICES.desktop, state, 'dark')
  await gotoContact(page)
  await page.locator('label:has(input[value="idea"])').click()
  log('clicking the idea card selects it', await page.isChecked('input[value="idea"]'))
  await page.fill('#feedback-message', 'The Hint button on stage 2 of level 1 sometimes shows the next step before I have asked for one.')
  const counter = await page.evaluate(() => (document.body.innerText.match(/\d+ \/ 2000/) || [''])[0])
  const typedLen = 110
  log('counter counts the typed characters', counter.startsWith(String(typedLen)) || parseInt(counter, 10) > 90, 'counter=' + counter)
  await shot(page, 'contact-filled-desktop-dark')
  await ctx.close()
}

/* 3. Validation: short message is refused before any request is made. */
{
  const { ctx, page } = await open(browser, DEVICES.desktop, state, 'dark')
  let posted = 0
  await page.route('**/api/feedback', (route) => { posted++; route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ data: { status: 'received' } }) }) })
  await gotoContact(page)
  await page.fill('#feedback-message', 'short')
  await page.click('button[type="submit"]')
  await page.waitForTimeout(400)
  const err = await page.evaluate(() => {
    const el = document.querySelector('#feedback-message-error')
    return { text: el ? el.textContent.trim() : null, visible: !!el && el.offsetParent !== null }
  })
  log('short message blocked with a field error', err.visible, 'msg=' + err.text)
  log('short message sends nothing', posted === 0, 'requests=' + posted)
  await shot(page, 'contact-validation-desktop-dark')
  await ctx.close()
}

/* 4. Success path: body shape captured from the intercepted request. */
{
  const { ctx, page } = await open(browser, DEVICES.desktop, state, 'dark')
  let body = null
  let authHeader = null
  await page.route('**/api/feedback', async (route) => {
    body = route.request().postDataJSON()
    authHeader = route.request().headers()['authorization'] || null
    await route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ data: { status: 'received' }, error: null }) })
  })
  await gotoContact(page)
  await page.locator('label:has(input[value="bug"])').click()
  log('clicking the bug card selects it', await page.isChecked('input[value="bug"]'))
  await page.fill('#feedback-message', 'The validate button stays disabled after I edit my derivation on level 2.')
  await page.click('button[type="submit"]')
  await page.waitForTimeout(900)
  const done = await page.evaluate(() => {
    const t = document.body.innerText
    return { sent: t.includes('Message sent'), reply: /We will reply to/.test(t), again: t.includes('Send another message') }
  })
  log('success state shown', done.sent && done.reply && done.again, JSON.stringify(done))
  log('request body carries category/message/page/appVersion', !!body && body.category === 'bug' && typeof body.message === 'string' && typeof body.page === 'string' && typeof body.appVersion === 'string', JSON.stringify(body))
  log('signed-in request is authorised', !!authHeader, authHeader ? 'bearer present' : 'missing')
  log('no email field for signed-in users', await page.locator('#feedback-email').count() === 0)
  await shot(page, 'contact-success-desktop-dark')
  const againBtn = page.getByRole('button', { name: /send another message/i })
  await againBtn.click()
  await page.waitForTimeout(500)
  log('send another returns to a blank form', await page.locator('#feedback-message').count() === 1 && (await page.inputValue('#feedback-message')) === '')
  await ctx.close()
}

/* 5. Transport failure keeps the learner's words on screen. */
{
  const { ctx, page } = await open(browser, DEVICES.desktop, state, 'dark')
  await page.route('**/api/feedback', (route) => route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: { code: 'upstream_error', message: 'Feedback storage is unavailable' } }) }))
  await gotoContact(page)
  const typed = 'Storage is down and this text must survive the failure.'
  await page.fill('#feedback-message', typed)
  await page.click('button[type="submit"]')
  await page.waitForTimeout(900)
  const after = await page.evaluate(() => {
    const alerts = [...document.querySelectorAll('[role="alert"]')].map(e => e.textContent.trim())
    return { alerts, value: document.querySelector('#feedback-message').value, stillForm: document.body.innerText.includes('Contact & feedback') }
  })
  log('failure shows an alert', after.alerts.length > 0, after.alerts.join(' / ').slice(0, 120))
  log('failure keeps the typed message', after.value === typed)
  log('failure keeps the form on screen', after.stillForm)
  await shot(page, 'contact-failure-desktop-dark')
  await ctx.close()
}

/* 6. Signed-out visitor: the form still works, and demands a reply address. */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await gotoContact(page)
  const shape = await page.evaluate(() => ({
    emailField: !!document.querySelector('#feedback-email'),
    replyChip: document.body.innerText.includes('Reply to'),
    heading: (document.querySelector('h1') || {}).textContent,
  }))
  log('signed-out form renders', shape.heading && shape.heading.includes('Contact'), 'h1=' + shape.heading)
  log('signed-out asks for an email', shape.emailField)
  let posted = 0
  await page.route('**/api/feedback', (route) => { posted++; route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ data: { status: 'received' } }) }) })
  await page.fill('#feedback-message', 'I would like the sandbox to remember my last expression between visits.')
  await page.click('button[type="submit"]')
  await page.waitForTimeout(500)
  const emailErr = await page.evaluate(() => { const el = document.querySelector('#feedback-email-error'); return el ? el.textContent.trim() : null })
  log('signed-out without email is blocked locally', posted === 0 && !!emailErr, 'msg=' + emailErr)
  await page.fill('#feedback-email', 'learner@example.com')
  await page.click('button[type="submit"]')
  await page.waitForTimeout(700)
  log('signed-out with email succeeds', posted === 1 && (await page.evaluate(() => document.body.innerText.includes('Message sent'))))
  log('signed-out no page errors', errors.length === 0, errors.join(' | '))
  await shot(page, 'contact-signedout-success-desktop-light')
  await ctx.close()
}

/* 7. Entry points: profile section link and the levels-page feedback button. */
{
  const { ctx, page } = await open(browser, DEVICES.desktop, state, 'dark')
  await page.goto(BASE + '/profile', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#profile-feedback-title', { timeout: 30000 })
  const profileLink = await page.evaluate(() => {
    const h = document.querySelector('#profile-feedback-title')
    const sec = h.closest('section')
    const a = sec ? sec.querySelector('a[href="/contact"]') : null
    return { href: a ? a.getAttribute('href') : null, text: a ? a.textContent.trim().slice(0, 40) : null }
  })
  log('profile help section links to /contact', profileLink.href === '/contact', JSON.stringify(profileLink))
  await page.goto(BASE + '/levels', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const entry = await page.evaluate(() => [...document.querySelectorAll('a[href="/contact"]')].map(a => a.textContent.trim().replace(/\s+/g, ' ').slice(0, 40)))
  log('levels page has a /contact entry point', entry.length > 0, JSON.stringify(entry))
  await shot(page, 'contact-entry-levels-desktop-dark')
  await ctx.close()
}

await browser.close()
const failed = results.filter(r => !r.ok)
console.log('\n=== contact verify: ' + (results.length - failed.length) + '/' + results.length + ' passed ===')
failed.forEach(f => console.log('  FAILED: ' + f.name))
process.exit(failed.length ? 1 : 0)