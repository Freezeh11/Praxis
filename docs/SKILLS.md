# Skills Demonstrated, and How to Work Here

What this codebase demonstrates about how it was engineered, each claim carrying the file or
count that proves it; then the recipes for changing it. [ARCHITECTURE.md](ARCHITECTURE.md) is the
structural map and the file-per-change index, [REFACTOR_REPORT.md](REFACTOR_REPORT.md) the
before/after. Every number was counted on this branch and every command was read out of
`frontend/package.json`, `.e2e/run-all-suites.sh` or `render.yaml` before being quoted.

## Part 1 — Skills demonstrated, with evidence

**A pure domain engine, framework-free.** `frontend/src/engine/` (26 modules, 3,487 lines) does
parse → tree edits → law detection → truth-table equivalence → BFS solve → score, with no React,
DOM or network reference anywhere in it (`grep -rnE "from 'react|document\.|window\.|fetch\("
src/engine` → 0) — so it runs in bare Node and backs the UI, hints, solver and sandbox alike. Laws
split by selection shape (`laws/{sum,product,not,const}Laws.js`) over one identity table
(`laws/definitions.js`, 16 rows, `LAW_MODE`/`LAW_FORM`), with a whole-expression hint scanner
(`laws/scanHints.js`), a BFS solver (`solver.js`) and solver-verified sandbox puzzles
(`sandbox/{input,generator,pool}.js`, 24 curated entries).

**Unit-testing a pure core.** `engine/__tests__/` holds 5 `node:test` files with 46 cases (10 laws,
10 parser, 9 sandbox, 7 solver, 10 validate); `cd frontend && npm test` reports `# pass 46 # fail 0`
with no browser and no backend — the script is literally
`node --test src/engine/__tests__/*.test.js`.

**A layered FastAPI backend.** 28 Python files / 1,241 lines under `backend/` (excluding `venv/`),
one job per layer: `main.py` is assembly only (5 routers, 4 exception handlers, CORS, middleware);
`api/routes/*.py` are thin transport (18–49 lines each, no queries — `api/routes/laws.py` is 21);
`services/` owns the logic (`scoring_service.py` 115, `progress_service.py` 127); `repositories/`
owns all data access (`content_repository.py`, `progress_repository.py` 73); `core/` owns
cross-cutting concerns and `api/schemas/` the pydantic contracts.

**One response contract, enforced centrally.** `core/responses.py` defines the single
`{success, data, error}` envelope plus the `Envelope`/`ErrorBody` models routes declare as
`response_model`; `core/errors.py` defines `AppError` and four named subclasses (`NotFoundError`,
`ContentUnavailableError`, `UpstreamError`, `UnauthorizedError`) with user-safe `message` and
developer-safe `detail`. `main.py` maps `AppError`, framework `HTTPException`,
`RequestValidationError` (422, still enveloped) and bare `Exception` (generic 500, no internals)
onto that shape.

**Observability in the request path.** `core/logging.py` installs a `JsonFormatter` stamping each
record with the current `request_id` from a `ContextVar`; `core/middleware.py` issues or accepts
`X-Request-ID`, logs one access-log line per request (`method`, `path`, `status`, `duration_ms`),
and catches anything that escapes so even a crash returns the 500 envelope.

**One content source, two consumers.** `content/laws.json` (10 reference cards) and
`content/levels.json` (4 levels, 40 puzzles; level keys `id/name/desc/varCount/puzzles[]`, puzzle
keys `expr/goal/targetLaws/hints/optimalSteps/optimalHint`) are the only copies. The backend reads
them through `content_repository.py` (`CONTENT_DIR = parents[2] / "content"`, behind `lru_cache`);
the frontend bundles the same files through the `@content` Vite alias (`vite.config.js`) into
`frontend/src/content/gameContent.js`. Law `id` is the documented join key between
`content/laws.json` and `engine/laws/definitions.js`.

**State that lives outside React.** `frontend/src/state/progressStore.js` (319 lines) is a
module-level store exposing `subscribe`, `getSnapshot`, `setUser`, actions and pure selectors;
persistence is localStorage on every change plus a debounced `progressApi.saveProgress` push. React
binds to it through `useSyncExternalStore` in `state/useProgress.js`, and the per-puzzle session
machine sits in `state/useGameState.js` — components stay dumb.

**A single network boundary.** `services/apiClient.js` (106 lines) attaches the bearer header,
unwraps the envelope and throws a typed `ApiError` with a `silent` mode for calls that must not break
gameplay. `contentApi.js`, `scoreApi.js`, `progressApi.js` and `authActions.js` sit on top of it;
`supabaseClient.js` (10 lines) is the app's only Supabase connection, and components contain zero
`fetch(`/axios calls.

