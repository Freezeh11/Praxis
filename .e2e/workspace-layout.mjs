/** Workspace layout probe: the stage list must stay visible in the right rail
 * on every tier, and a touchscreen laptop must keep the desktop layout.
 * Supabase + progress API are mocked; no real accounts, no writes.
 * node .e2e/workspace-layout.mjs
 */
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
import {mkdir} from 'node:fs/promises'
import path from 'node:path'
import {createServer} from '../frontend/node_modules/vite/dist/node/index.js'

const require=createRequire(import.meta.url)
const {chromium}=require(process.env.PRAXIS_PLAYWRIGHT_MODULE || 'playwright')
const root=fileURLToPath(new URL('../frontend',import.meta.url))
const resultDir=fileURLToPath(new URL('./_results',import.meta.url))
process.chdir(root)
process.env.VITE_SUPABASE_URL='https://praxis-test.invalid'
process.env.VITE_SUPABASE_PUBLISHABLE_KEY='isolated-test-key'
const server=await createServer({root,configFile:path.join(root,'vite.config.js'),define:{'import.meta.env.VITE_SUPABASE_URL':JSON.stringify('https://praxis-test.invalid'),'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY':JSON.stringify('isolated-test-key')},server:{host:'127.0.0.1',port:5196,strictPort:true,open:false}})
await server.listen()
const base=server.resolvedUrls.local[0]
const browser=await chromium.launch({headless:true})
await mkdir(resultDir,{recursive:true})
const passed=[],failed=[]
const check=(name,ok,detail='')=>{(ok?passed:failed).push(name);console.log(ok?'PASS':'FAIL',name,detail)}

const user={id:'00000000-0000-4000-8000-000000000003',aud:'authenticated',role:'authenticated',email:'layout@example.test',created_at:'2026-01-01T00:00:00Z',app_metadata:{provider:'email'},user_metadata:{name:'Layout learner'}}
const now=Math.floor(Date.now()/1000)
const token=[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:user.id,aud:'authenticated',exp:now+3600,iat:now})).toString('base64url'),'sig'].join('.')
const session={access_token:token,refresh_token:'layout-refresh',token_type:'bearer',expires_in:3600,expires_at:now+3600,user}
const progress={points:167,streak:6,bestStreak:6,stageProgress:{'0':[0,1,2,3],'1':[0,1,2,3,4,5]},stageScores:Object.fromEntries(Array.from({length:8},(_,i)=>['1:'+i,90]))}

async function contextFor({viewport,hasTouch=false,isMobile=false,spoofTouchPoints=false,theme='dark'}){
  const ctx=await browser.newContext({viewport,hasTouch,isMobile,deviceScaleFactor:1})
  await ctx.addInitScript(({spoof,theme})=>{
    try{localStorage.setItem('praxis-theme',theme)}catch{}
    if(spoof){
      Object.defineProperty(navigator,'maxTouchPoints',{get:()=>5,configurable:true})
      window.ontouchstart=null
    }
  },{spoof:spoofTouchPoints,theme})
  await ctx.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url())
    const json=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)})
    if(url.hostname==='praxis-test.invalid'){
      if(url.pathname.endsWith('/token'))return json(session)
      if(url.pathname.endsWith('/user'))return json(user)
      if(url.pathname.endsWith('/logout'))return route.fulfill({status:204})
      return json(session)
    }
    if(url.origin===new URL(base).origin){
      if(url.pathname==='/api/progress'&&req.method()==='GET')return json({success:true,data:progress,error:null})
      if(url.pathname.startsWith('/api/'))return json({success:true,data:{status:'ok'},error:null})
      return route.continue()
    }
    return route.abort('blockedbyclient')
  })
  const page=await ctx.newPage();page.setDefaultTimeout(15000)
  await page.goto(base+'login')
  await page.locator('input[type="email"]').fill(user.email)
  await page.locator('input[type="password"]').fill('local-test-password')
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(base)
  return {ctx,page}
}

async function inspect(theme,name,opts){
  const {ctx,page}=await contextFor({...opts,theme})
  const media=await page.evaluate(()=>({coarse:matchMedia('(pointer: coarse)').matches,points:navigator.maxTouchPoints}))
  await page.goto(base+'level/1/stage/1')
  await page.locator('[data-tutorial="active-equation"]').waitFor()
  await page.waitForTimeout(600)
  const state=await page.evaluate(()=>{
    const stages=[...document.querySelectorAll('span')].some(el=>el.textContent.trim()==='STAGES'&&el.checkVisibility())
    const laws=document.querySelector('[data-testid="laws-list"]')
    const aside=document.querySelector('aside')
    return {stages,lawsLayout:laws?.getAttribute('data-layout')??null,asideWidth:aside?Math.round(aside.getBoundingClientRect().width):0,pointsInHeader:!!document.querySelector('header [data-testid="points-chip"]')}
  })
  check(name+': STAGES list is visible',state.stages)
  check(name+': law palette sits in the bottom dock',state.lawsLayout!==null,state.lawsLayout||'missing')
  console.log('   state',JSON.stringify({...state,...media}))
  await page.screenshot({path:path.join(resultDir,'layout-'+name+'.png'),fullPage:false})
  await ctx.close()
  return state
}

await inspect('desktop','dark',{viewport:{width:1440,height:900}})
await inspect('hybrid-touch','dark',{viewport:{width:1687,height:969},spoofTouchPoints:true})
await inspect('tablet-landscape','dark',{viewport:{width:1024,height:768},hasTouch:true,isMobile:true})
await inspect('tablet-landscape-light','light',{viewport:{width:1024,height:768},hasTouch:true,isMobile:true,theme:'light'})

await browser.close()
await server.close()
console.log(JSON.stringify({passed:passed.length,failed:failed.length,failures:failed}))
process.exit(failed.length?1:0)
