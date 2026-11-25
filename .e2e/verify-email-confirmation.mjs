// Verifies the Supabase email-confirmation surface without sending real mail.
// Every Supabase auth response is intercepted, so this runs offline and is safe
// to repeat. Each case loads a fresh document: arriving at /auth/confirm from an
// email is always a full navigation, and a same-page hash change never re-runs
// the classifier.
import { mkdir } from 'node:fs/promises'

import { launch, BASE as HARNESS_BASE } from './_harness.mjs'

const BASE = process.env.BASE || HARNESS_BASE
const SHOTS = '.e2e/shots-review'
const EMAIL = 'learner@example.test'
const results = []

function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + detail : ''}`)
}

const browser = await launch()
await mkdir(SHOTS, { recursive: true })

async function fresh() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  return { context, page: await context.newPage() }
}

async function bodyText(page) {
  return (await page.locator('body').innerText()).replace(/\s+/g, ' ')
}

// A. The register screen itself.
{
  const { context, page } = await fresh()
  await page.goto(BASE + '/register', { waitUntil: 'networkidle' })
  const text = await bodyText(page)
  check('register renders', text.includes('Start your Praxis account'))
  check('register explains confirmation', /confirm|verif/i.test(text), text.slice(0, 120))
  await context.close()
}

// B. Signup that returns a user but no session -> inbox panel.
{
  const { context, page } = await fresh()
  let signupCalls = 0
  await page.route('**/auth/v1/signup**', async (route) => {
    signupCalls += 1
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      // Verbatim shape measured from the project on 2026-11-25: the pending
      // user sits at the top level, with no `user` and no `session` key.
      body: JSON.stringify({
        id: '11111111-1111-4111-8111-111111111111',
        aud: 'authenticated',
        role: 'authenticated',
        email: EMAIL,
        phone: '',
        confirmation_sent_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        app_metadata: { provider: 'email', providers: ['email'] },
        user_metadata: { name: 'Learner' },
        identities: [],
        is_anonymous: false,
      }),
    })
  })
  await page.goto(BASE + '/register', { waitUntil: 'networkidle' })
  await page.fill('#register-name', 'Learner')
  await page.fill('#register-email', EMAIL)
  await page.fill('#register-password', 'Sup3rSecret!23')
  await page.fill('#register-confirm', 'Sup3rSecret!23')
  await page.click('button[type="submit"]')
  await page.waitForTimeout(1200)
  const text = await bodyText(page)
  check('signup posts to Supabase', signupCalls === 1, 'calls=' + signupCalls)
  check('unconfirmed signup shows the inbox panel', text.includes('Confirm your email'), text.slice(0, 140))
  check('inbox panel names the address', text.includes(EMAIL))
  check('sends a fresh link for the locked address', (await page.getByRole('button', { name: /resend|send (a )?new link/i }).count()) > 0)
  check('does not claim the learner is signed in', !/welcome to praxis/i.test(text))
  check('app did not navigate away on unconfirmed signup', page.url().includes('/register'), page.url())
  await page.screenshot({ path: SHOTS + '/email-register-inbox.png', fullPage: true })
  await context.close()
}

// B2. Signup refused because the hourly mail quota is spent -> an inline, re-readable
// explanation. Measured 2026-11-25: that answer creates no account at all, so the
// copy must not tell the learner to check an inbox.
{
  const { context, page } = await fresh()
  let signupCalls = 0
  await page.route('**/auth/v1/signup**', async (route) => {
    signupCalls += 1
    await route.fulfill({
      status: 429,
      contentType: 'application/json',
      body: JSON.stringify({ code: 429, error_code: 'over_email_send_rate_limit', msg: 'email rate limit exceeded' }),
    })
  })
  await page.goto(BASE + '/register', { waitUntil: 'networkidle' })
  await page.fill('#register-name', 'Learner')
  await page.fill('#register-email', EMAIL)
  await page.fill('#register-password', 'Sup3rSecret!23')
  await page.fill('#register-confirm', 'Sup3rSecret!23')
  await page.click('button[type="submit"]')
  await page.waitForTimeout(1200)
  const text = await bodyText(page)
  const alert = page.locator('#register-submit-error')
  check('rate-limited signup posts once', signupCalls === 1, 'calls=' + signupCalls)
  check('rate-limited signup shows an inline alert', (await alert.count()) === 1)
  check('alert says the account was not created', /not created/i.test(await alert.innerText()))
  check('alert tells the learner to come back later', /hour/i.test(await alert.innerText()))
  check('no inbox panel is promised for a mail never sent', !text.includes('Confirm your email'))
  check('no success is claimed', !/welcome to praxis/i.test(text))
  check('the typed address survives the refusal', (await page.inputValue('#register-email')) === EMAIL)
  check('app stayed on the register screen', page.url().includes('/register'), page.url())
  await page.screenshot({ path: SHOTS + '/email-register-rate-limited.png', fullPage: true })
  await context.close()
}

// C. Sign-in of an unconfirmed account -> amber notice, not a credentials error.
{
  const { context, page } = await fresh()
  await page.route('**/auth/v1/token**', async (route) => {
    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 400,
        error_code: 'email_not_confirmed',
        error: 'invalid_grant',
        error_description: 'Email not confirmed',
        msg: 'Email not confirmed',
      }),
    })
  })
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
  await page.fill('#login-email', EMAIL)
  await page.fill('#login-password', 'Sup3rSecret!23')
  await page.click('button[type="submit"]')
  await page.waitForTimeout(1200)
  const text = await bodyText(page)
  check('unconfirmed sign-in shows the notice', text.includes('Confirm your email to continue'), text.slice(0, 160))
  check('notice explains what to do', /open the link we emailed you/i.test(text))
  check('resend form is locked to the account address', (await page.locator('#login-resend-email').count()) === 0)
  check('notice offers a resend', (await page.getByRole('button', { name: /resend/i }).count()) > 0)
  check('no wrong-password error is shown', !/invalid email or password/i.test(text))
  await page.screenshot({ path: SHOTS + '/email-login-unconfirmed.png', fullPage: true })
  await context.close()
}

// D. An expired or tampered link is reported as an expired link.
{
  const { context, page } = await fresh()
  await page.goto(
    BASE + '/auth/confirm#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
    { waitUntil: 'networkidle' },
  )
  await page.waitForTimeout(600)
  const text = await bodyText(page)
  check('expired link is reported', text.includes("We couldn't confirm that link"), text.slice(0, 160))
  check('expired link explains the cause', /expired|already been used|one use/i.test(text))
  check('raw description is not echoed', !text.includes('Email link is invalid or has expired'))
  check('expired link offers a resend', (await page.locator('#confirm-resend-email').count()) > 0)
  await page.screenshot({ path: SHOTS + '/email-link-expired.png', fullPage: true })
  await context.close()
}

// E. A bare visit to the confirmation route stays recoverable.
{
  const { context, page } = await fresh()
  await page.goto(BASE + '/auth/confirm', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  const text = await bodyText(page)
  check('bare confirm route is recoverable', text.includes('Open the link from your email'), text.slice(0, 140))
  check('recoverable state offers a resend', (await page.locator('#confirm-resend-email').count()) > 0)
  await context.close()
}

// F. A token fragment the SDK cannot use must not claim success.
{
  const { context, page } = await fresh()
  await page.goto(BASE + '/auth/confirm#access_token=abc&refresh_token=def&type=signup', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  const text = await bodyText(page)
  check('bad token does not claim confirmation', !text.includes('Email confirmed. You can continue'))
  check('bad token falls back to a recoverable state', /Open the link from your email|Checking your confirmation link/.test(text), text.slice(0, 140))
  await context.close()
}

// G. The rest of the auth surface still renders.
for (const [path, needle] of [
  ['/login', 'Sign in to Praxis'],
  ['/forgot-password', 'Reset your password'],
  ['/reset-password', 'no longer valid'],
]) {
  const { context, page } = await fresh()
  await page.goto(BASE + path, { waitUntil: 'networkidle' })
  check(`${path} renders`, (await bodyText(page)).includes(needle))
  await context.close()
}

await browser.close()

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`)
if (failed.length) {
  for (const f of failed) console.log('  FAILED: ' + f.name + (f.detail ? ' :: ' + f.detail : ''))
  process.exitCode = 1
}
