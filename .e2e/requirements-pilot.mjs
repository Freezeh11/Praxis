/** Isolated browser regression. No accounts, network APIs, or database writes.
 * Run: node .e2e/requirements-pilot.mjs
 * Set PRAXIS_PLAYWRIGHT_MODULE to an installed Playwright package if needed.
 */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { mkdir } from 'node:fs/promises'
import { createServer } from '../frontend/node_modules/vite/dist/node/index.js'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PRAXIS_PLAYWRIGHT_MODULE || 'playwright')
const root = fileURLToPath(new URL('../frontend', import.meta.url))
process.chdir(root)
const virtualPath = path.join(root, '__requirements-pilot.jsx').replaceAll('\\', '/')
const fixture = `
import React, {useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {useGameState} from '/src/state/useGameState.js';
import LawPanel from '/src/components/puzzle/LawPanel.jsx';
import DerivationCanvas from '/src/components/puzzle/DerivationCanvas.jsx';
import {nodeText} from '/src/engine/index.js';
import laws from '/@fs/${fileURLToPath(new URL('../content/laws.json', import.meta.url)).replaceAll('\\', '/')}';
import '/src/styles/index.css';
const simple={expr:'A + AB',goal:'A',targetLaws:['absorption'],optimalSteps:1};
function Fixture(){
 const guided=new URLSearchParams(location.search).has('guided');
 const game=useGameState({independent:!guided});
 useEffect(()=>{game.loadPuzzle(simple)},[]);
 window.pilot={...game, text:game.expr?nodeText(game.expr):'',load:game.loadPuzzle};
 return <div style={{height:'100vh',display:'flex',flexDirection:'column'}}>
 <div data-testid="state">{game.statusMsg}</div>
 <DerivationCanvas {...game} statusMsg={game.statusMsg} zoom={1} inspectedStepIdx={null} setInspectedStepIdx={()=>{}} onClickLit={p=>game.handleClickLit(p,game.expr)} onClickTerm={p=>game.handleClickTerm(p,game.expr)} onClickNot={p=>game.handleClickNot(p,game.expr)} swapTerms={game.swapTerms}/>
 <LawPanel {...game} independent={!guided} referenceLaws={laws} busy={game.isAnimating||game.isPreLawHighlight} onApplyLaw={law=>game.applyLaw(law)} onOpenLaws={()=>{}} lawsAsStrip={innerWidth<900} onOpenScoreSummary={()=>{}}/>
 </div>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
`
const server = await createServer({
  root, configFile: path.join(root, 'vite.config.js'),
  server: { host: '127.0.0.1', port: 0, open: false },
  plugins: [{
    name: 'requirements-pilot-fixture',
    enforce: 'pre',
    resolveId(id) { if (id === '/__requirements-pilot.jsx' || id === virtualPath) return virtualPath },
    load(id) { if (id === virtualPath) return fixture },
    configureServer(vite) {
      vite.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/__pilot.html')) return next()
        res.setHeader('Content-Type', 'text/html')
        res.end(await vite.transformIndexHtml(req.url, '<html><body style="margin:0"><div id="root"></div><script type="module" src="/__requirements-pilot.jsx"></script></body></html>'))
      })
    },
  }],
})
let browser
try {
  await server.listen()
  const base = server.resolvedUrls.local[0]
  browser = await chromium.launch({ headless: true, channel: process.env.PRAXIS_BROWSER_CHANNEL || 'chromium' })
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  page.setDefaultTimeout(15000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') console.error(message.text()) })
  await page.goto(base + '__pilot.html')
  await page.waitForFunction(() => window.pilot?.text === 'A + AB').catch(async error => {
    console.error(JSON.stringify({ errors, body: (await page.locator('body').innerText()).slice(0, 1500) }))
    throw error
  })
  assert.equal(await page.locator('[data-law-id]').count(), 9)
  if (process.env.PRAXIS_PILOT_SCREENSHOTS) {
    await mkdir(process.env.PRAXIS_PILOT_SCREENSHOTS, { recursive: true })
    await page.screenshot({ path: path.join(process.env.PRAXIS_PILOT_SCREENSHOTS, 'pilot-desktop.png') })
  }
  await page.locator('[data-law-id="complement"]').click()
  await page.waitForFunction(() => window.pilot.choiceAttempts.length === 1)
  assert.equal(await page.evaluate(() => window.pilot.steps.length), 0)
  assert.equal(await page.evaluate(() => window.pilot.choiceAttempts[0].outcome), 'selection')
  await page.evaluate(() => window.pilot.handleClickTerm('R.0', window.pilot.expr))
  await page.waitForFunction(() => window.pilot.sel.length === 1)
  await page.evaluate(() => window.pilot.handleClickTerm('R.1', window.pilot.expr))
  await page.waitForFunction(() => window.pilot.sel.length === 2)
  assert.equal(await page.locator('[data-law-id]').count(), 9)
  assert.ok(!(await page.locator('[data-testid="state"]').innerText()).includes('Applicable:'))
  await page.locator('[data-law-id="complement"]').click()
  await page.waitForFunction(() => window.pilot.choiceAttempts.length === 2)
  assert.match(await page.locator('[data-testid="state"]').innerText(), /Complement needs/)
  assert.equal(await page.evaluate(() => window.pilot.text), 'A + AB')
  // Same-tick rapid input must only commit one step.
  await page.evaluate(() => {
    const law={id:'absorption'}
    window.pilot.applyLaw(law)
    window.pilot.applyLaw(law)
  })
  await page.waitForFunction(() => window.pilot.isComplete)
  assert.equal(await page.evaluate(() => window.pilot.steps.length), 1)
  assert.equal(await page.evaluate(() => window.pilot.choiceAttempts.length), 3)
  assert.equal(await page.evaluate(() => window.pilot.steps[0].lawId), 'absorption')
  // Undo, assistance and reset remain functional.
  await page.evaluate(() => window.pilot.undoAction())
  await page.waitForFunction(() => !window.pilot.isComplete && window.pilot.steps.length === 0)
  await page.evaluate(() => window.pilot.activateGuide())
  await page.waitForFunction(() => window.pilot.sel.length === 2)
  await page.locator('[data-law-id="absorption"]').click()
  await page.waitForFunction(() => window.pilot.isComplete)
  assert.equal(await page.evaluate(() => window.pilot.choiceAttempts.at(-1).assisted), true)
  await page.evaluate(() => window.pilot.undoAction())
  await page.waitForFunction(() => !window.pilot.isComplete)
  await page.setViewportSize({width:844,height:390})
  assert.equal(await page.locator('[data-law-id]').count(), 9)
  await page.locator('[data-law-id="demorgan-or"]').scrollIntoViewIfNeeded()
  assert.equal(await page.locator('[data-law-id="demorgan-or"]').isVisible(), true)
  if (process.env.PRAXIS_PILOT_SCREENSHOTS) await page.screenshot({path:path.join(process.env.PRAXIS_PILOT_SCREENSHOTS,'pilot-phone.png')})
  await page.setViewportSize({width:1280,height:720})
  // Reset during the pre-law delay cancels the pending transformation.
  await page.goto(base + '__pilot.html?guided=1')
  await page.waitForFunction(() => window.pilot?.text === 'A + AB')
  assert.equal(await page.locator('[data-law-id]').count(), 0)
  await page.evaluate(() => window.pilot.handleClickTerm('R.0',window.pilot.expr))
  await page.waitForFunction(() => window.pilot.sel.length === 1)
  await page.evaluate(() => window.pilot.handleClickTerm('R.1',window.pilot.expr))
  await page.waitForFunction(() => window.pilot.applicableLaws.length > 0)
  assert.equal(await page.locator('[data-law-id]').count(), 1)
  await page.evaluate(() => {
    window.pilot.applyLaw(window.pilot.applicableLaws[0],window.pilot.expr,[],0,true)
    window.pilot.resetPuzzle({expr:'A + AB',goal:'A',targetLaws:['absorption'],optimalSteps:1})
  })
  await page.waitForTimeout(3000)
  assert.equal(await page.evaluate(() => window.pilot.steps.length), 0)
  assert.equal(await page.evaluate(() => window.pilot.isPreLawHighlight), false)
  // Desktop and phone: both axes of long derivations remain reachable.
  for (const viewport of [{width:1280,height:720},{width:844,height:390}]) {
    await page.setViewportSize(viewport)
    await page.evaluate(() => {
      const from=Array.from({length:35},()=> 'ABCD').join(' + ')
      window.pilot.load({expr:'A + AB',goal:'A',targetLaws:['absorption'],optimalSteps:1},Array.from({length:20},()=>({law:'Identity Law',from,to:from})))
    })
    await page.waitForFunction(() => window.pilot.steps.length === 20)
    const size=await page.locator('[data-testid="derivation-scroll"]').evaluate(el=>{
      el.scrollTop=el.scrollHeight;el.scrollLeft=el.scrollWidth
      return {vertical:el.scrollTop,horizontal:el.scrollLeft,height:el.clientHeight}
    })
    assert.ok(size.vertical>0 && size.horizontal>0 && size.height>50, JSON.stringify(size))
    if (process.env.PRAXIS_PILOT_SCREENSHOTS) await page.screenshot({ path: path.join(process.env.PRAXIS_PILOT_SCREENSHOTS, `overflow-${viewport.width}.png`) })
  }
  await page.evaluate(() => window.pilot.load({expr:"A + A'B",goal:'A+B',targetLaws:[],optimalSteps:1}))
  await page.waitForFunction(() => !window.pilot.isComplete && window.pilot.text === "A + A'B")
  const unavailable=await page.evaluate(()=>({hint:window.pilot.requestHint(),guide:window.pilot.activateGuide()}))
  assert.match(unavailable.hint,/could not be verified/)
  assert.equal(unavailable.guide,false)
  assert.equal(await page.evaluate(()=>window.pilot.hintsUsed+window.pilot.guidesUsed),0)
  assert.deepEqual(errors, [])
  console.log('PASS: independent choices, corrective feedback, atomic application, assisted decisions, guided compatibility, reset cancellation, desktop/mobile overflow; no page errors')
} finally {
  await browser?.close()
  await server.close()
}
