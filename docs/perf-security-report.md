# Performance & Security Pass — Praxis

Scope: frontend build/bundle, route delivery, three engine hot paths, SPA + API
security headers, CORS, secret/CSP/auth hygiene. Product behaviour, routes,
guards and visual design are unchanged.

All numbers below come from `cd frontend && npm run build` (Vite 8.2.2 /
rolldown), run before the change and again after, on the same machine.

---

## 1. Bundle: baseline vs after

### Baseline (before)

| asset | raw | gzip |
| --- | --- | --- |
| `dist/assets/index-*.js` (single chunk) | **960.78 kB** | **272.45 kB** |
| `dist/assets/index-*.css` | 99.15 kB | 16.81 kB |
| `dist/index.html` | 0.96 kB | 0.51 kB |

One JS chunk, 611 modules, build warning "chunks larger than 500 kB".

### After

| asset | raw | gzip |
| --- | --- | --- |
| entry `index-*.js` | 54.27 kB | 17.90 kB |
| `react-*.js` (vendor) | 221.25 kB | 70.77 kB |
| `supabase-*.js` (vendor) | 199.50 kB | 51.13 kB |
| `motion-*.js` (framer-motion) | 132.83 kB | 43.42 kB |
| `engine-*.js` (src/engine) | 43.88 kB | 13.50 kB |
| `vendor-*.js` (remaining deps) | 32.62 kB | 9.13 kB |
| `rolldown-runtime-*.js` | 0.90 kB | 0.51 kB |
| `ProblemPage-*.js` (workspace, lazy) | 185.92 kB | 48.11 kB |
| `gameContent-*.js` | 18.20 kB | 4.34 kB |
| `LevelSelectPage-*.js` | 14.36 kB | 4.13 kB |
| `StageSelectorPage-*.js` | 16.08 kB | 4.47 kB |
| `ProfilePage-*.js` | 26.49 kB | 7.28 kB |
| `SubmitButton-*.js` | 10.61 kB | 3.93 kB |
| `ScoreGateBar-*.js` | 9.00 kB | 3.15 kB |
| `RegisterPage-*.js` | 5.97 kB | 2.42 kB |
| `PasswordField-*.js` | 4.86 kB | 1.68 kB |
| `LoginPage-*.js` | 3.99 kB | 1.79 kB |
| `LawCard-*.js` | 1.73 kB | 0.86 kB |
| `ExprText-*.js` | 1.34 kB | 0.66 kB |
| `index-*.css` | 116.15 kB | 18.32 kB |

**Chunk counts:** 1 JS chunk → **19 JS chunks** (+1 stylesheet, unchanged: the
split emits a single CSS asset, no duplication).

**Initial payload** (entry + the modulepreloads `dist/index.html` actually
emits — runtime, motion, react, vendor, supabase, engine):
**685.25 kB raw / 206.36 kB gzip**, down from 960.78 kB / 272.45 kB
→ **−28.7 % raw, −24.3 % gzip**; largest chunk 960.78 → 221.25 kB, so the
">500 kB" build warning is gone.

**Deferred until navigation** (previously all eagerly parsed and executed on
first paint): `ProblemPage` 185.92 kB + `gameContent` 18.20 kB +
`LevelSelectPage` 14.36 + `StageSelectorPage` 16.08 + `ProfilePage` 26.49 +
auth/puzzle sub-chunks ≈ 300 kB raw that a landing/login visitor never parses.

Caveat on CSS: 99.15 → 116.15 kB. That growth is not from splitting (one
stylesheet, same Tailwind pipeline) — it happened while other agents were
editing page classes in the same working tree; it is reported as measured.

---

## 2. Optimizations

### 2.1 Route-level code splitting — `frontend/src/App.jsx:21-26, 45-57, 76-101`

The seven page components are now `React.lazy(() => import(...))`
(`frontend/src/App.jsx:21-26`); only `LandingPage` stays eager so the cold
landing paint has no extra request waterfall. `<Routes>` is wrapped in one
`<Suspense fallback={<RouteFallback />}>` (`frontend/src/App.jsx:76-101`).

`RouteFallback` (`frontend/src/App.jsx:49-57`) reuses the app's existing
`frontend/src/components/ui/LoadingSpinner.jsx` plus the existing tokens
(`text-text-2`, transparent background so `LogicCircuitBackdrop` shows
through), is `role="status" aria-live="polite"`, and fills the viewport so the
chunk fetch never flashes a blank screen.

