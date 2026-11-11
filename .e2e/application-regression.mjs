/** Real SPA routes and components; Auth/API responses isolated in Playwright.
 * No real user accounts or shared database writes.
 * node .e2e/application-regression.mjs
 */
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
import {mkdir, writeFile} from 'node:fs/promises'
import path from 'node:path'
import {createServer} from '../frontend/node_modules/vite/dist/node/index.js'
import {estimateScore} from '../frontend/src/engine/scoring.js'
import {parseExpr,canonText,planGuidance} from '../frontend/src/engine/index.js'
import levels from '../content/levels.json' with {type:'json'}

const require=createRequire(import.meta.url)
const {chromium}=require(process.env.PRAXIS_PLAYWRIGHT_MODULE || 'playwright')
const root=fileURLToPath(new URL('../frontend',import.meta.url))
const resultDir=fileURLToPath(new URL('./_results',import.meta.url))
process.chdir(root)
// The dev CSP narrows connect-src to the configured Supabase origin; tests mock that origin.
process.env.VITE_SUPABASE_URL='https://praxis-test.invalid'
process.env.VITE_SUPABASE_PUBLISHABLE_KEY='isolated-test-key'
const server=await createServer({root,configFile:path.join(root,'vite.config.js'),
  define:{'import.meta.env.VITE_SUPABASE_URL':JSON.stringify('https://praxis-test.invalid'),'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY':JSON.stringify('isolated-test-key')},
  server:{host:'127.0.0.1',port:5191,strictPort:true,open:false}})
