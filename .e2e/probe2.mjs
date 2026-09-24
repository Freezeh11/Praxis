import { readFileSync } from 'node:fs'
import { chromium } from '/home/xris/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core/index.mjs'

const BASE = 'http://127.0.0.1:5173'
const EMAIL = 'e2e-test@praxis.test'
const PASSWORD = 'E2eTest!2345'

const browser = await chromium.launch({
  executablePath: '/home/xris/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',
  args: ['--no-sandbox', '--disable-gpu', '--no-zygote', '--disable-dev-shm-usage'],
})

const DEVICES = [
  { name: 'SE-320', viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true },
  { name: 'X-390', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  { name: 'iPadP-768', viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true },
]

const envText = readFileSync('/home/xris/Documents/GitHub/Praxis/backend/.env', 'utf8')
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=')).map(l => {
  const [k, ...rest] = l.split('=')
  return [k.trim(), rest.join('=').trim().replace(/^"|"$/g, '')]
}))

for (const dev of DEVICES) {
  const ctx = await browser.newContext(dev)
  const page = await ctx.newPage()
  await page.addInitScript(() => localStorage.setItem('praxis_hide_survey', 'true'))
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForTimeout(2500)

  for (const [label, path] of [['levels', '/levels'], ['stages', '/level/1/stages'], ['landing', '/'], ['register', '/register'], ['login', '/login']]) {
    await page.goto(BASE + path, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)
    const m = await page.evaluate(() => {
      const vw = window.innerWidth
      const out = []
      // buttons/links that stick out beyond the viewport
      document.querySelectorAll('button, a').forEach(el => {
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.height === 0) return
        const label = (el.textContent || '').trim().slice(0, 24)
        if (r.right > vw + 2 || r.left < -2) {
          out.push({ label, right: Math.round(r.right), left: Math.round(r.left), w: Math.round(r.width) })
        }
      })
      const h1 = document.querySelector('h1')
      return {
        vw,
        outOfBounds: out.slice(0, 8),
        h1Size: h1 ? getComputedStyle(h1).fontSize : null,
        h1Text: h1 ? h1.textContent.trim().slice(0, 40) : null,
      }
    })
    console.log(`${dev.name} ${label}: vw=${m.vw} h1=${m.h1Size}${m.outOfBounds.length ? ' OUT: ' + JSON.stringify(m.outOfBounds) : ''}`)
  }
  await ctx.close()
}
await browser.close()
