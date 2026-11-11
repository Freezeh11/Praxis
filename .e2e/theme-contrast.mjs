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
 await login(page)
 const audits=[]
 async function audit(label){
  const failures=await page.evaluate(()=>{
   const rgb=s=>{const a=s.match(/[\d.]+/g)?.map(Number);return a?.length>=3?[...a.slice(0,3),a[3]??1]:[0,0,0,0]}
   const blend=(a,b)=>[...a.slice(0,3).map((v,i)=>v*a[3]+b[i]*(1-a[3])),1]
   const lum=c=>c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0)
   const results=[]
   const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT)
   while(walker.nextNode()){
    const text=walker.currentNode.textContent.trim(),el=walker.currentNode.parentElement
    if(!text||!el||el.closest('script,style,svg,[aria-hidden="true"]')||!el.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}))continue
    const rect=el.getBoundingClientRect();if(rect.width===0||rect.height===0||rect.right<0||rect.left>innerWidth||rect.bottom<0||rect.top>innerHeight)continue
    const ancestry=[];let opacity=1;for(let a=el;a;a=a.parentElement){ancestry.unshift(a);opacity*=Number(getComputedStyle(a).opacity)}
    if(opacity<.8||el.closest(':disabled'))continue
    let bg=[255,255,255,1]
    for(const a of ancestry)bg=blend(rgb(getComputedStyle(a).backgroundColor),bg)
    const style=getComputedStyle(el),fg=blend(rgb(style.color),bg)
    const l1=lum(fg),l2=lum(bg),ratio=(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05)
    const threshold=parseFloat(style.fontSize)>=24||(parseFloat(style.fontSize)>=18.66&&Number(style.fontWeight)>=700)?3:4.5
    if(ratio<threshold-.05)results.push({text:text.slice(0,85),ratio:Math.round(ratio*100)/100,color:style.color,bg:bg.slice(0,3),class:el.className})
   }
   return results
  })
  audits.push({label,failures});console.log(label,JSON.stringify(failures))
 }
 for(const theme of ['light','dark']){
  await page.evaluate(theme=>{localStorage.setItem('praxis-theme',theme)},theme)
  for(const route of ['','levels','level/0/stages','level/1/stages','profile','level/1/stage/1','sandbox']){
   await page.goto(base+route)
   await page.locator('header, [data-testid="header-back-button"]').first().waitFor()
   await page.evaluate(()=>document.fonts.ready)
   // Let route hydration and color transitions settle before sampling colors.
   await page.waitForTimeout(400)
   await audit(theme+':'+(route||'home'))
   for(const button of await page.locator('button[title*="Tutorial"], [data-popup-anchor="tutorial"]').all()){
    if(await button.isVisible()){await button.hover();await page.waitForTimeout(250);await audit(theme+':'+route+':tutorial-hover')}
   }
   for(const button of await page.locator('button.bg-accent:not(:disabled), a.bg-accent').all()){
    if(await button.isVisible()){await button.hover();await page.waitForTimeout(250);await audit(theme+':'+route+':primary-hover')}
   }
   await page.mouse.move(0,0)
   if(route==='level/1/stage/1'){
    await page.locator('[data-tutorial="hint-button"]').click()
    await page.locator('[data-testid="hint-bubble"]').waitFor()
    await audit(theme+':hint')
    await page.locator('[data-testid="hint-bubble-close"]').click()
   }
   if(theme==='dark'&&['levels','level/0/stages','level/1/stage/1','profile'].includes(route))await page.screenshot({path:path.join(resultDir,'contrast-'+route.replaceAll('/','-')+'.png'),fullPage:true})
  }
 }
 for(const theme of ['light','dark']){
  await page.evaluate(theme=>localStorage.setItem('praxis-theme',theme),theme)
  await page.goto(base+'levels');await page.locator('[data-level-card]').first().waitFor()
  assert.equal(await page.getByRole('link',{name:'My profile',exact:true}).locator('svg').count(),1)
  await page.locator('[data-popup-anchor="tutorial"]').click()
  await page.waitForTimeout(350);await audit(theme+':tutorial-replay-dialog')
  await page.screenshot({path:path.join(resultDir,'contrast-'+theme+'-tutorial-dialog.png'),fullPage:true})
  await page.goto(base+'level/0/stage/1?tutorial=true')
  await page.getByText(/Welcome to/).first().waitFor()
  await page.waitForTimeout(350);await audit(theme+':tutorial-welcome')
  await page.getByRole('button',{name:'Continue',exact:false}).click()
  await page.waitForTimeout(350);await audit(theme+':tutorial-final-slide')
  await page.getByRole('button',{name:/start|begin|let/i}).last().hover()
  await page.waitForTimeout(250);await audit(theme+':tutorial-final-hover')
  await page.screenshot({path:path.join(resultDir,'contrast-'+theme+'-tutorial-welcome.png'),fullPage:true})
  await page.goto(base+'level/1/stage/1');await page.locator('[data-tutorial="active-equation"]').waitFor()
  if(await page.locator('[data-tutorial="reopen-score-btn"]').count()){
   await page.getByTitle('Reset problem to start',{exact:true}).click()
   await page.getByRole('button',{name:'Reset Stage',exact:true}).click()
  }
  await page.locator('[data-law-id="absorption"]').click()
  await page.locator('[data-tutorial="active-equation"] [data-path="R.0"]').first().click()
  await page.locator('[data-tutorial="active-equation"] [data-path="R.1"]').first().click()
  await page.locator('[data-testid="apply-selected-law"]').click()
  await page.locator('[data-tutorial="score-modal"]').waitFor()
  await page.waitForTimeout(350);await audit(theme+':score-dialog')
  await page.screenshot({path:path.join(resultDir,'contrast-'+theme+'-score-dialog.png'),fullPage:true})
 }
 assert.deepEqual(state.errors,[])
 await ctx.close()
 await writeFile(path.join(resultDir,'theme-contrast.json'),JSON.stringify(audits,null,2))
 assert.deepEqual(audits.filter(audit=>audit.failures.length),[])
}finally{await browser?.close();await server.close()}