**Presentational component architecture.** 49 `.jsx` files in `frontend/src/components/`, grouped by
feature (`animations/` 8 law animations + registry + a shared style builder, `puzzle/` 16 files, `tutorial/`, `laws/`,
`layout/`, `ui/`) plus 10 root-level components and 7 route screens in `pages/`. One component per
file, named after the file; `App.jsx` composes the gates (`ProtectedRoute`, `TutorialGate`,
`OrientationGate`, `ErrorBoundary`) around the routes.

**Responsive work by decision, not by sniffing.** `hooks/useDeviceTier.js` (311 lines) exposes a pure
`detectDeviceTier({width, height, isTouch, orientation})` table over `DEVICE_TIERS` `{phone,
tablet-sm, tablet, desktop}`, driven by pointer coarseness and viewport width, with rAF-throttled
listeners and StrictMode-safe cleanup; `components/OrientationGate.jsx`, `RotateOverlay.jsx` and
`RotateBanner.jsx` act on it. Shared layout classes live in `frontend/src/styles/utilities.css` (97
lines, 7 public `praxis-*` utilities) and the 44×44 touch target is `.praxis-touch-target` in
`styles/orientation.css` — 4 call sites in `components/` plus 7 `min-h-[44px]`/`min-w-[44px]`.

**Verification in three independent layers.** (1) 46 engine unit tests; (2)
`.e2e/lead-engine-fingerprint.mjs` dumps `optimalSteps`, legal transitions and hints for every state
on the optimal path of all 40 graded puzzles plus the 24 pool expressions, with baselines committed
in `.e2e/baselines/` — a fresh run on this branch is byte-identical to them (127,168 B default,
129,813 B with `--expand`); (3) 16 browser suites listed in `.e2e/run-all-suites.sh`, driven by
Playwright/Chromium through `.e2e/_harness.mjs`, using 8 named device presets and geometric
assertions (`getBoundingClientRect` fold/overlap checks appear in 9 suites).

**Auth, persistence and schema on a real provider.** Supabase auth is subscribed once in
`state/AuthProvider.jsx` and published through `state/authContext.js` / `state/useSession.js`, with
mutations confined to `services/authActions.js`. The backend validates bearer tokens in
`core/security.py` (`get_current_user` / `optional_user`) via `supabase_client.py`, and all Supabase
access for `user_progress`, `stage_progress` and `score_history` is in
`repositories/progress_repository.py`. `database/init.sql` (58 lines) declares those 3 tables, their
indexes, RLS and policies.

**Scoring parity by construction.** `engine/scoring.js` imports its weights from
`config/gameRules.js`; `services/scoring_service.py` reads the same numbers from
`backend/config/constants.py` (40/30/30 weights, 10-point step and assistance penalties, 90/75 star
thresholds, 80% unlock average). The client estimate only renders instantly; `POST /api/score` is
authoritative and persists through a FastAPI `BackgroundTasks` hook, so scoring never waits on the
database.

**Deployment described as configuration.** `render.yaml` builds `backend/` (`rootDir: backend`, `pip
install -r requirements.txt`, `uvicorn main:app`); `frontend/vercel.json` carries exactly two
rewrites (`/api/(.*)` → the Render host, `/(.*)` → `/index.html` for SPA routing); the frontend ships
as static assets with the content JSON bundled, so the app runs offline with the API as fallback
rather than as a dependency.

## Part 2 — Working in this repo

### Add a level or puzzle

Edit `content/levels.json` only. Both consumers pick it up with no code change: the backend serves it
(`content_repository.list_levels`, `GET /api/levels/{id}`) and the frontend bundles it
(`src/content/gameContent.js` → `LEVEL_SUMMARIES`, `getLevel`). `puzzleCount` is derived and stage
navigation walks `level.puzzles.length`, so a new puzzle is a new stage. Needing a score gate is the
one thing outside the JSON: the lock table in `pages/LevelSelectPage.jsx` handles ids 2 and 3 and
treats anything else as unlocked.

```jsonc
// content/levels.json — a level, then one entry inside its "puzzles" array
{ "id": 4, "name": "Level 4", "desc": "…", "varCount": 3, "puzzles": [ {
  "expr": "x + xy", "goal": "x", "targetLaws": ["absorption"],  // ids from content/laws.json
  "hints": ["…", "…"], "optimalSteps": 1, "optimalHint": "Apply Absorption Law." } ] }
```

### Add a Boolean law

Three files, in this order; each header explains why it is one of the three:

1. `content/laws.json` — the reference card `{id, name, formulas[], desc}` the Laws drawer renders.
2. `frontend/src/engine/laws/definitions.js` — the one identity row `{id, name, formula, mode, form}`;
   `id` must equal the card's `id` (the join key); `LAW_NAME_TO_ID` for scoring derives from here.
