# Praxis Architecture

Interactive Boolean-algebra trainer: the learner selects parts of an expression,
the engine tells them which laws apply, and each applied law becomes a derivation
step. This document is the map — where things live, how a click travels through
the system, and which file to open for a given change.

> Rule of thumb: **engine = algebra, state = memory, services = network,
> components/screens = pixels, backend = content + persistence.** A file in one
> layer never reaches into another layer's business.

---

## 1. Folder map

```
Praxis/
├── content/                      # SINGLE SOURCE for laws + levels (JSON)
│   ├── laws.json                 #   served by GET /api/laws, bundled by the app
│   └── levels.json               #   served by GET /api/levels[/{id}], bundled
│
├── backend/                      # FastAPI — layered, one job per layer
│   ├── main.py                   #   assembly only: settings, CORS, logging,
│   │                             #   exception handlers, routers, / health
│   ├── config/
│   │   ├── settings.py           #   env vars + CORS origins, fail-fast
│   │   └── constants.py          #   scoring/star/unlock numbers
│   ├── core/
│   │   ├── errors.py             #   AppError + subclasses (code/message/detail)
│   │   ├── responses.py          #   the {success, data, error} envelope
│   │   ├── logging.py            #   structured JSON logs
│   │   ├── middleware.py         #   request id + access log
│   │   └── security.py           #   bearer-token auth dependency
│   ├── api/
│   │   ├── routes/               #   THIN http handlers (no logic, no queries)
│   │   └── schemas/              #   pydantic request/response models
│   ├── services/                 #   business logic
│   │   ├── content_service.py    #     levels/laws
│   │   ├── scoring_service.py    #     the authoritative score
│   │   └── progress_service.py   #     progress read/save orchestration
│   ├── repositories/             #   ALL data access
│   │   ├── content_repository.py #     reads ../content/*.json
│   │   └── progress_repository.py#     Supabase REST (user_progress, stage_progress,
│   │                             #     score_history)
│   └── supabase_client.py        #   thin Supabase REST client (httpx)
│
├── frontend/
│   ├── vite.config.js            # @content alias -> ../content, /api proxy
│   └── src/
│       ├── main.jsx              # entry; style import ORDER is load-bearing
│       ├── App.jsx               # router + auth/tutorial/orientation gates
│       ├── engine/               # PURE Boolean algebra — no React, no DOM, no fetch
│       ├── state/                # the single source of truth for game state
│       ├── services/             # the only place that talks to the network
│       ├── config/               # every tunable number and storage key
│       ├── content/              # bundled content loaders + tutorial copy
│       ├── hooks/                # UI hooks only (device tier, popups)
│       ├── components/           # presentational components, grouped by feature
│       ├── pages/                # route screens
│       └── styles/               # tokens + shared utilities + keyframes
│
├── database/init.sql             # Supabase schema (unchanged by the refactor)
├── render.yaml                   # Render deploy (backend, rootDir: backend)
└── .e2e/                         # browser suites + engine fingerprint baselines
```

### engine/ — pure algebra

| Module | Owns |
|---|---|
| `node.js` | AST node constructors, node ids, `cloneN`, `ensureNodeId` |
| `tree.js` | path traversal (`getNode`/`setNode`), structural edits, containment |
| `parser.js` | tokenizer + recursive-descent parser → `parseExpr` |
| `render.js` | `nodeText` (display) and `canonText` (order-independent compare) |
| `normalize.js` | `normalize` / `normalizeFlat` |
| `equivalence.js` | truth-table equivalence (the safety net for every rewrite) |
| `validate.js` | syntax verdict for a typed expression string |
| `laws/definitions.js` | **the one law table**: id, name, formula, mode, form |
| `laws/sumLaws.js` · `productLaws.js` · `notLaws.js` · `constLaws.js` | the rewrites, split by selection shape |
| `laws/scanHints.js` | whole-expression hint scan (Hint button, Guide, dead-end) |
| `laws/index.js` | public law API |
| `solver.js` | legal transitions, optimal path (BFS), simplest form |
| `scoring.js` | the client mirror of the backend scoring rules |
| `sandbox/input.js` | learner-typed expression → playable puzzle |
| `sandbox/generator.js` · `pool.js` | solver-verified random puzzles, curated pool |
| `index.js` | public barrel — import from here |
| `__tests__/` | 46 node:test unit tests (`npm test`) |

### state/ — one source of truth

| Module | Owns |
|---|---|
| `progressStore.js` | points, streak, per-stage scores/solutions, tutorial gates. Module-level store: `subscribe`, `getSnapshot`, `setUser`, actions, pure selectors. localStorage is the fast path, `/api/progress/save` the durable one. |
| `useProgress.js` | React binding (`useSyncExternalStore`) |
| `useGameState.js` | the current puzzle session: tree, selection, step history, hints, animations, optimal path |
| `hintText.js` | hint/guide wording built from an engine suggestion (pure) |
| `useGameContent.js` | levels/laws + score submission, as the screens consume them |

### services/ — the only network boundary

