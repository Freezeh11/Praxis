import {createRequire} from 'node:module'
import {readFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import path from 'node:path'
const require=createRequire(import.meta.url)
const {chromium}=require(process.env.PRAXIS_PLAYWRIGHT_MODULE || 'playwright')
const here=fileURLToPath(new URL('.',import.meta.url))
const svg=await readFile(path.join(here,'../frontend/public/favicon.svg'),'utf8')
const data='data:image/svg+xml;base64,'+Buffer.from(svg).toString('base64')
const browser=await chromium.launch({headless:true})
const page=await browser.newPage({viewport:{width:180,height:180},deviceScaleFactor:1})
await page.setContent('<body style="margin:0"><img src="'+data+'" width="180" height="180" style="display:block"></body>')
await page.waitForTimeout(250)
await page.screenshot({path:path.join(here,'../frontend/public/apple-touch-icon.png')})
await browser.close()
console.log('written')
