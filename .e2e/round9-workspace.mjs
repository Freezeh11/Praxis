/** Round-9 workspace verification on a landscape phone. */
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
import path from 'node:path'
import {createServer} from '../frontend/node_modules/vite/dist/node/index.js'
import levels from '../content/levels.json' with {type:'json'}
import {estimateScore} from '../frontend/src/engine/scoring.js'

const require=createRequire(import.meta.url)
const {chromium}=require(process.env.PRAXIS_PLAYWRIGHT_MODULE || 'playwright')
const root=fileURLToPath(new URL('../frontend',import.meta.url))
process.chdir(root)
process.env.VITE_SUPABASE_URL='https://praxis-test.invalid'
process.env.VITE_SUPABASE_PUBLISHABLE_KEY='isolated-test-key'
const server=await createServer({root,configFile:path.join(root,'vite.config.js'),
  define:{'import.meta.env.VITE_SUPABASE_URL':JSON.stringify('https://praxis-test.invalid'),'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY':JSON.stringify('isolated-test-key')},
  server:{host:'127.0.0.1',port:5201,strictPort:true,open:false}})
let browser;const passed=[],failed=[]
const check=async(name,fn)=>{try{await fn();passed.push(name);console.log('PASS',name)}catch(e){failed.push([name,e.message]);console.log('FAIL',name,e.message)}}
try{
 await server.listen();const base=server.resolvedUrls.local[0]
 browser=await chromium.launch({headless:true,channel:'chromium'})
 const user={id:'00000000-0000-4000-8000-000000000001',aud:'authenticated',role:'authenticated',email:'learner@example.test',created_at:'2026-01-01T00:00:00Z',app_metadata:{provider:'email'},user_metadata:{name:'Test learner'}}
 const now=Math.floor(Date.now()/1000)
 const token=[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:user.id,aud:'authenticated',exp:now+3600,iat:now})).toString('base64url'),'sig'].join('.')
 const session={access_token:token,refresh_token:'r',token_type:'bearer',expires_in:3600,expires_at:now+3600,user}
 const ctx=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true})
 let progress={points:200,streak:6,bestStreak:6,stageProgress:{'0':[0,1,2,3],'1':[0,1,2,3,4,5]},stageScores:Object.fromEntries(Array.from({length:6},(_,i)=>[`1:${i}`,100]))}
 await ctx.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url())
  const json=(d,s=200)=>route.fulfill({status:s,contentType:'application/json',body:JSON.stringify(d)})
  if(url.hostname==='praxis-test.invalid')return url.pathname.endsWith('/token')?json(session):url.pathname.endsWith('/user')?json(user):url.pathname.endsWith('/logout')?route.fulfill({status:204}):json(session)
  if(url.origin===new URL(base).origin){
   if(url.pathname==='/api/progress'&&req.method()==='GET')return json({success:true,data:progress,error:null})
   if(url.pathname==='/api/progress/save'){progress=structuredClone(req.postDataJSON().progress);return json({success:true,data:{status:'ok'},error:null})}
   if(url.pathname==='/api/score'){const p=req.postDataJSON();const puzzle=levels.find(l=>l.id===p.levelId).puzzles[p.stageIdx];return json({success:true,data:estimateScore({...p,targetLaws:puzzle.targetLaws}),error:null})}
   if(url.pathname.startsWith('/api/'))return json({success:false,error:{code:'not_found',message:'Unknown'}},404)
   return route.continue()
  }
  return route.abort('blockedbyclient')
 })
 const page=await ctx.newPage();page.setDefaultTimeout(15000)
 await page.goto(base+'login');await page.locator('input[type="email"]').fill(user.email);await page.locator('input[type="password"]').fill('local-test-password');await page.locator('button[type="submit"]').click();await page.waitForURL(base)
 const ready=async()=>{await page.goto(base+'level/1/stage/7');await page.locator('[data-tutorial="active-equation"]').waitFor()}
 await ready()
 await check('landscape rail controls stay inside the viewport',async()=>{
  const boxes=await page.locator('header button, header [role="switch"]').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {name:(el.getAttribute('aria-label')||el.textContent||'').trim().slice(0,28),x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)}}).filter(b=>b.w>0&&b.h>0))
  const hidden=boxes.filter(b=>b.x<0||b.x+b.w>845)
  assert.deepEqual(hidden,[],'off-screen controls: '+JSON.stringify(hidden))
  assert.equal(await page.evaluate(()=>{const el=document.querySelector('.praxis-rail');return el.scrollWidth-el.clientWidth}),0)
 })
 await check('escape closes the step-history overlay',async()=>{
  await page.locator('[data-testid="step-history-toggle"]').first().click()
  await page.locator('[data-testid="step-history-drawer"]').waitFor()
  await page.keyboard.press('Escape')
  await page.waitForFunction(()=>{const el=document.querySelector('[data-testid="step-history-drawer"]');return !el||el.getAttribute('aria-hidden')==='true'||getComputedStyle(el).display==='none'})
 })
 await check('reset asks before discarding an in-progress derivation',async()=>{
  await page.locator('[data-law-id="demorgan"]').click()
  await page.locator('[data-tutorial="active-equation"] [data-tutorial="not-bar"]').first().click()
  await page.locator('[data-testid="apply-selected-law"]').click()
  await page.waitForFunction(()=>document.querySelectorAll('[data-tutorial="past-equation"]').length===1)
  await page.locator('button[title="Reset problem to start"]').first().click()
  const dialog=page.getByRole('dialog').filter({hasText:/reset/i})
  await dialog.waitFor()
  await page.keyboard.press('Escape')
  await dialog.waitFor({state:'detached'})
  assert.equal(await page.locator('[data-tutorial="past-equation"]').count(),1)
 })
 await check('beforeunload is cancelled while a derivation is dirty',async()=>{
  const prevented=await page.evaluate(()=>{const e=new Event('beforeunload',{cancelable:true});return !window.dispatchEvent(e)})
  assert.equal(prevented,true)
 })
 await check('escape closes the stage-complete modal',async()=>{
  await page.locator('[data-testid="step-history-toggle"]').first().click()
  await page.keyboard.press('Escape')
  await page.locator('[data-tutorial="guide-button"]').first().click()
  await page.getByText(/Guide: press Apply/).first().waitFor()
  await page.locator('[data-testid="apply-selected-law"]').click()
  await page.locator('[data-tutorial="score-modal"]').waitFor()
  await page.keyboard.press('Escape')
  await page.locator('[data-tutorial="score-modal"]').waitFor({state:'detached'})
 })
 console.log(`\n${passed.length} passed, ${failed.length} failed`)
 if(failed.length){console.log(JSON.stringify(failed,null,2));process.exitCode=1}
}finally{await browser?.close();await server.close()}
