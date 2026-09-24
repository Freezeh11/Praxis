import { readFileSync } from 'node:fs'
import { chromium } from '/home/xris/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core/index.mjs'

const BASE = 'http://127.0.0.1:5173'
const EMAIL = 'e2e-test@praxis.test'
const PASSWORD = 'E2eTest!2345'

const browser = await chromium.launch({
  executablePath: '/home/xris/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',
  args: ['--no-sandbox', '--disable-gpu', '--no-zygote', '--disable-dev-shm-usage'],
})

const LANDSCAPE = [
  { name: 'iPhone-SE-L', viewport: { width: 568, height: 320 }, isMobile: true, hasTouch: true },
  { name: 'iPhone-X-L', viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true },
]

for (const dev of LANDSCAPE) {
  const ctx = await browser.newContext(dev)
  const page = await ctx.newPage()
  await page.addInitScript(() => localStorage.setItem('praxis_hide_survey', 'true'))
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.tap('button[type="submit"]')
  await page.waitForTimeout(2500)

  for (const [label, path] of [['problem', '/level/1/stage/0'], ['levels', '/levels']]) {
    await page.goto(BASE + path, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1200)
    const m = await page.evaluate(() => {
      const vw = window.innerWidth
      const vh = window.innerHeight
      // vertical overflow inside the page root
      const bodyScroll = document.documentElement.scrollHeight > vh + 1
      // main workspace visible height
      const main = document.querySelector('main')
      const mainH = main ? Math.round(main.getBoundingClientRect().height) : 0
      return { vw, vh, bodyScroll, mainH }
    })
    console.log(`${dev.name} ${label}: ${JSON.stringify(m)}${m.bodyScroll ? '  ⚠ vertical scroll' : ''}`)
  }
  await ctx.close()
}
await browser.close()