3. The builder that detects it for its selection shape: `laws/sumLaws.js` (SOP),
   `laws/productLaws.js` (POS, incl. the sandbox-only expand), `laws/notLaws.js` (negation, De Morgan)
   or `laws/constLaws.js` (0/1 in a sum or product), returning a non-mutating `apply()`.

Nothing else changes: `analyzeSelection`, `scanHints`, `getLegalTransitions` and every screen read
that same table. Add cases to `engine/__tests__/laws.test.js`; a law newly detectable on a graded
puzzle changes the fingerprint, so re-baseline deliberately.

### Add a screen or route

1. Create `frontend/src/pages/MyThingPage.jsx` (one component, PascalCase, file named after it).
2. Add one `<Route>` in `frontend/src/App.jsx`, wrapped in `ProtectedRoute`/`TutorialGate` if it needs
   auth or a finished tutorial. Screens read state and services, never the network, and reuse the
   `praxis-*` utilities instead of new one-off layout CSS.

### Change a game rule

Two files hold the same numbers and must change together, because neither side reads the other:

| File | Read by | Role |
|---|---|---|
| `frontend/src/config/gameRules.js` | the UI, and `engine/scoring.js` | instant local estimate |
| `backend/config/constants.py` | `backend/services/scoring_service.py` | authoritative score |

Weights (40/30/30), penalties, `STAR_THRESHOLDS` (90/75) and the 80 unlock average
(`UNLOCK_AVERAGE_SCORE` frontend, `UNLOCK_AVERAGE` backend) exist on both sides, as do the timings
and costs. Tunables only the UI needs (storage keys, animation timings) go to `config/gameRules.js`
or `config/storageKeys.js` in `frontend/src`; never inline a number at a call site.

### Run and verify

```bash
cd frontend && npm test        # 46 engine tests via node --test (no browser, no backend)
cd frontend && npm run dev     # Vite on :5173, /api proxied to 127.0.0.1:8000
cd frontend && npm run build   # static bundle; content JSON is bundled in
cd frontend && npm run lint    # eslint . — exits 1 with 14 pre-existing findings (9 + 5 warnings)

# the backend venv is named `venv` on Linux/macOS (backend/venv/bin/uvicorn exists)
cd backend && ./venv/bin/uvicorn main:app --reload     # http://localhost:8000

# browser suites need a running app; PRAXIS_BASE_URL overrides the default
PRAXIS_BASE_URL=http://localhost:5173 node .e2e/gameplay.mjs
bash .e2e/run-all-suites.sh    # all 16 suites; logs land in .e2e/_results/
```

Env: `backend/.env` needs `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` (startup fails fast without
them); the frontend needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`
(`services/supabaseClient.js` points at `frontend/.env.local`).

Not every suite is self-contained: `verify-sandbox.mjs` needs neither browser nor backend, while
`gameplay.mjs` reads `backend/.env` and resets the dedicated e2e learner's rows in Supabase first.
The Playwright/Chromium paths in `_harness.mjs` (and inline in 7 suites) are absolute paths into the
developer's npm/npx and Playwright caches — Playwright is not a dependency of `frontend/`.

### Engine change: prove nothing moved

```bash
# needs a live API: the script reads GET /api/levels/0..3 for the graded puzzles
node .e2e/lead-engine-fingerprint.mjs > before.json
# …edit frontend/src/engine/…
node .e2e/lead-engine-fingerprint.mjs > after.json
diff before.json after.json     # empty output == identical behaviour
```

An empty diff proves that for every state on the optimal path of all 40 graded puzzles, and all 24
curated pool expressions, the optimal step count, the legal transitions and the scan hints are
unchanged. Faster check: `diff <(node .e2e/lead-engine-fingerprint.mjs)
.e2e/baselines/engine-default-pre-expand.json` — currently byte-identical. `--expand` covers the
sandbox-only expansion law.

### Debug: where does X live

ARCHITECTURE.md §3 is the routing table ("I want to change… → open this"), §2 traces one learner
click through every layer, §5 lists the endpoints — it is one file away and kept current.

### Traps worth knowing

- The style import order in `frontend/src/main.jsx` is load-bearing: Tailwind layers, then
  `tokens.css`, `utilities.css`, `orientation.css`, `animations.css`. Shared utilities must land
  after Tailwind's utilities to win same-specificity conflicts, and folding them into `@import`s in
  `styles/index.css` silently drops them.
- `engine/` must never import React, the DOM or the network: that is what keeps `npm test` runnable
  in bare Node, the fingerprint meaningful, and the backend free of algebra to disagree with.
- Components never call `fetch`: network access goes through `services/*`, game state through
  `state/*` hooks.
- Editing `engine/sandbox/pool.js` or adding a detectable law changes the fingerprint output — that
  is expected; re-baseline on purpose instead of ignoring a diff.