Route paths, nesting, `ProtectedRoute`/`TutorialGate` guards, the catch-all
redirect, `RouteBackdrop`, `OrientationGate` and `Toaster` are byte-identical
to before.

### 2.2 Vendor chunking + build target — `frontend/vite.config.js:17-36, 127-129`

`build.rollupOptions.output.manualChunks` splits `node_modules` into stable
vendor groups — `react`, `motion`, `supabase`, `vendor` — and `src/engine/`
into `engine`. Why: (a) those groups change on a different cadence than app
code, so a deploy invalidates only the chunks that actually changed; (b) the
browser can download them in parallel with the entry; (c) the solver/law engine
stops being co-mingled with React so its cost is attributable. `build.target`
is pinned to `es2020` (top-level await is not used; this keeps the output
parseable by every browser the app's Tailwind/React 19 baseline already needs).

The dev server block (`frontend/vite.config.js:107-123`) is untouched: same
default port 5173, same `/api` → `http://127.0.0.1:8000` and
`/api/auth` → `http://127.0.0.1:3001` proxies, same `server.fs.allow`.

### 2.3 O(1) BFS dequeue — `frontend/src/engine/solver.js:211-217, 311-317, 405-411`

All three searches (`findOptimalPath`, `findOptimalPathWithLaws`,
`findSimplestForm`) dequeued with `queue.shift()`, which is O(n) per call and
therefore O(n²) in the state budget (3000 graded / 8000 generator states) — all
of it on the main thread while a puzzle loads. Each loop now keeps a read cursor
(`let head = 0` … `const current = queue[head++]`), preserving exact FIFO order
and therefore identical search results and budget accounting (the budget is
`statesExplored`, not the queue length).

Honest measurement: in an A/B run on the hardest shipped 5-term expression the
whole `findSimplestForm` pass measured 3.1–3.2 s both before and after — the
quadratic dequeue cost is dwarfed by `getLegalTransitions` (measured 7.55 ms per
state). So this removes an asymptotic cliff that would bite if budgets grow, but
it is **latency-neutral at today's budgets**; it is not counted as a load win.

### 2.4 `exprHistory` rebuilt every render — `frontend/src/state/useGameState.js:22-27`

`history.slice(0, -1).map(h => h.expr)` ran on every render of the workspace
hook — including the renders caused by hover/selection/status changes, which are
the most frequent ones while solving. It is now a `useMemo` keyed on
`[history]`; the array only changes when a step is applied.

### 2.5 Duplicate `selectionLaws()` per guide activation — `frontend/src/state/useGameState.js:728-735`

`activateGuide` called `selectionLaws(expr, nextSel, engineOptions)` twice with
identical arguments (once to find the guided law, once for the palette) on every
"guide me" click. It now computes the list once and derives the guided law from
it. Measured cost of one call on the 4-variable worst case: 0.04 ms — a
cleanup, not a headline win, but it removes redundant work from a click handler.

---

## 3. Security

### 3.1 Findings and fixes

| # | Severity | Finding | Evidence | Action |
| --- | --- | --- | --- | --- |
| S1 | **Medium** | Only a bare `.env` was ignored; `.env.local`, `.env.production`, `.env.*.local` were committable, and `frontend/.env.local` does exist locally | `.gitignore` (before: line ` .env `) | Fixed: `.gitignore:3-5` now `.env*` + `!.env.example`. No env file is currently tracked |
| S2 | Info | Secret exposure in the client bundle | `frontend/src/services/supabaseClient.js` builds the client from `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` (anon/publishable key — public by design). The service-role key appears only in `backend/supabase_client.py` (server side, `apikey` + `Bearer` headers) and `render.yaml` keeps `SUPABASE_SERVICE_KEY` as `sync: false` | Verified clean; nothing to fix |
| S3 | **Medium** | API CORS allowed every method and every request header | `backend/main.py` (before: `allow_methods=["*"]`, `allow_headers=["*"]`) | Fixed `backend/main.py:34-45`: `allow_methods=["GET","POST","OPTIONS"]`, `allow_headers=["Accept","Authorization","Content-Type"]` (exactly what `frontend/src/services/apiClient.js` sends), `expose_headers=["X-Request-ID"]`, `max_age=600`. Origins come from an explicit allowlist |
| S4 | **Medium** | No browser security headers on any API response (no nosniff, no framing protection, no referrer policy) | no middleware existed | Fixed: new `backend/core/security_headers.py:18-45`, registered outermost in `backend/main.py:45` — `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`, and a denying CSP (`default-src 'none'; frame-ancestors 'none'`) on every path except `/docs`, `/redoc`, `/openapi.json` so Swagger UI still renders |
| S5 | **Medium** | The SPA shipped no CSP at all | `frontend/index.html` had no CSP meta | Fixed: strict policy in `frontend/index.html:16`, refined at build time by `frontend/vite.config.js:39-89` (see 3.2) |
| S6 | Low (documented) | No rate limiting on `POST /api/score` or `POST /api/progress/save`. Both require a valid Supabase JWT and both are pydantic-validated, so the blast radius is a user spamming their own rows; adding a limiter means new infrastructure (Redis/slowapi) | `backend/api/routes/score.py`, `backend/api/routes/progress.py` | Documented, not built — out of "trivial, no new infrastructure" |
| S7 | Low (documented) | Session persisted in `localStorage` by supabase-js (its default). Any XSS would be able to read it. No hand-rolled token storage exists in app code, and the new CSP removes inline-script and third-party-script vectors | `frontend/src/state/AuthProvider.jsx`, `frontend/src/services/supabaseClient.js` | Kept as-is (switching to cookie-based auth is a product/backend change); risk reduced by the CSP |
| S8 | Info | Logout scope | `frontend/src/services/authActions.js` uses `supabase.auth.signOut({ scope: 'global' })` after a password change — the correct, broadest revocation; normal sign-out revokes the current session | Correct, no change |
| S9 | Info | Open redirect on `?next=` | No `next`/`redirect` query parameter is read anywhere; post-auth navigation is hardcoded — `frontend/src/pages/LoginPage.jsx:37` (`/ `), `frontend/src/pages/RegisterPage.jsx:44` (`/levels`), `frontend/src/pages/ProfilePage.jsx:191` (`/ `) | No open-redirect surface; nothing to fix |
| S10 | Info | Request-body validation | Every POST endpoint is pydantic-modelled: `backend/api/schemas/score.py` (`ScoreRequest`), `backend/api/schemas/progress.py` (`SaveProgressRequest`/`ProgressData`). No endpoint reads `await request.json()` or `request.body()` raw — verified by grep across `backend/api/` | No raw-input endpoint found |
| S11 | Low (follow-up) | The SPA itself can still be framed: `frame-ancestors` is ignored in a `<meta>` CSP, and static hosting needs a response header | `frontend/index.html:16` (meta only) | Needs `frontend/vercel.json` headers (outside this pass's write scope). Recommended: `{"headers":[{"source":"/(.*)","headers":[{"key":"Content-Security-Policy","value":"frame-ancestors 'none'"},{"key":"X-Frame-Options","value":"DENY"},{"key":"X-Content-Type-Options","value":"nosniff"}]}]}` |

### 3.2 The CSP, in detail

Policy shipped in `frontend/index.html:16` (production shape):

```
default-src 'self'; base-uri 'self'; object-src 'none'; form-action 'self';
script-src 'self';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com data:;
img-src 'self' data: blob:; connect-src 'self' https://*.supabase.co wss://*.supabase.co;
worker-src 'self' blob:; manifest-src 'self'
```

`frontend/vite.config.js:39-89` rewrites the `data-praxis-csp` meta through
`transformIndexHtml`:

* `connect-src` is built from **`VITE_SUPABASE_URL`** at build time (the same
  env var `supabaseClient.js` uses), adding `wss://` for realtime, falling back
  to `https://*.supabase.co` when unset. The built `dist/index.html` currently
  contains the project's own origin, no wildcard.
* In dev (`command === 'serve'`) only, `connect-src` also allows
  `localhost/127.0.0.1:8000` (API) and `:3001` (auth), plus
  `ws://localhost:5173`/`ws://127.0.0.1:5173` for HMR, and `script-src` adds
  `'unsafe-inline' 'unsafe-eval'` because React Refresh injects an inline
  preamble. Production keeps `script-src 'self'` with no inline exception.
* `style-src` allows `'unsafe-inline'` because framer-motion writes style
  attributes at runtime and `index.html` loads Google Fonts CSS.
* `frame-ancestors` is deliberately **not** in the meta (browsers ignore it
  there and log a console error); the API sends it, see S4/S11.
* `frontend/index.html:8` adds `<meta name="referrer" content="strict-origin-when-cross-origin" />`.

Harness compatibility: `.e2e/_harness.mjs` mocks Supabase with Playwright
`route()` interception (fulfilled at the network layer, unaffected by CSP) and
seeds state with `addInitScript` (CDP-injected, exempt from page CSP), so the
contrast/screenshot suites are not affected by `script-src 'self'`.

### 3.3 Backend allowlist

`backend/config/settings.py:31-40` adds `parse_origins()` (comma-separated,
trimmed, trailing slash stripped, blanks dropped).
`backend/config/settings.py:72` reads `CORS_ALLOW_ORIGINS` from the
environment; `build_cors_origins()` (`backend/config/settings.py:76-88`) uses
that list when set, otherwise the localhost dev defaults
(`http://localhost:5173`, `http://127.0.0.1:5173`, `http://localhost:3001`),
always appending the normalised `FRONTEND_URL`, de-duplicated. Production can
therefore stop allowing `localhost` just by setting `CORS_ALLOW_ORIGINS`.

Middleware order registered in `backend/main.py:33-45` (outermost first at
runtime): `SecurityHeadersMiddleware` → `CORSMiddleware` →
`RequestContextMiddleware`, so preflight responses and the error envelopes also
carry the headers while request-id logging still sees every request.

---

## 4. Deliberately not changed

* **`engine` still loads on first paint** (43.88 kB, modulepreloaded in
  `dist/index.html`). Something in the eager entry graph pulls
  `src/engine/index.js`; removing it needs edits to the guard/overlay components
  that are outside this pass's file ownership. Cost is bounded (43.88 kB raw /
  13.50 kB gzip) and it is cached separately, so it was left and recorded.
* **The solver's 3.2 s worst case** for the hardest shipped 5-term expression
  (`findOptimalPathWithLaws` on load) is unchanged. It is dominated by
  `getLegalTransitions` (7.55 ms/state), not by the dequeue fix; reworking it
  would change grading/hint behaviour, so it is documented rather than touched.
* **No rate-limit infrastructure** (S6) and **no host-level headers / vercel
  rewrites** (S11) — both need files or infrastructure outside this pass.
* **Auth model**: supabase-js localStorage session, provider, guards, tutorial
  gate (S7–S9). No visual classes, design tokens, sound files or page layout
  were touched.
* **CSS growth** (99.15 → 116.20 kB) came from concurrent edits elsewhere in the
  tree; the split itself emits one stylesheet, so there was nothing to correct.
* The legacy root app (`index.html`, `style.css`, `js/*.js` at the repo root) is
  a separate static prototype and was left alone.

---

## 5. Verification

| check | command | result |
| --- | --- | --- |
| production build | `cd frontend && npm run build` | **exit 0**, Vite 8.2.2, 618 modules, 1.29 s, no >500 kB warning |
| lint (touched files) | `cd frontend && npx eslint src/App.jsx vite.config.js src/engine/solver.js src/state/useGameState.js` | **exit 0**, no findings |
| backend import | `cd backend && SUPABASE_URL=... SUPABASE_SERVICE_KEY=... python3 -c 'import main'` | loads: 9 routes, middleware `[SecurityHeadersMiddleware, CORSMiddleware, RequestContextMiddleware]` |
| engine tests | `cd frontend && npm test` | 93 tests, 90 pass, **3 pre-existing failures** (see below) |
| CSP output | inspect `dist/index.html` | meta present with the project's Supabase origin in `connect-src`, `script-src 'self'` |

Pre-existing test failures, not caused by this pass: `A'BC'D + A'BCD + ABC'D +
ABCD + A'B'CD stays equivalent, terminal and irredundant`, the
`law-soundness.property.test.js` property suite, and "the published four-variable
expressions all build a playable puzzle". Proof: a temp copy of `src` with the
BFS change reverted (back to `queue.shift()`) produces the same 3 failures
(93 / 90 / 3) — the failures come from earlier engine edits in the same tree.

One transient interruption: at 23:48 the shared `frontend/src/config/gameRules.js`
was mid-edit by another agent (stray `}` at line 433), which failed the build;
the owner fixed it and the final build above is green.
