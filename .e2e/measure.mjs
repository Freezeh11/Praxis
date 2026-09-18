import { readFileSync } from 'node:fs'
import { chromium } from '/home/xris/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core/index.mjs'

const BASE = 'http://127.0.0.1:5173'
const EMAIL = 'e2e-test@praxis.test'
const PASSWORD = 'E2eTest!2345'

const envText = readFileSync('/home/xris/Documents/GitHub/Praxis/backend/.env', 'utf8')
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=')).map(l => {
  const [k, ...rest] = l.split('=')
  return [k.trim(), rest.join('=').trim().replace(/^"|"$/g, '')]
}))
const SERVICE_KEY = env.SUPABASE_SERVICE_KEY
const authHeaders = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }

const browser = await chromium.launch({
  executablePath: '/home/xris/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',
  args: ['--no-sandbox', '--disable-gpu', '--no-zygote', '--disable-dev-shm-usage'],
})

const DEVICES = [
  { name: 'iPhone-SE-2016', viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true },
  { name: 'iPhone-8', viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true },
  { name: 'iPhone-X-14', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  { name: 'iPad-2017-P', viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true },
]

for (const dev of DEVICES) {
  const ctx = await browser.newContext(dev)
  const page = await ctx.newPage()
  await page.addInitScript(() => localStorage.setItem('praxis_hide_survey', 'true'))
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForTimeout(2500)

  for (const [label, path] of [['problem', '/level/1/stage/0'], ['tutorial', '/tutorial'], ['practice', '/practice']]) {
    await page.goto(BASE + path, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1200)
    const m = await page.evaluate(() => {
      const vw = window.innerWidth
      const vh = window.innerHeight
      const asides = [...document.querySelectorAll('aside')].map(a => {
        const r = a.getBoundingClientRect()
        return { w: Math.round(r.width), h: Math.round(r.height), visible: r.width > 20 && r.right > 0 && r.left < vw }
      })
      const main = document.querySelector('main')
      const mr = main ? main.getBoundingClientRect() : null
      const expr = [...document.querySelectorAll('main, [data-path]')].length
      // law bar buttons
      const lawBar = [...document.querySelectorAll('button')].find(b => b.textContent.includes('APPLICABLE'))
      return {
        vw, vh,
        asides,
        main: mr ? { w: Math.round(mr.width), x: Math.round(mr.x), visible: mr.width > 20 } : null,
        exprEls: expr,
      }
    })
    console.log(`${dev.name} ${label}: vw=${m.vw} asides=${JSON.stringify(m.asides)} main=${JSON.stringify(m.main)}`)
  }
  await ctx.close()
}
await browser.close()
