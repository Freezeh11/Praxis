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

* **`engine` still loads on first paint** (superseded by §6.1: the landing page
  no longer requests the engine, motion or Supabase chunks) (43.88 kB, modulepreloaded in
  `dist/index.html`). Something in the eager entry graph pulls
  `src/engine/index.js`; removing it needs edits to the guard/overlay components
  that are outside this pass's file ownership. Cost is bounded (43.88 kB raw /
  13.50 kB gzip) and it is cached separately, so it was left and recorded.
* **The solver's 3.2 s worst case** (improved −12.9% in §6.4, still seconds) for the hardest shipped 5-term expression
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

---

## 6. Round 10 — runtime, render and API pass

Everything below is measured on the same machine as sections 1–5 with
`cd frontend && npm run build` (Vite 8, rolldown) and Node 24. The earlier
numbers stay as the record of that pass; this section supersedes them.

### 6.1 First paint: the landing page no longer ships the app

| asset requested by `/` | raw | gzip |
| --- | --- | --- |
| entry `index-*.js` | 48.31 kB | **15.74 kB** |
| `react-*.js` | 229.10 kB | **73.25 kB** |
| `vendor-*.js` | 32.58 kB | **9.12 kB** |
| `config-*.js` (game rules, split out of the solver chunk) | 4.91 kB | **2.08 kB** |
| `useSession-*.js` | 4.29 kB | 2.38 kB |
| `rolldown-runtime-*.js` | 0.90 kB | 0.51 kB |
| `index-*.css` | 116.54 kB | **18.34 kB** |
| **total JS+CSS** | | **≈121 kB** |

The landing page previously also downloaded `motion` (43.42 kB gz), `supabase`
(51.13 kB gz) and `engine` (13.50 kB gz) — three chunks it never executes. A
Playwright request log against a production preview confirms the list above and
nothing else (fonts aside).

What changed:

* **Route-level lazy chunks** for every page except the landing page, each wrapped
  in its own `LazyMotion` boundary (`frontend/src/App.jsx`). The motion feature
  bundle is now a dependency of the first *animated* page, not of the entry, so
  `es-*.js` (113.73 kB / 36.56 kB gz) is fetched on navigation at the earliest.
* **Framer removed from the hero.** `LandingPage` animates with the `praxis-rise`
  CSS keyframe (`frontend/src/styles/utilities.css`): opacity and `translateY`
  only, dropped under `prefers-reduced-motion`.
* **Supabase SDK on demand.** `frontend/src/services/supabaseClient.js` no longer
  calls `createClient` at import time; `getSupabase()` memoises a dynamic import.
  `AuthProvider` connects immediately only when a stored session exists,
  otherwise on first interaction, so an anonymous visitor never downloads the
  51 kB gz SDK to read the landing page.
* **Chunk map** (`frontend/vite.config.js`): `config` is matched before `engine`,
  so `src/config` no longer rides the solver chunk into the landing preload list;
  framer-motion has its own chunk.

The workspace chunk stays heavy by design (188.64 kB / 48.97 kB gz: solver, law
palette, all modals), but it is fetched once, after the learner has a session and
has passed the tutorial gate.

### 6.2 React: a click on a term repaints one subtree

* `zoom` left `ProblemPage` state for `ZoomProvider`/`zoomStore`
  (`frontend/src/components/puzzle/ZoomProvider.jsx`, `zoomStore.js`). Zooming
  now repaints the canvas, the header and the step rail only; the law palette,
  level panel and history do not re-render.
* `LawPanel`, `SidePanel`, `StepHistoryPanel`, `DerivationCanvas` and
  `WorkspaceHeader` are `memo` components; every handler passed from
  `ProblemPage` is a `useCallback` with real dependencies, so a term click or a law
  hover no longer invalidates the whole workspace tree.
* `LawPanel` resolves the selectable laws once per (reference laws, selection)
  pair with `useMemo` instead of on every render; the completed-stage `Set` is
  memoised per level instead of being rebuilt each render.
* The session dialog renders above the router, so it carries its own motion
  boundary rather than reaching for a page provider that may not exist.

### 6.3 Progress data: stale-while-revalidate

`frontend/src/state/progressStore.js` caches the last server snapshot per user for
24 h (`praxis_server_v1_<id>`) and merges it with local progress (values only
rise). A reload paints the real figures on the first frame and revalidates in the
background; routes no longer hold a spinner until `/api/progress` answers. The
save path refreshes the cache when the server confirms a write.

