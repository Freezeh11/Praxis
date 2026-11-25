import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createServer} from '../frontend/node_modules/vite/dist/node/index.js'

const require=createRequire(import.meta.url)
const {chromium}=require(process.env.PRAXIS_PLAYWRIGHT_MODULE || 'playwright')
const root=fileURLToPath(new URL('../frontend',import.meta.url))
process.chdir(root)
// The dev CSP narrows connect-src to the configured Supabase origin; tests mock that origin.
process.env.VITE_SUPABASE_URL='https://praxis-test.invalid'
process.env.VITE_SUPABASE_PUBLISHABLE_KEY='isolated-test-key'
const server=await createServer({root,configFile:path.join(root,'vite.config.js'),define:{'import.meta.env.VITE_SUPABASE_URL':JSON.stringify('https://praxis-test.invalid'),'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY':JSON.stringify('isolated-test-key')},server:{host:'127.0.0.1',port:5193,strictPort:true,open:false}})
await server.listen()
const base=server.resolvedUrls.local[0]
const browser=await chromium.launch({headless:true})
const user={id:'00000000-0000-4000-8000-000000000001',aud:'authenticated',role:'authenticated',email:'learner@example.test',email_confirmed_at:'2026-01-01T00:00:00Z',created_at:'2026-01-01T00:00:00Z',app_metadata:{provider:'email'},user_metadata:{name:'Test learner'},identities:[{provider:'email'}]}
const now=Math.floor(Date.now()/1000)
const token=[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:user.id,aud:'authenticated',exp:now+3600,iat:now})).toString('base64url'),'sig'].join('.')
const session={access_token:token,refresh_token:'isolated-refresh',token_type:'bearer',expires_in:3600,expires_at:now+3600,user}
const seen={passwordUpdates:[],logouts:[]}
const ctx=await browser.newContext({viewport:{width:1440,height:960}})
await ctx.route('**/*',async route=>{
  const req=route.request(), url=new URL(req.url())
  const json=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)})
  if(url.hostname==='praxis-test.invalid'){
    if(url.pathname.endsWith('/token'))return json(session)
    if(url.pathname.endsWith('/logout')){seen.logouts.push(url.search);return route.fulfill({status:204})}
    if(url.pathname.endsWith('/user')){if(req.method()==='PUT')seen.passwordUpdates.push(req.postDataJSON());return json(user)}
    return json(session)
  }
  if(url.origin===new URL(base).origin){
    if(url.pathname==='/api/progress'&&req.method()==='GET')return json({success:true,data:{points:200,stageProgress:{},stageScores:{}},error:null})
    if(url.pathname.startsWith('/api/'))return json({success:true,data:{},error:null})
    return route.continue()
  }
  return route.abort('blockedbyclient')
})
const page=await ctx.newPage()
page.setDefaultTimeout(20000)
await page.goto(base+'login')
await page.locator('input[type="email"]').fill(user.email)
await page.locator('input[type="password"]').fill('local-test-password')
await page.locator('button[type="submit"]').click()
await page.waitForURL(base)
await page.goto(base+'profile')
await page.getByRole('button',{name:'Password',exact:true}).click()
await page.locator('#profile-current-password').fill('local-test-password')
await page.locator('#profile-password').fill('Str0ng!pass1')
await page.locator('#profile-confirm-password').fill('Str0ng!pass1')
const logoutRequest=page.waitForRequest(r=>r.url().includes('/logout'),{timeout:15000})
await page.getByRole('button',{name:/Update password/i}).click()
const req=await logoutRequest
await page.waitForTimeout(400)
assert.equal(seen.passwordUpdates.length,1,'one password update')
assert.equal(seen.passwordUpdates[0].password,'Str0ng!pass1')
assert.ok(req.url().includes('scope=global'),'signOut must be global, got '+req.url())
assert.ok(seen.logouts.some(q=>q.includes('scope=global')),'logout endpoint received scope=global')
console.log('PASS password change revokes all sessions:',req.url())
await browser.close()
await server.close()
