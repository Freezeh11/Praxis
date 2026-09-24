import { readFileSync } from 'node:fs'
import { chromium, devices } from '/home/xris/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core/index.mjs'

const BASE = 'http://127.0.0.1:5173'
const EMAIL = 'e2e-test@praxis.test'
const PASSWORD = 'E2eTest!2345'

const DEVICES = [
  { name: 'iPhone-SE-2016', viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  { name: 'iPhone-8', viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  { name: 'iPhone-X-14', viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  { name: 'iPhone-ProMax', viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  { name: 'Galaxy-S8', viewport: { width: 360, height: 740 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  { name: 'Galaxy-Fold', viewport: { width: 280, height: 653 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  { name: 'iPad-2017-P', viewport: { width: 768, height: 1024 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  { name: 'iPad-2017-L', viewport: { width: 1024, height: 768 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  { name: 'iPadPro-12.9', viewport: { width: 1024, height: 1366 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
]

const ROUTES = [
  { path: '/', label: 'landing' },
  { path: '/login', label: 'login' },
  { path: '/register', label: 'register' },
  { path: '/tutorial', label: 'tutorial' },
]

const envText = readFileSync('/home/xris/Documents/GitHub/Praxis/backend/.env', 'utf8')
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=')).map(l => {
  const [k, ...rest] = l.split('=')
  return [k.trim(), rest.join('=').trim().replace(/^"|"$/g, '')]
}))
const SERVICE_KEY = env.SUPABASE_SERVICE_KEY
const authHeaders = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
const adminRes = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/admin/users?page=1&per_page=50`, { headers: authHeaders })
const adminData = await adminRes.json()
const user = (adminData.users || []).find(u => u.email === EMAIL)

const browser = await chromium.launch({
  executablePath: '/home/xris/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',
  args: ['--no-sandbox', '--disable-gpu', '--no-zygote', '--disable-dev-shm-usage'],
})

const report = []

for (const dev of DEVICES) {
  const ctx = await browser.newContext({ ...dev, deviceScaleFactor: dev.deviceScaleFactor || 1 })
  const page = await ctx.newPage()
  await page.addInitScript(() => localStorage.setItem('praxis_hide_survey', 'true'))

  // Login once per device context for protected routes
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
  try {
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForTimeout(2500)
  } catch {}

  const routes = [
    ...ROUTES,
    { path: '/levels', label: 'levels' },
    { path: '/level/1/stages', label: 'stage-select' },
    { path: '/level/1/stage/0', label: 'problem' },
  ]

  for (const r of routes) {
    await page.goto(BASE + r.path, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1200)
    const metrics = await page.evaluate(() => {
      const vw = window.innerWidth
      const sw = document.documentElement.scrollWidth
      const overflow = sw > vw + 1

      // Elements wider than the viewport (likely overflow offenders)
      const offenders = []
      document.querySelectorAll('body *').forEach(el => {
        const r = el.getBoundingClientRect()
        if (r.width > vw + 4 && r.width < 4000) {
          const cls = (typeof el.className === 'string' ? el.className : '').slice(0, 60)
          offenders.push({ tag: el.tagName, cls, w: Math.round(r.width), x: Math.round(r.x) })
        }
      })
      offenders.sort((a, b) => b.w - a.w)

      // Small tap targets (interactive elements < 32px in either dimension)
      let smallTaps = 0
      document.querySelectorAll('button, a, input, [role="button"]').forEach(el => {
        const r = el.getBoundingClientRect()
        if (r.width > 0 && r.height > 0 && (r.width < 32 || r.height < 32)) smallTaps++
      })

      // Font size of the main heading-ish text
      const h1 = document.querySelector('h1')
      return {
        vw, sw, overflow,
        offenders: offenders.slice(0, 4),
        smallTaps,
        h1: h1 ? getComputedStyle(h1).fontSize : null,
        scrollableX: overflow,
      }
    })
    report.push({
      device: dev.name,
      route: r.label,
      vw: metrics.vw,
      overflow: metrics.overflow,
      offenders: metrics.offenders,
      smallTaps: metrics.smallTaps,
      h1: metrics.h1,
    })
  }
  await ctx.close()
}

await browser.close()

// Print summary
let overflowCount = 0
for (const row of report) {
  if (row.overflow) {
    overflowCount++
    console.log(`OVERFLOW ${row.device} ${row.route} (vw=${row.vw}):`)
    row.offenders.forEach(o => console.log(`   ${o.tag}.${o.cls} w=${o.w} x=${o.x}`))
  }
  if (row.smallTaps > 0 && row.route === 'problem') {
    console.log(`SMALL-TAPS ${row.device} ${row.route}: ${row.smallTaps}`)
  }
}
console.log(`\nTOTAL: ${report.length} checks, ${overflowCount} overflow issues`)
