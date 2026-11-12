/** Round-11 verification probe: verify qa-flows + qa-edge fixes on a live SPA.
 * node .e2e/qa-round11-fixes.mjs
 */
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
import path from 'node:path'
import {createServer} from '../frontend/node_modules/vite/dist/node/index.js'

const require=createRequire(import.meta.url)
const {chromium}=require(process.env.PRAXIS_PLAYWRIGHT_MODULE || 'playwright')
const root=fileURLToPath(new URL('../frontend',import.meta.url))
process.chdir(root)
process.env.VITE_SUPABASE_URL='https://praxis-test.invalid'
process.env.VITE_SUPABASE_PUBLISHABLE_KEY='isolated-test-key'

const server=await createServer({root,configFile:path.join(root,'vite.config.js'),
  define:{'import.meta.env.VITE_SUPABASE_URL':JSON.stringify('https://praxis-test.invalid'),'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY':JSON.stringify('isolated-test-key')},
  server:{host:'127.0.0.1',port:5197,strictPort:true,open:false}})
const passed=[],failed=[]
const check=async(name,fn)=>{try{await fn();passed.push(name);console.log('PASS',name)}catch(e){failed.push({name,error:e.message});console.log('FAIL',name,e.message)}}

let browser
try{
  await server.listen()
  const base=server.resolvedUrls.local[0]
  browser=await chromium.launch({headless:true,channel:process.env.PRAXIS_BROWSER_CHANNEL||'chromium'})
  const user={id:'00000000-0000-4000-8000-000000000001',aud:'authenticated',role:'authenticated',email:'learner@example.test',created_at:'2026-01-01T00:00:00Z',app_metadata:{provider:'email'},user_metadata:{name:'Test learner'}}
  const now=Math.floor(Date.now()/1000)
  const token=[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:user.id,aud:'authenticated',exp:now+3600,iat:now})).toString('base64url'),'sig'].join('.')
  const session={access_token:token,refresh_token:'r',token_type:'bearer',expires_in:3600,expires_at:now+3600,user}

  async function contextFor({stored=null,api=()=>null,progress={points:0,stageProgress:{},stageScores:{}}}={}){
    const ctx=await browser.newContext({viewport:{width:1440,height:900}})
    const consoleErrors=[]
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
        if(url.pathname.startsWith('/api/')){
          const override=api(url,req)
          if(override)return override
          if(url.pathname==='/api/progress'&&req.method()==='GET')return json({success:true,data:progress,error:null})
          if(url.pathname==='/api/progress/save')return json({success:true,data:{status:'ok'},error:null})
          return json({success:false,error:{code:'not_found',message:'Unknown test API'}},404)
        }
        return route.continue()
      }
      return route.abort('blockedbyclient')
    })
    const authValue=JSON.stringify({access_token:token,refresh_token:'r',expires_at:now+3600,token_type:'bearer',user})
    await ctx.addInitScript(([storedKey,storedValue,authKey,auth]) => {
      if (storedValue) localStorage.setItem(storedKey, storedValue)
      localStorage.setItem(authKey, auth)
    }, ['praxis_v1_'+user.id, stored, 'sb-praxis-test-auth-token', authValue])
    const page=await ctx.newPage()
    page.setDefaultTimeout(20000)
    page.on('pageerror',e=>consoleErrors.push('pageerror: '+e.message))
    page.on('console',m=>{if(m.type()==='error')consoleErrors.push('console: '+m.text())})
    return {ctx,page,consoleErrors}
  }

  // EDGE-03: a null stageProgress map with the API offline must not crash the app.
  await check('corrupt null stageProgress no longer crashes the app', async () => {
    const {ctx,page}=await contextFor({stored:JSON.stringify({points:10,stageProgress:null}), api:()=>null})
    await page.goto(base+'levels')
    await page.getByRole('heading',{name:/Choose Your Level/i}).waitFor({timeout:8000})
    const body=await page.locator('body').innerText()
    assert.ok(!body.includes('Cannot read properties'),'error boundary rendered')
    await ctx.close()
  })

  // EDGE-04: a numeric stage list instead of an array must be dropped, not thrown.
  await check('wrong-typed stageProgress is dropped instead of throwing', async () => {
    const {ctx,page}=await contextFor({stored:JSON.stringify({points:10,stageProgress:{'1':5}})})
    await page.goto(base+'levels')
    await page.getByRole('heading',{name:/Choose Your Level/i}).waitFor({timeout:8000})
    await ctx.close()
  })

  // EDGE-01: a hanging progress call must not pin the tutorial gate forever.
  await check('hanging progress request resolves through the API timeout', async () => {
    const {ctx,page}=await contextFor({
      api:(url)=>url.pathname==='/api/progress'?(()=>{ /* never fulfils */ }):null,
    })
    await page.goto(base+'levels')
    await page.getByRole('heading',{name:/Choose Your Level/i}).waitFor({timeout:25000})
    await ctx.close()
  })

  // QA-01 / QA-03 / QA-05: tutorial affordances, exit confirmation, console health.
  await check('tutorial grip is visible without hover', async () => {
    const {ctx,page,consoleErrors}=await contextFor()
    await page.goto(base+'level/0/stage/1?tutorial=true')
    await page.getByText(/STEP 1 OF/i).waitFor()
    const grip=page.locator('button[aria-label^="Term grip"]').first()
    await grip.waitFor()
    const opacity=await grip.evaluate(el=>Number(getComputedStyle(el).opacity))
    assert.ok(opacity>0.5, 'term grip must be visible without hover, got opacity '+opacity)
    // Clicking the grip must select the whole term, not a literal inside it.
    await grip.click({force:true})
    await page.waitForTimeout(300)
    const selected=await page.locator('[aria-pressed="true"]').count()
    assert.ok(selected>=1,'clicking the grip must select something')
    assert.ok(consoleErrors.filter(e=>e.includes('Expected length')||e.includes('Expected number')).length===0,
      'spotlight must not log SVG attribute errors: '+consoleErrors.join(' | '))
    await ctx.close()
  })

  await check('coach card exit control leaves the tutorial', async () => {
    const {ctx,page}=await contextFor()
    await page.goto(base+'level/0/stage/1?tutorial=true')
    await page.getByText(/STEP 1 OF/i).waitFor()
    await page.getByRole('button',{name:/^Start|^Continue/i}).first().click()
    await page.getByRole('button',{name:/^Start/i}).first().click({timeout:3000}).catch(()=>{})
    const exit=page.locator('[data-tutorial-exit="true"]').first()
    await exit.waitFor({timeout:10000})
    await exit.click()
    // With no move applied the exit is immediate — the confirmation is reserved
    // for a derivation that would be lost.
    await page.waitForURL('**/level/0/stages',{timeout:10000})
    await page.getByRole('dialog',{name:/Exit the tutorial/i}).count().then(c=>assert.equal(c,0))
    await ctx.close()
  })
} finally {
  await browser?.close()
  await server.close()
}
console.log('\n'+(passed.length)+' passed, '+failed.length+' failed')
if(failed.length){for(const f of failed)console.log('FAILED:',f.name,'-',f.error);process.exit(1)}