`apiClient.js` (fetch, auth header, JSON, `ApiError`, envelope unwrapping) ·
`contentApi.js` · `scoreApi.js` · `progressApi.js` · `authClient.jsx` ·
`supabaseClient.js`. Components never call `fetch`; they call a service or a
`state/` hook that wraps one.

### components/ and pages/

```
components/
├── animations/      one module per law + registry + the keyframes it drives
├── puzzle/          the workspace: canvas, header, law panel, history, side
│                    panel, overlays (score, reset, laws, hint, inspection)
├── tutorial/        coach card, welcome deck, spotlight, replay prompt
├── laws/            LawsDrawer + LawCard (law reference)
├── layout/          AppHeader, BackNav
├── ui/              StarRating, ScoreGateBar, PointsChip, LoadingSpinner
├── ExpressionDisplay.jsx / ExprText.jsx / AnimationOverlay.jsx / InteractiveTutorial.jsx
└── gates: ProtectedRoute, TutorialGate, OrientationGate, RotateOverlay/Banner, ErrorBoundary
pages/               Landing, Login, Register, LevelSelect, StageSelector,
                     SandboxInput (SandboxPage), Puzzle (ProblemPage), ...
```

---

## 2. Data flow: one learner click

```
 learner taps the literal  x  in  x + xy
        │
        ▼
 ExpressionDisplay (component)      pure: it renders the tree and emits
        │  onClickLit('R.0')        events — it owns no game state
        ▼
 state/useGameState.js              handleClickLit(path) → selection
        │
        ▼
 engine/laws/index.js               analyzeSelection(expr, sel)
        │  ── pure ──               → [{ id, name, formula, desc, apply() }]
        ▼
 state/useGameState.js              applicableLaws → re-render
        │
        ▼
 components/puzzle/LawPanel.jsx     the learner picks a law
        │  onApplyLaw(law)
        ▼
 state/useGameState.js              applyLaw(): animation → law.apply()
        │                             → new tree, new derivation step
        ▼
 engine/solver.js                   is the new tree the goal? (canonText
        │                             compare) → isComplete
        ▼
 engine/scoring.js                  estimateScore(...)  (instant, local)
 services/scoreApi.js  ──►  POST /api/score  ──►  backend/services/scoring_service.py
        │                                              │
        │  ◄────────── { success, data: score } ◄──────┘   authoritative total
        ▼
 state/progressStore.js             saveScore / completeStage / addPoints
        │                             → localStorage + debounced /api/progress/save
        ▼
 every subscribed screen            points chip, stage grid, gate bar update
```

Key properties:

- **One direction.** Components never mutate the tree or progress directly;
  they emit events and the state layer decides.
- **The engine never imports the app.** It is pure functions over plain objects,
  which is why it can be unit-tested in Node with no browser and why the same
  functions power the UI, the hint system, the solver and the sandbox generator.
- **Scoring is computed twice, on purpose, from one rule set.** The client
  estimate renders instantly; the backend value is authoritative and overwrites
  it. `config/game-rules.js` and `backend/config/constants.py` hold the numbers,
  and `engine/scoring.js` documents the mapping.

---

## 3. Where does X live?

| I want to change… | Open this |
|---|---|
| How an expression is parsed (new notation) | `frontend/src/engine/parser.js` |
| What "equivalent" means | `frontend/src/engine/equivalence.js` |
| When a law is offered | `frontend/src/engine/laws/{sum,product,not,const}Laws.js` |
| A law's name, formula or mode | `frontend/src/engine/laws/definitions.js` |
| The law reference cards shown in the UI | `content/laws.json` |
| A level, puzzle, hint or optimal-step count | `content/levels.json` |
| The optimal derivation search | `frontend/src/engine/solver.js` |
| Hint/guide suggestions | `frontend/src/engine/laws/scanHints.js` |
| The sandbox's accepted input | `frontend/src/engine/sandbox/input.js` |
| Generated (random) puzzles | `frontend/src/engine/sandbox/generator.js` |
| Scoring weights, star thresholds, unlock rule, timings, guide cost | `frontend/src/config/game-rules.js` **and** `backend/config/constants.py` |
| A storage key | `frontend/src/config/storageKeys.js` |
| Points/streak/stage completion behaviour | `frontend/src/state/progressStore.js` |
| Selection, undo, hint, animation sequencing | `frontend/src/state/useGameState.js` |
| An API call or an error message | `frontend/src/services/apiClient.js` + the matching `*Api.js` |
| A score or progress endpoint | `backend/api/routes/*.py` (thin) → `backend/services/*.py` |
| A database query | `backend/repositories/progress_repository.py` |
| The response envelope or error shape | `backend/core/responses.py`, `backend/core/errors.py` |
| Log format / request ids | `backend/core/logging.py`, `backend/core/middleware.py` |
| A law animation | `frontend/src/components/animations/<Law>Animation.jsx` |
| The puzzle workspace layout | `frontend/src/pages/ProblemPage.jsx` + `components/puzzle/*` |
| The level carousel / stage grid | `frontend/src/pages/LevelSelectPage.jsx`, `StageSelectorPage.jsx` |
| The tutorial script | `frontend/src/content/tutorialContent.js` |
| Design tokens / shared utilities / keyframes | `frontend/src/styles/*` |
| CORS origins or env vars | `backend/config/settings.py` |