### 6.4 Engine: memoised renderings and transition sweeps

`frontend/src/engine/render.js` memoises `nodeText` per node (`WeakMap`, ~85% hit
rate during a law search) and `canonText` per tree root only — per-node canon
entries were measured at 8% hits and 2× the cost, so they were rejected.
`frontend/src/engine/tree.js` `setNode` forgets the edited node and every ancestor,
the engine's only in-place edit path.

`getLegalTransitions` (`frontend/src/engine/solver.js`) memoises its sweep in a
200-entry LRU keyed by a nesting-preserving structural signature plus palette and
expansion flags (`a + (b + c)` must not collide with `a + b + c`). Callers get
their own array; transition objects are shared because law application always
clones the tree it returns.

`planGuidance` (`frontend/src/engine/practice.js`) now runs the root transition
sweep once and reuses it instead of re-deriving it from a cache the search has
already evicted.

Measured (4-variable graded case, 6-term sandbox, median of three fresh
processes):

| operation | before | after | change |
| --- | --- | --- | --- |
| `findOptimalPath` (graded) | 846 ms | 737 ms | **−12.9%** |
| `planGuidance` (graded hint) | 841 ms | 737 ms | **−12.4%** |
| `findSimplestForm` (6-term sandbox) | 3647 ms | 3107 ms | **−14.8%** |

The specified truth-table LRU for `isEquivalent` was implemented, measured and
**rejected**: canonicalising both trees to build the key costs more than the 2–16
row table it skips (+25% on the sandbox search, +4% on the graded path). The win
came from removing allocations instead — one reused env object per table and
plain loops instead of `every`/`some` closures.

### 6.5 API: pooled clients, gathered I/O, gzip, cache policy

* `backend/supabase_client.py`: one sync and one async `httpx.Client` per process
  with explicit timeouts and limits, closed from the app lifespan
  (`backend/main.py`) — no more client per query, and async routes no longer
  block the loop on a sync Supabase round trip.
* `backend/services/progress_service.py`: independent reads are gathered, a save
  issues its stage upserts concurrently instead of N+1 serial round trips, and
  gathered rows are sorted before they become the API payload (they arrive
  unordered).
* `backend/main.py`: `GZipMiddleware` with a 1 kB floor.
* `backend/core/security_headers.py`: `/api/levels` and `/api/laws` are cacheable
  public reads (`max-age=300, stale-while-revalidate=86400`); authenticated
  responses stay `no-store`.

### 6.6 Deliberately not changed

* **Fonts remain render-blocking** (Google Fonts CSS + two woff2). Self-hosting
  would remove the external connection setup but changes `index.html` and the CSP
  allowlist; left for a follow-up with the font files in the repo.
* **`frontend/src/pages/SandboxPage.jsx` and `components/layout/BackNav.jsx` are
  unreferenced** (the unified `/sandbox` route renders `ProblemPage`). Both are
  outside the bundle; deleting them is a separate cleanup.
* **The 6-term sandbox build is still seconds-long** even after −14.8%; it is a
  bounded search, not repeated work, and lowering it further means changing the
  search or the puzzle contract.

### 6.7 Verification

| check | command | result |
| --- | --- | --- |
| production build | `cd frontend && npx vite build` | **exit 0**, 1.33 s |
| unit tests | `cd frontend && npm test` | **100 / 100** (97 existing + 3 cache tests) |
| backend tests | `cd backend && ./venv/bin/python3.14 -m pytest -q` | **21 passed** |
| application regression | `node .e2e/application-regression.mjs` | **18 / 18** |
| contrast audit | `node .e2e/theme-contrast.mjs` | every label clean, both themes |
| workspace layout | `node .e2e/workspace-layout.mjs` | **8 / 8** |
| password recovery | `node .e2e/password-reset.mjs` | **12 / 12** |
| landing network | Playwright request log on `vite preview` | entry + react + vendor + config + useSession + css, no motion/supabase/engine |

Lint over `frontend/src` remains at its pre-existing baseline: 10 errors and 3
warnings, all `react-hooks/set-state-in-effect` / `exhaustive-deps` findings in
files this pass did not touch (confirmed against `git archive HEAD`).
