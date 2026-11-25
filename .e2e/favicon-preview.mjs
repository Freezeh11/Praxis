import {createRequire} from 'node:module'
import {readFile, mkdir} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import path from 'node:path'
const require=createRequire(import.meta.url)
const {chromium}=require(process.env.PRAXIS_PLAYWRIGHT_MODULE || 'playwright')
const here=fileURLToPath(new URL('.',import.meta.url))
const svg=await readFile(path.join(here,'../frontend/public/favicon.svg'),'utf8')
const data='data:image/svg+xml;base64,'+Buffer.from(svg).toString('base64')
await mkdir(path.join(here,'_results'),{recursive:true})
const browser=await chromium.launch({headless:true})
const page=await browser.newPage({viewport:{width:520,height:220}})
const img=n=>'<img src="'+data+'" width="'+n+'" height="'+n+'" style="display:block">'
await page.setContent('<body style="margin:0;display:flex;gap:0;font:12px system-ui">'+
 '<div style="background:#F8FAFC;padding:18px 22px;display:flex;gap:22px;align-items:flex-end">'+img(16)+img(32)+img(48)+img(64)+'</div>'+
 '<div style="background:#0B0F19;padding:18px 22px;display:flex;gap:22px;align-items:flex-end">'+img(16)+img(32)+img(48)+img(64)+'</div></body>')
await page.waitForTimeout(300)
await page.screenshot({path:path.join(here,'_results','favicon-preview.png'),fullPage:true})
await browser.close()
console.log('ok')
