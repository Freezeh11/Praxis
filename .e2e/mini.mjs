import { chromium } from '/home/xris/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core/index.mjs'

const browser = await chromium.launch({
  executablePath: '/home/xris/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',
  args: ['--no-sandbox', '--disable-gpu', '--no-zygote', '--disable-dev-shm-usage'],
})
const page = await browser.newPage()
await page.addInitScript(() => localStorage.setItem('praxis_hide_survey', 'true'))

await page.goto('http://127.0.0.1:5173/sandbox', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2000)
const title = await page.title()
const text = (await page.locator('body').innerText()).slice(0, 200)
console.log('TITLE:', title)
console.log('BODY:', text)
await browser.close()
console.log('OK')
