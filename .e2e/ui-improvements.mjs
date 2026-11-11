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
  const state={passwordUpdates:[],registrations:[],offline:false,progress:fresh?{points:0,stageProgress:{},stageScores:{}}:{points:200,streak:6,bestStreak:6,stageProgress:{'0':[0,1,2,3],'1':[0,1,2,3,4,5]},stageScores:Object.fromEntries(Array.from({length:6},(_,i)=>[`1:${i}`,100]))},scores:[],errors:[],unexpected:[]}
  await ctx.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url())
   const json=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)})
   if(url.hostname==='praxis-test.invalid'){
    if(url.pathname.endsWith('/token'))return req.postDataJSON().password==='incorrect'?json({error:'invalid_grant',msg:'Invalid login credentials'},400):json(session)
    if(url.pathname.endsWith('/user')) { if(req.method()==='PUT')state.passwordUpdates.push(req.postDataJSON());return json(user) }
    if(url.pathname.endsWith('/signup')) { state.registrations.push(req.postDataJSON()); return json(session) }
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
 await check('registration rejects weak passwords and displays red mismatch feedback',async()=>{
  await page.goto(base+'register')
  await page.getByLabel('Full Name').fill('New learner')
  await page.getByLabel('Email',{exact:true}).fill(user.email)
  for(const password of ['Short1!','abcdefgh','abcdefgh1','abcdefg!']) {
   await page.getByLabel('Password',{exact:true}).fill(password)
   await page.getByLabel('Confirm Password',{exact:true}).fill(password)
   assert.equal(await page.getByRole('button',{name:'Create Account',exact:true}).isDisabled(),true)
  }
  await page.getByLabel('Password',{exact:true}).fill('Strong12!')
  await page.getByLabel('Confirm Password',{exact:true}).fill('Different12!')
  const message=page.getByRole('alert').filter({hasText:'Passwords do not match.'})
  await message.waitFor()
  const color=await message.evaluate(el=>getComputedStyle(el).color)
  assert.equal(color,'rgb(220, 38, 38)')
  assert.equal(state.registrations.length,0)
  await page.getByLabel('Confirm Password',{exact:true}).fill('Strong12!')
  assert.equal(await page.getByRole('button',{name:'Create Account',exact:true}).isEnabled(),true)
  await page.getByRole('button',{name:'Create Account',exact:true}).click()
  await page.waitForURL(base+'levels')
  assert.equal(state.registrations.length,1)
 })
 await check('one survey per navigation page; streak removed',async()=>{
  for(const route of ['', 'levels', 'level/1/stages']) {
   await page.goto(base+route)
   await page.locator('[data-testid="survey-button"]').waitFor()
   assert.equal(await page.locator('[data-testid="survey-button"]').count(),1)
   assert.equal(await page.getByText(/streak/i).count(),0)
  }
 })
 await check('profile shows missing scores and progression without the scoring explainer',async()=>{
  await page.goto(base+'profile')
  await page.getByRole('heading',{name:'Your learning journey'}).waitFor()
  assert.equal(await page.getByRole('heading',{name:'How your score works'}).count(),0)
  await page.getByText('Stages still needing a score:',{exact:false}).first().waitFor()
  assert.equal(await page.getByText('Saved derivations',{exact:true}).count(),0)
  assert.equal(await page.getByRole('button',{name:'Download progress'}).count(),0)
  await page.getByRole('heading',{name:user.user_metadata.name,exact:true}).waitFor()
  await page.locator('[aria-describedby="progress-help"]').focus()
  await page.getByRole('tooltip').waitFor({state:'visible'})
 })
 await check('current password is required and wrong password never submits an update',async()=>{
  await page.getByLabel('New password',{exact:true}).fill('NewSecure12!')
  await page.getByLabel('Confirm new password',{exact:true}).fill('NewSecure12!')
  assert.equal(await page.getByRole('button',{name:'Update password',exact:true}).isDisabled(),true)
  await page.getByLabel('Current password',{exact:true}).fill('incorrect')
  await page.getByRole('button',{name:'Update password',exact:true}).click()
  await page.getByRole('alert').filter({hasText:'Could not verify your current password'}).waitFor()
  assert.equal(state.passwordUpdates.length,0)
  await page.getByLabel('Current password',{exact:true}).fill('Correct12!')
  await page.getByRole('button',{name:'Update password',exact:true}).click()
  await page.getByText('Your password has been updated.',{exact:true}).waitFor()
  assert.equal(state.passwordUpdates.length,1)
  assert.equal(state.passwordUpdates[0].password,'NewSecure12!')
  assert.equal(state.passwordUpdates[0].current_password,'Correct12!')
  assert.equal(await page.getByLabel('Current password',{exact:true}).inputValue(),'')
 })
 await check('dark mode persists across reload and can return to light',async()=>{
  await page.getByRole('button',{name:'Switch to dark mode',exact:true}).first().click()
  assert.equal(await page.locator('html').getAttribute('data-theme'),'dark')
  await page.reload()
  assert.equal(await page.locator('html').getAttribute('data-theme'),'dark')
  assert.equal(await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(17, 24, 39)')
  await page.screenshot({path:path.join(resultDir,'profile-dark.png'),fullPage:true})
  await page.getByRole('button',{name:'Switch to light mode',exact:true}).first().click()
  assert.equal(await page.locator('html').getAttribute('data-theme'),'light')
  await page.screenshot({path:path.join(resultDir,'profile-light.png'),fullPage:true})
 })
 await puzzleReady(page,1,1)
 await check('desktop zoom readout tracks scale and resets',async()=>{
  await page.getByTitle('Zoom in',{exact:true}).click()
  await page.getByRole('button',{name:'115%',exact:true}).waitFor()
  assert.match(await page.locator('[data-tutorial="canvas"]').getAttribute('style'),/scale\(1.15\)/)
  await page.getByTitle('Zoom out',{exact:true}).click()
  await page.getByRole('button',{name:'100%',exact:true}).waitFor()
  await page.getByTitle('Zoom out',{exact:true}).click()
  await page.getByRole('button',{name:'85%',exact:true}).waitFor()
  await page.getByTitle('Reset zoom to 100%',{exact:true}).click()
  await page.getByRole('button',{name:'100%',exact:true}).waitFor()
 })
 await check('workspace has one labeled law-reference button and centered hint',async()=>{
  assert.equal(await page.getByRole('button',{name:'Law reference',exact:false}).count(),1)
  assert.equal(await page.locator('[data-testid="survey-button"]').count(),0)
  await page.locator('[data-tutorial="hint-button"]').click()
  const hint=page.locator('[data-testid="hint-bubble"]');await hint.waitFor()
  const box=await hint.boundingBox(),v=page.viewportSize()
  assert.ok(Math.abs(box.x+box.width/2-v.width/2)<2)
  assert.ok(Math.abs(box.y+box.height/2-v.height/2)<2)
  await page.locator('[data-testid="hint-bubble-close"]').click()
  await hint.waitFor({state:'hidden'})
 })
 await check('wrong law feedback is red and preserves the expression',async()=>{
  await puzzleReady(page,1,7)
  const expression=page.locator('[data-tutorial="active-equation"]')
  const before=await expression.innerText()
  await page.locator('[data-law-id="identity"]').click()
  await page.locator('[data-tutorial="active-equation"] [data-tutorial="not-bar"]').click()
  await page.locator('[data-testid="apply-selected-law"]').click()
  const error=page.getByText(/Not matched for/).first();await error.waitFor()
  await page.waitForFunction(() => { const el=[...document.querySelectorAll('[role="status"]')].find(el=>el.textContent.includes('Not matched for'));return el && getComputedStyle(el).color==='rgb(185, 28, 28)' })
  assert.equal(await expression.innerText(),before)
 })
 await puzzleReady(page,1,1)
 await check('dark workspace keeps readable surfaces',async()=>{
  await page.getByRole('button',{name:'Switch to dark mode'}).click()
  assert.equal(await page.locator('[data-testid="derivation-scroll"]').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(27, 37, 55)')
  await page.screenshot({path:path.join(resultDir,'workspace-dark.png'),fullPage:true})
 })
 await page.setViewportSize({width:844,height:390})
 await check('compact workspace has one reference and centered hint',async()=>{
  assert.equal(await page.getByRole('button',{name:'Law reference',exact:false}).count(),1)
  await page.locator('[data-tutorial="hint-button"]').click()
  const hint=page.locator('[data-testid="hint-bubble"]');await hint.waitFor()
  const box=await hint.boundingBox(),v=page.viewportSize()
  assert.ok(Math.abs(box.x+box.width/2-v.width/2)<2)
  assert.ok(Math.abs(box.y+box.height/2-v.height/2)<2)
  await page.screenshot({path:path.join(resultDir,'workspace-compact-dark.png'),fullPage:true})
 })
 await check('no uncaught browser errors',async()=>assert.deepEqual(state.errors,[]))
 await ctx.close()
}finally{
 await browser?.close();await server.close()
 await mkdir(resultDir,{recursive:true})
 await writeFile(path.join(resultDir,'ui-improvements.json'),JSON.stringify({passed,findings},null,2))
}
console.log(JSON.stringify({passed:passed.length,failed:findings.length}))
process.exitCode=findings.length?1:0