**Adding a level** = `content/levels.json` only (backend serves it, frontend
bundles it).
**Adding a law** = `content/laws.json` (reference card) +
`frontend/src/engine/laws/definitions.js` (identity) + the builder that detects
it in `laws/{sum,product,not,const}Laws.js`. Nothing else.
**Adding a screen** = one file in `frontend/src/pages/` + one route in `App.jsx`.

---

## 4. Conventions

- **Naming**: `PascalCase.jsx` for components and screens (file named after the
  component, one component per file); `camelCase.js` for modules; `useThing.js`
  for hooks. Kebab-case is not used.
- **Layer imports**: `engine/` imports only `config/` and itself; `state/`
  imports `engine/`, `services/`, `config/`; `components/` and `pages/` import
  state + services + engine; `services/` imports `config/` only. Nothing imports
  from `components/` except other components.
- **Public interfaces**: each folder has a barrel (`engine/index.js`,
  `services/index.js`) or a documented entry module. Internals stay private.
- **Size**: target < ~250 lines per file; the largest files left are
  `state/useGameState.js` (589, the puzzle session state machine — one job, still
  long), `pages/ProblemPage.jsx` (509, composition root) and
  `hooks/useCollisionPlacement.js` (407, mostly verbatim geometry). Anything much
  larger than these is almost certainly doing two jobs.
- **Tunables**: a number that a designer might change belongs in
  `config/game-rules.js` (frontend) or `backend/config/constants.py` (backend) —
  never inline at a call site.
- **Failures**: backend raises a named `AppError` (user-safe `message`,
  developer `detail`); frontend throws `ApiError` from `services/apiClient.js`
  and services that must never break gameplay pass `silent: true`.

---

## 5. Backend contract

Every `/api/*` response carries the same envelope:

```jsonc
{ "success": true,  "data": <payload>, "error": null }
{ "success": false, "data": null,      "error": { "code": "not_found",
                                                  "message": "user-safe",
                                                  "detail": "developer-safe" } }
```

`GET /` is the plain health probe Render uses.

| Endpoint | Returns |
|---|---|
| `GET /api/levels` | level metadata (`id, name, desc, varCount, puzzleCount`) |
| `GET /api/levels/{id}` | full level with puzzles (404 envelope when unknown) |
| `GET /api/laws` | the law reference cards from `content/laws.json` |
| `POST /api/score` | the authoritative score (`efficiency`, `targetLaw`, `hintIndependence`, `total`, `earnedPoints`, `breakdown`); persists via background task for signed-in learners, ignoring guides in the assistance total instead of hints only |
| `GET /api/progress` · `POST /api/progress/save` | the learner's snapshot (401 without a bearer token) |

The database schema (`database/init.sql`) is unchanged. Scores are stored in
`score_history`; guide usage is folded into the existing `hints_used` column
rather than adding a column, so no migration is required.

### The engine contract (JS ↔ Python)

There is exactly **one** Boolean engine, in JavaScript: the frontend needs it in
the browser, and the backend has no algebra to do — it serves content and
persists scores. Python never re-implements parsing, law detection or solving, so
the two can never disagree. What the backend does need to agree on is arithmetic:
`backend/services/scoring_service.py` and `frontend/src/engine/scoring.js`
implement the same formula, and their constants live in the two config files
listed above. If a third consumer of the algebra ever appears (e.g. a Python
batch validator), extract the engine into a shared package rather than porting it.

---

## 6. Running it

```bash
# backend  → http://localhost:8000   (content/ is loaded from the repo root)
cd backend && python -m venv venv && venv/bin/pip install -r requirements.txt
venv/bin/uvicorn main:app --reload

# frontend → http://localhost:5173   (/api proxied to the backend)
cd frontend && npm install && npm run dev

# engine unit tests (no browser, no backend)
cd frontend && npm test

# browser suites (any dev server; PRAXIS_BASE_URL overrides the default)
PRAXIS_BASE_URL=http://localhost:5173 node .e2e/gameplay.mjs
bash .e2e/run-all-suites.sh          # everything, logs in .e2e/_results/

# engine regression fingerprint: run before/after an engine change and diff
node .e2e/lead-engine-fingerprint.mjs            > before.json
node .e2e/lead-engine-fingerprint.mjs --expand   > before-expand.json
```

Deployment: Render builds `backend/` (`rootDir: backend`, `pip install -r
requirements.txt`, `uvicorn main:app`) — `main.py` stayed at the backend root, so
`render.yaml` needed no path changes. The frontend builds to static assets with
the content JSON bundled at build time. One consequence worth knowing: the app
reads levels/laws from the bundle, so it also works offline; the API is the
fallback for content that is not bundled.
