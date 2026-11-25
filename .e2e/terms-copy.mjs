/** Terms and Conditions dialog: copy alignment + mobile rendering.
 * Mocked Supabase only; no real accounts or network writes.
 * node .e2e/terms-copy.mjs
 */
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
import {mkdir} from 'node:fs/promises'
import path from 'node:path'
import {createServer} from '../frontend/node_modules/vite/dist/node/index.js'

const require=createRequire(import.meta.url)
const {chromium}=require(process.env.PRAXIS_PLAYWRIGHT_MODULE || 'playwright')
const root=fileURLToPath(new URL('../frontend',import.meta.url))
const resultDir=fileURLToPath(new URL('./_results/qa',import.meta.url))
process.chdir(root)
process.env.VITE_SUPABASE_URL='https://praxis-test.invalid'
process.env.VITE_SUPABASE_PUBLISHABLE_KEY='isolated-test-key'
const server=await createServer({root,configFile:path.join(root,'vite.config.js'),define:{'import.meta.env.VITE_SUPABASE_URL':JSON.stringify('https://praxis-test.invalid'),'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY':JSON.stringify('isolated-test-key')},server:{host:'127.0.0.1',port:5317,strictPort:true,open:false}})
await server.listen()
const base=server.resolvedUrls.local[0].replace(/\/$/,'')
await mkdir(resultDir,{recursive:true})
const browser=await chromium.launch({headless:true})
const passed=[],failed=[]
const check=(name,ok,detail='')=>{ (ok?passed:failed).push(name); console.log(ok?'PASS':'FAIL',name,detail||'') }

const REQUIRED=[
  'interactive web-based trainer for Boolean algebra simplification',
  'two-, three- and four-variable',
  'ten Boolean equivalence laws',
  'no instructor dashboards, institutional grading or curriculum management',
  'Supabase',
  'averages at least 80%',
  '10 points',
  '20 points',
  'three stars',
  'Sandbox practice never records points',
  'score history',
  'feedback survey',
]
const FORBIDDEN=['streak','circuit attempts','circuit puzzles','support option in your account','Praxis staff']

async function openDialog(page){
  await page.goto(base+'/login',{waitUntil:'networkidle'})
  await page.getByRole('button',{name:'Terms and Conditions'}).click()
  const dialog=page.getByRole('dialog',{name:'Terms and Conditions'})
  await dialog.waitFor({state:'visible'})
  return dialog
}

const cases=[['mobile',{width:360,height:800},'light'],['desktop',{width:1440,height:900},'dark']]
for(const [label,viewport,theme] of cases){
  const ctx=await browser.newContext({viewport})
  await ctx.addInitScript(t=>{try{localStorage.setItem('praxis-theme',t)}catch{}},theme)
  await ctx.route('**/*',async route=>{
    const url=new URL(route.request().url())
    const json=d=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(d)})
    if(url.hostname==='praxis-test.invalid') return json({})
    if(url.pathname.startsWith('/api/')) return json({})
    return route.continue()
  })
  const page=await ctx.newPage()
  const errors=[]; page.on('pageerror',e=>errors.push(String(e)))
  const dialog=await openDialog(page)
  const text=await dialog.innerText()
  const missing=REQUIRED.filter(s=>!text.includes(s))
  const leaked=FORBIDDEN.filter(s=>text.toLowerCase().includes(s.toLowerCase()))
  check(label+' copy has every aligned statement',missing.length===0,missing.join(' | '))
  check(label+' no stale wording',leaked.length===0,leaked.join(' | '))
  check(label+' dialog is modal',(await dialog.getAttribute('aria-modal'))==='true')
  const sections=await dialog.locator('section').count()
  check(label+' eight sections',sections===8,String(sections))
  const body=dialog.locator('div.overflow-y-auto').first()
  const scroll=await body.evaluate(el=>({sh:el.scrollHeight,ch:el.clientHeight}))
  check(label+' body scrolls instead of overflowing the viewport',scroll.sh>scroll.ch&&scroll.ch>0,JSON.stringify(scroll))
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)
  check(label+' no horizontal overflow',overflow===0,String(overflow))
  await page.screenshot({path:path.join(resultDir,'terms-'+label+'-'+theme+'.png')})
  await page.keyboard.press('Escape')
  await dialog.waitFor({state:'detached'})
  const returned=await page.evaluate(()=>document.activeElement && document.activeElement.textContent ? document.activeElement.textContent.trim() : '')
  check(label+' Escape restores focus to the trigger',returned==='Terms and Conditions',String(returned))
  check(label+' no page errors',errors.length===0,errors.join(' | '))
  await ctx.close()
}

await browser.close(); await server.close()
console.log('\n'+passed.length+' passed, '+failed.length+' failed')
process.exit(failed.length?1:0)