let browser
const findings=[],passed=[],metrics={},observations=[]
const check=async(name,fn)=>{try{await fn();passed.push(name);console.log('PASS',name)}catch(error){findings.push({name,error:error.message});console.log('FAIL',name,error.message)}}
try{
 await server.listen()
 const base=server.resolvedUrls.local[0]
 browser=await chromium.launch({headless:true,channel:process.env.PRAXIS_BROWSER_CHANNEL || 'chromium'})
 const user={id:'00000000-0000-4000-8000-000000000001',aud:'authenticated',role:'authenticated',email:'learner@example.test',created_at:'2026-01-01T00:00:00Z',app_metadata:{provider:'email'},user_metadata:{name:'Test learner'}}
 const now=Math.floor(Date.now()/1000)
 const token=[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:user.id,aud:'authenticated',exp:now+3600,iat:now})).toString('base64url'),'test-signature'].join('.')
 const session={access_token:token,refresh_token:'isolated-refresh',token_type:'bearer',expires_in:3600,expires_at:now+3600,user}
 async function contextFor({fresh=false,viewport={width:1440,height:900},touch=false}={}){
  const ctx=await browser.newContext({viewport,hasTouch:touch,isMobile:touch})
  const state={offline:false,progress:fresh?{points:0,stageProgress:{},stageScores:{}}:{points:200,streak:6,bestStreak:6,stageProgress:{'0':[0,1,2,3],'1':[0,1,2,3,4,5]},stageScores:Object.fromEntries(Array.from({length:6},(_,i)=>[`1:${i}`,100]))},scores:[],errors:[],unexpected:[]}
  await ctx.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url())
   const json=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)})
   if(url.hostname==='praxis-test.invalid'){
    if(url.pathname.endsWith('/token'))return req.postDataJSON().password==='incorrect'?json({error:'invalid_grant',msg:'Invalid login credentials'},400):json(session)
    if(url.pathname.endsWith('/user'))return json(user)
    if(url.pathname.endsWith('/logout'))return route.fulfill({status:204})
    return json(session)
   }
   if(url.origin===new URL(base).origin){
    if(url.pathname.startsWith('/api/')){
     if(state.offline)return route.abort('failed')
     if(url.pathname==='/api/progress'&&req.method()==='GET')return json({success:true,data:state.progress,error:null})
     if(url.pathname==='/api/progress/save'){
      state.progress=structuredClone(req.postDataJSON().progress)
      return json({success:true,data:{status:'ok'},error:null})
     }
     if(url.pathname==='/api/score'){
      const p=req.postDataJSON();state.scores.push(p)
      const puzzle=levels.find(l=>l.id===p.levelId).puzzles[p.stageIdx]
      return json({success:true,data:estimateScore({...p,targetLaws:puzzle.targetLaws}),error:null})
     }
     return json({success:false,error:{code:'not_found',message:'Unknown test API'}},404)
    }
    return route.continue()
   }
   // Fonts are declared by the app; Kaspersky injects a local browser script.
   // Both are blocked to keep this test independent of external services.
   if(url.hostname!=='fonts.googleapis.com'&&!url.hostname.endsWith('.kaspersky-labs.com'))state.unexpected.push(url.origin)
   return route.abort('blockedbyclient')
  })
  const page=await ctx.newPage();page.setDefaultTimeout(15000)
  page.on('pageerror',e=>state.errors.push(e.message))
  return {ctx,page,state}
 }
 async function login(page){
  await page.goto(base+'login')
  await page.locator('input[type="email"]').fill(user.email)
  await page.locator('input[type="password"]').fill('local-test-password')
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(base)
 }
 async function puzzleReady(page,level=1,stage=7){
  await page.goto(base+`level/${level}/stage/${stage}`)
  await page.locator('[data-tutorial="active-equation"]').waitFor()
 }
 const {ctx,page,state}=await contextFor()
 await check('protected route redirects unauthenticated learner',async()=>{
  await page.goto(base+'level/1/stage/7');await page.waitForURL('**/login')
 })
 await check('invalid password is explained',async()=>{
  await page.locator('input[type="email"]').fill(user.email)
  await page.locator('input[type="password"]').fill('incorrect')
  await page.locator('button[type="submit"]').click()
  await page.getByText('Invalid login credentials',{exact:false}).waitFor()
 })
 await check('sign-in restores a protected session',async()=>{await login(page);await puzzleReady(page)})
 await check('independent stage exposes the unlocked law palette',async()=>{
  const ids=await page.locator('[data-law-id]').evaluateAll(els=>els.map(el=>el.getAttribute('data-law-id')))
  assert.deepEqual(ids,['absorption','idempotent','distributive','complement','identity','demorgan','annulment'])
  await page.locator('[data-testid="laws-list"]').waitFor()
 })
 await check('wrong law gives feedback without transforming expression',async()=>{
  const before=await page.locator('[data-tutorial="active-equation"]').innerText()
  await page.locator('[data-law-id="identity"]').click()
  await page.locator('[data-tutorial="active-equation"] [data-tutorial="not-bar"]').first().click()
  await page.locator('[data-testid="apply-selected-law"]').click()
  await page.getByText(/Not matched for/).first().waitFor()
  assert.equal(await page.locator('[data-tutorial="active-equation"]').innerText(),before)
  assert.equal(await page.locator('[data-tutorial="past-equation"]').count(),0)
 })
 await check('correct choices complete and submit actual law history',async()=>{
  await page.locator('[data-law-id="demorgan"]').click()
  await page.locator('[data-tutorial="active-equation"] [data-tutorial="not-bar"]').first().click()
  await page.locator('[data-testid="apply-selected-law"]').click()
  await page.waitForFunction(()=>document.querySelectorAll('[data-tutorial="past-equation"]').length===1)
  await page.locator('[data-tutorial="guide-button"]').first().click()
  await page.getByText(/Guide: press Apply to use Absorption/).first().waitFor()
  await page.locator('[data-testid="apply-selected-law"]').click()
  await page.locator('[data-tutorial="score-modal"]').waitFor()
  assert.equal(state.scores.at(-1).stepsUsed,2)
  assert.deepEqual(state.scores.at(-1).lawsUsed,['demorgan','absorption'])
  assert.equal(state.scores.at(-1).guidesUsed,1)
 })
 await check('refresh restores completed derivation and local progress',async()=>{
  await page.reload();await page.locator('[data-tutorial="reopen-score-btn"]').waitFor()
  assert.equal(await page.locator('[data-tutorial="past-equation"]').count(),2)
 })
 await check('legacy derivation remains reviewable',async()=>{
  await page.evaluate(uid=>{
   const key='praxis_v1_'+uid,progress=JSON.parse(localStorage.getItem(key))
   progress.stageSolutions['1:0']=[{law:'Absorption Law',from:'x + xy',to:'x'}]
   localStorage.setItem(key,JSON.stringify(progress))
  },user.id)
  await puzzleReady(page,1,1)
  await page.locator('[data-tutorial="reopen-score-btn"]').waitFor()
  assert.equal(await page.locator('[data-tutorial="past-equation"]').count(),1)
 })
 await check('earlier unsolved stage keeps the starter palette only',async()=>{
  await puzzleReady(page,1,2)
  const ids=await page.locator('[data-law-id]').evaluateAll(els=>els.map(el=>el.getAttribute('data-law-id')))
  assert.deepEqual(ids,['absorption'])
  assert.equal(await page.locator('[data-law-id="demorgan"]').count(),0)
 })
 await check('sandbox rejects invalid input and solves custom input',async()=>{
  await page.goto(base+'sandbox');await page.locator('[data-tutorial="active-equation"]').waitFor()
  const input=page.locator('input').filter({visible:true}).first()
  await input.fill('A++B')
  await page.getByText(/Two operators in a row/).first().waitFor()
  await input.fill('A + AB')
  await page.getByRole('button',{name:/Validate.*Play/}).click()
  await page.locator('[data-testid="custom-expression-label"]').filter({hasText:'A + AB'}).waitFor()
  await page.locator('[data-tutorial="guide-button"]').first().click()
  await page.getByText(/Guide: press Apply/).first().waitFor()
  await page.locator('[data-testid="apply-selected-law"]').click()
  await page.locator('[data-tutorial="score-modal"]').waitFor()
  await page.getByText('Free practice: no points or progress recorded.').waitFor()
 })
 await check('API outage does not block local completion',async()=>{
  state.offline=true
  await puzzleReady(page,1,8)
  for(let i=0;i<2;i++){
   await page.locator('[data-tutorial="guide-button"]').first().click()
   await page.getByText(/Guide: press Apply/).first().waitFor()
   await page.locator('[data-testid="apply-selected-law"]').click()
   await page.waitForFunction(n=>document.querySelectorAll('[data-tutorial="past-equation"]').length===n,i+1)
  }
  await page.locator('[data-tutorial="score-modal"]').waitFor()
  state.offline=false
 })
 await check('complex four-variable sandbox input completes for responsiveness measurement',async()=>{
  await page.goto(base+'sandbox')
  await page.locator('[data-tutorial="active-equation"]').waitFor()
  const expression="A'BC'D' + A'BC'D + ABC'D' + ABC'D + ABCD + AB'CD"
  await page.locator('input').filter({visible:true}).first().fill(expression)
  await page.evaluate(()=>{
   window.__timing={last:performance.now(),maxGapMs:0}
   window.__timer=setInterval(()=>{const now=performance.now();window.__timing.maxGapMs=Math.max(window.__timing.maxGapMs,now-window.__timing.last);window.__timing.last=now},20)
  })
  const start=Date.now()
  await page.getByRole('button',{name:/Validate.*Play/}).click()
  await page.locator('[data-testid="custom-expression-label"]').filter({hasText:expression}).waitFor({timeout:45000})
  await page.waitForTimeout(60)
  metrics.complexSandbox={wallMs:Date.now()-start,...await page.evaluate(()=>{clearInterval(window.__timer);return {maxEventLoopGapMs:window.__timing.maxGapMs}})}
  console.log('MEASUREMENT',JSON.stringify(metrics.complexSandbox))
 })
 const gate=await page.evaluate(async()=>{
  const {getLevelProgress}=await import('/src/state/progressStore.js')
  return getLevelProgress({stageScores:Object.fromEntries(Array.from({length:12},(_,i)=>['1:'+i,79.5])),stageProgress:{'1':Array.from({length:12},(_,i)=>i)}},1,12)
 })
 if(gate.unlocked)observations.push({name:'Existing progression boundary',detail:'A true average of 79.5 is rounded to 80 and unlocks the next level.'})
 await puzzleReady(page,2,1)
 if(await page.locator('[data-tutorial="active-equation"]').count())observations.push({name:'Existing direct-route prerequisite bypass',detail:'Level 2 puzzle opens directly despite incomplete Level 1; carousel prerequisites are not enforced at the puzzle route.'})
 await check('sign-out cancellation preserves session and confirmation revokes it',async()=>{
  await page.goto(base+'profile')
  await page.getByRole('button',{name:'Sign out',exact:true}).first().click()
  await page.getByRole('button',{name:'Cancel',exact:true}).click()
  await page.getByRole('button',{name:'Sign out',exact:true}).first().click()
  await page.locator('.praxis-modal-panel').filter({has:page.getByRole('heading',{name:'Sign out?',exact:true})}).getByRole('button',{name:'Sign Out',exact:true}).click()
  await page.waitForURL(base)
  await page.goto(base+'level/1/stage/7');await page.waitForURL('**/login')
 })
 const fresh=await contextFor({fresh:true})
 await check('fresh account is redirected to tutorial before graded practice',async()=>{
  await login(fresh.page);await fresh.page.goto(base+'level/1/stage/7')
  await fresh.page.waitForURL('**/level/0/stage/1?**')
  await fresh.page.locator('[data-tutorial="active-equation"]').waitFor()
  await fresh.page.getByText(/Welcome to/).first().waitFor()
 })
 await fresh.ctx.close()
 const phone=await contextFor({viewport:{width:844,height:390},touch:true})
 await check('phone landscape keeps all independent choices reachable',async()=>{
  await login(phone.page);await puzzleReady(phone.page)
  assert.equal(await phone.page.locator('[data-law-id]').count(),7)
  await phone.page.locator('[data-law-id="demorgan"]').scrollIntoViewIfNeeded()
  assert.equal(await phone.page.locator('[data-law-id="demorgan"]').isVisible(),true)
  assert.ok(await phone.page.locator('[data-testid="derivation-scroll"]').evaluate(el=>el.clientHeight>30))
 })
 await check('phone portrait gate clears after rotation to landscape',async()=>{
  await phone.page.setViewportSize({width:390,height:844})
  await phone.page.getByText('Praxis works best in landscape mode. Please rotate your device.',{exact:true}).waitFor()
  await phone.page.setViewportSize({width:844,height:390})
  await phone.page.getByText('Praxis works best in landscape mode. Please rotate your device.',{exact:true}).waitFor({state:'hidden'})
 })
 await check('application has no uncaught browser errors',async()=>assert.deepEqual([...state.errors,...phone.state.errors],[]))
 await check('no unexpected external origins were contacted',async()=>assert.deepEqual([...state.unexpected,...phone.state.unexpected],[]))
 await phone.ctx.close();await ctx.close()
 metrics.passed=passed.length;metrics.failed=findings.length
}finally{
 await browser?.close();await server.close()
 await mkdir(resultDir,{recursive:true})
 await writeFile(path.join(resultDir,'application-regression.json'),JSON.stringify({passed,findings,observations,metrics},null,2))
}
console.log(JSON.stringify({passed:passed.length,failed:findings.length}))
process.exitCode=findings.length?1:0
