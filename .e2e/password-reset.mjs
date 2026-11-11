/** Password recovery flows on real routes; Supabase is mocked in Playwright.
 * No real accounts, no real email, no shared database writes.
 * node .e2e/password-reset.mjs
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
const server=await createServer({root,configFile:path.join(root,'vite.config.js'),define:{'import.meta.env.VITE_SUPABASE_URL':JSON.stringify('https://praxis-test.invalid'),'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY':JSON.stringify('isolated-test-key')},server:{host:'127.0.0.1',port:5195,strictPort:true,open:false}})
await server.listen()
const base=server.resolvedUrls.local[0]
const browser=await chromium.launch({headless:true})
const passed=[],failed=[]
const check=(name,ok,detail='')=>{(ok?passed:failed).push(name);console.log(ok?'PASS':'FAIL',name,detail)}

const user={id:'00000000-0000-4000-8000-000000000002',aud:'authenticated',role:'authenticated',email:'recover@example.test',created_at:'2026-01-01T00:00:00Z',app_metadata:{provider:'email'},user_metadata:{name:'Recover learner'}}
const now=Math.floor(Date.now()/1000)
const token=[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:user.id,aud:'authenticated',exp:now+3600,iat:now})).toString('base64url'),'sig'].join('.')
const session={access_token:token,refresh_token:'recovery-refresh',token_type:'bearer',expires_in:3600,expires_at:now+3600,user}

await mkdir(resultDir,{recursive:true})
async function contextFor(theme){
  const ctx=await browser.newContext({viewport:{width:1280,height:900}})
  await ctx.addInitScript(t=>{try{localStorage.setItem('praxis-theme',t)}catch{}},theme)
  const state={recoveries:[],passwordUpdates:[]}
  await ctx.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url())
    const json=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)})
    if(url.hostname==='praxis-test.invalid'){
      if(url.pathname.endsWith('/recover')){state.recoveries.push(Object.fromEntries(url.searchParams));return json({})}
      if(url.pathname.endsWith('/user')){if(req.method()==='PUT')state.passwordUpdates.push(req.postDataJSON());return json(user)}
      if(url.pathname.endsWith('/logout'))return route.fulfill({status:204})
      return json(session)
    }
    if(url.origin===new URL(base).origin)return route.continue()
    return route.abort('blockedbyclient')
  })
  const page=await ctx.newPage();page.setDefaultTimeout(15000)
  return {ctx,page,state}
}

for(const theme of ['light','dark']){
  const {ctx,page,state}=await contextFor(theme)

  // 1. Request a reset link from the login screen's entry point.
  await page.goto(base+'login')
  await page.waitForFunction(()=> (document.querySelector('#root')?.childElementCount ?? 0) > 0)
  await page.getByRole('link',{name:'Forgot password?'}).click()
  await page.waitForURL(base+'forgot-password')
  await page.locator('#forgot-email').fill('recover@example.test')
  await page.screenshot({path:path.join(resultDir,'reset-'+theme+'-request.png'),fullPage:true})
  await page.getByRole('button',{name:'Send Reset Link'}).click()
  await page.getByRole('heading',{name:'Reset link sent'}).waitFor()
  check(theme+' forgot-password requests a recovery email',state.recoveries.length===1,JSON.stringify(state.recoveries[0]||{}))
  check(theme+' recovery redirect points at the reset route',/\/reset-password$/.test(state.recoveries[0]?.redirect_to||''),state.recoveries[0]?.redirect_to||'')
  await page.screenshot({path:path.join(resultDir,'reset-'+theme+'-sent.png'),fullPage:true})

  // 2. Follow a recovery link: hash tokens create a short-lived session.
  await ctx.clearCookies()
  await page.goto(base+'reset-password#access_token='+token+'&refresh_token=recovery-refresh&expires_in=3600&token_type=bearer&type=recovery')
  await page.getByRole('heading',{name:'Choose a new password'}).waitFor()
  await page.locator('#reset-password').fill('Local-test-9!x')
  await page.locator('#reset-password-confirm').fill('Local-test-9!x')
  await page.screenshot({path:path.join(resultDir,'reset-'+theme+'-form.png'),fullPage:true})
  const hashCleared=await page.evaluate(()=>window.location.hash==='')
  check(theme+' recovery tokens are stripped from the URL',hashCleared)
  await page.getByRole('button',{name:'Update Password'}).click()
  await page.getByRole('heading',{name:'Password updated'}).waitFor()
  check(theme+' new password is submitted to Supabase',state.passwordUpdates.some(u=>u.password==='Local-test-9!x'),JSON.stringify(state.passwordUpdates))
  const signedOut=await page.evaluate(()=>!Object.keys(localStorage).some(k=>k.includes('auth-token')))
  check(theme+' recovery session is signed out after the change',signedOut)
  await page.screenshot({path:path.join(resultDir,'reset-'+theme+'-done.png'),fullPage:true})

  // 3. A dead link explains itself instead of showing the form.
  await page.goto(base+'reset-password')
  await page.getByRole('heading',{name:/no longer valid/i}).waitFor()
  check(theme+' expired link shows recovery guidance',await page.getByRole('link',{name:'Request a New Link'}).isVisible())

  await ctx.close()
}
await browser.close()
await server.close()
console.log(JSON.stringify({passed:passed.length,failed:failed.length,failures:failed}))
process.exit(failed.length?1:0)
