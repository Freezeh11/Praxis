import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
import path from 'node:path'
import {createServer} from '../frontend/node_modules/vite/dist/node/index.js'

const require=createRequire(import.meta.url)
const {chromium}=require(process.env.PRAXIS_PLAYWRIGHT_MODULE || 'playwright')
const root=fileURLToPath(new URL('../frontend',import.meta.url))
process.chdir(root)
// The dev CSP narrows connect-src to the configured Supabase origin; tests mock that origin.
process.env.VITE_SUPABASE_URL='https://praxis-test.invalid'
process.env.VITE_SUPABASE_PUBLISHABLE_KEY='isolated-test-key'
const server=await createServer({root,configFile:path.join(root,'vite.config.js'),
  define:{'import.meta.env.VITE_SUPABASE_URL':JSON.stringify('https://praxis-test.invalid'),'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY':JSON.stringify('isolated-test-key')},
  server:{host:'127.0.0.1',port:5193,strictPort:true,open:false}})
await server.listen()
const base=server.resolvedUrls.local[0]
const browser=await chromium.launch({headless:true})
const user={id:'00000000-0000-4000-8000-000000000001',aud:'authenticated',role:'authenticated',email:'learner@example.test',created_at:'2026-01-01T00:00:00Z',app_metadata:{provider:'email'},user_metadata:{name:'Test learner'}}
const now=Math.floor(Date.now()/1000)
const token=[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:user.id,aud:'authenticated',exp:now+3600,iat:now})).toString('base64url'),'test-signature'].join('.')
const session={access_token:token,refresh_token:'isolated-refresh',token_type:'bearer',expires_in:3600,expires_at:now+3600,user}
const ctx=await browser.newContext({viewport:{width:1280,height:900}})
await ctx.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url())
  const json=(d,s=200)=>route.fulfill({status:s,contentType:'application/json',body:JSON.stringify(d)})
  if(url.hostname==='praxis-test.invalid'){
    if(url.pathname.endsWith('/logout'))return route.fulfill({status:204})
    if(url.pathname.endsWith('/user'))return json(user)
    return json(session)
  }
  if(url.origin===new URL(base).origin){
    if(url.pathname.startsWith('/api/')){
      if(url.pathname==='/api/progress'&&req.method()==='GET')return json({success:true,data:{points:200,stageProgress:{},stageScores:{}},error:null})
      return json({success:true,data:{status:'ok'},error:null})
    }
    return route.continue()
  }
  return route.abort('blockedbyclient')
})
const page=await ctx.newPage();page.setDefaultTimeout(20000)
async function login(){
  await page.goto(base+'login')
  await page.locator('input[type="email"]').fill(user.email)
  await page.locator('input[type="password"]').fill('local-test-password')
  await page.locator('button[type="submit"]').click()
  await page.waitForTimeout(2500)
}
const results=[]
const check=(name,ok,detail)=>{results.push({name,ok,detail});console.log((ok?'PASS':'FAIL'),name,detail||'')}

await login()
// 1. absolute cap already passed at boot -> forced sign-out
await page.evaluate(uid=>{
  localStorage.setItem('praxis_session_started_'+uid,String(Date.now()-13*60*60*1000))
  localStorage.setItem('praxis_session_active_'+uid,String(Date.now()))
},user.id)
await page.goto(base+'profile')
await page.waitForURL(base+'login',{timeout:20000}).catch(()=>{})
check('boot with expired 12h cap redirects to login',page.url().endsWith('/login'),page.url())
const toast1=await page.getByText('Your session expired. Please sign in again.').first().isVisible().catch(()=>false)
check('expiry toast shown',toast1)

// 2. idle warning inside the 60s window, then stay signed in
await login()
await page.evaluate(uid=>{
  localStorage.setItem('praxis_session_started_'+uid,String(Date.now()))
  localStorage.setItem('praxis_session_active_'+uid,String(Date.now()-19.6*60*1000))
},user.id)
await page.goto(base+'profile')
await page.waitForSelector('[role="dialog"]',{timeout:20000}).catch(()=>{})
const dialogVisible=await page.locator('[role="dialog"]').isVisible().catch(()=>false)
const dialogText=dialogVisible?await page.locator('[role="dialog"]').innerText():''
check('idle warning dialog appears inside 60s window',dialogVisible,dialogText.slice(0,60).replace(/\n/g,' '))
check('dialog mentions session expiry',/sign you out|session/i.test(dialogText))
const activeBefore=await page.evaluate(uid=>Number(localStorage.getItem('praxis_session_active_'+uid)),user.id)
if(dialogVisible){
  await page.getByRole('button',{name:/stay signed in/i}).click()
  await page.waitForSelector('[role="dialog"]',{state:'detached',timeout:10000}).catch(()=>{})
  const gone=!(await page.locator('[role="dialog"]').isVisible().catch(()=>false))
  check('stay signed in dismisses warning',gone)
  const activeAfter=await page.evaluate(uid=>Number(localStorage.getItem('praxis_session_active_'+uid)),user.id)
  check('stay signed in extends the idle clock',activeAfter>activeBefore,activeAfter-activeBefore+'ms')
}
const failed=results.filter(r=>!r.ok)
console.log(JSON.stringify({passed:results.length-failed.length,failed:failed.length}))
await browser.close();await server.close()
process.exit(failed.length?1:0)
