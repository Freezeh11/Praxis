# GROUND TRUTH — verified against the codebase by the documentation Lead

> **Read this before writing anything.** Every fact below was verified by executing or
> reading the actual code at commit `3838343` ("test(engine): re-baseline the fingerprint and
> re-author par after the soundness fix"). It exists so eight writers produce **one**
> consistent, accurate documentation suite.
>
> **Prime directive:** the CODE is the truth. `docs/context.md` is a stale *proposal* and is
> wrong in many places (see §7). When the proposal and the code disagree, document the code
> and record the disagreement in the discrepancy register.
>
> **You must still verify every claim you personally write.** This file is a starting point,
> not a substitute for reading source. If you find something here that contradicts the code,
> the code wins — and tell the Lead immediately via `send_message`.

---

## 1. Repository layout (real, verified)

```
Praxis/
├── backend/                      FastAPI service — NOT "app/", no app/ package
│   ├── main.py                   assembly + exception handlers only (83 lines)
│   ├── supabase_client.py        hand-rolled PostgREST/httpx shim (102 lines)
│   ├── config/
│   │   ├── settings.py           env loading, CORS origins, Settings singleton
│   │   └── constants.py          scoring weights, star thresholds, unlock average
│   ├── core/
│   │   ├── errors.py             ErrorCode + AppError hierarchy
│   │   ├── responses.py          {success,data,error} envelope
│   │   ├── security.py           get_current_user / optional_user (Depends)
│   │   ├── middleware.py         RequestContextMiddleware — X-Request-ID + access log
│   │   └── logging.py            JSON formatter + request-id ContextVar
│   ├── api/
│   │   ├── routes/               health.py laws.py levels.py progress.py score.py
│   │   └── schemas/              progress.py score.py (pydantic transport models)
│   ├── services/                 content_service, progress_service, scoring_service
│   ├── repositories/             content_repository, progress_repository
│   ├── requirements.txt
│   └── .env                      FRONTEND_URL, SUPABASE_URL, SUPABASE_SERVICE_KEY  (gitignored)
├── frontend/
│   ├── src/
│   │   ├── pages/                LandingPage LoginPage RegisterPage LevelSelectPage
│   │   │                         StageSelectorPage ProblemPage SandboxPage   ← "pages", not "screens"
│   │   ├── services/             apiClient, authActions, contentApi, progressApi,
│   │   │                         scoreApi, soundEffects, supabaseClient   ← "services", not "api"
│   │   ├── state/                AuthProvider, authContext, progressStore, useGameState,
│   │   │                         useGameContent, useProgress, useSession, hintText
│   │   ├── engine/               pure Boolean algebra — THE engine (see §4)
│   │   ├── components/           animations/ laws/ layout/ puzzle/ tutorial/ ui/ + 10 top-level
│   │   ├── config/               appLinks, gameRules, storageKeys
│   │   ├── content/              gameContent.js, tutorialContent.js
│   │   ├── hooks/                8 UI hooks
│   │   └── styles/               tokens.css index.css animations.css orientation.css utilities.css
│   ├── .env.local                VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_AUTH_URL (gitignored)
│   ├── vite.config.js            @content alias → ../content ; dev proxy /api → 127.0.0.1:8000
│   ├── tailwind.config.js        design tokens (§6)
│   └── vercel.json
├── content/                      laws.json (10 laws), levels.json (4 levels × 12 stages)
├── database/init.sql             Supabase DDL — 3 tables (58 lines)
├── .e2e/                         19 Playwright/Puppeteer-style .mjs suites + run-all-suites.sh
├── render.yaml                   ONE Render web service, rootDir: backend
├── requirements.txt              root shim: `-r backend/requirements.txt`
└── docs/                         ← your deliverable lives here
```

**Backend size: 28 Python modules, 1,241 lines total** (`git ls-files 'backend/*.py' | wc -l`
→ 28; LOC 1,241). The backend is small; the frontend engine is where the complexity lives:
`frontend/src/engine/` is **30 files / 4,428 lines, of which 23 are non-test modules
(3,182 lines) and 7 are test files (1,246 lines)**. Prefer the phrasing
"**23 engine modules / 3,182 lines, excluding tests**" or "30 files / 4,428 lines including
tests" — never "22 modules / 4,428 lines".

---

## 2. Every API endpoint (LIVE-VERIFIED via `fastapi.testclient`)

There are **exactly 7 application endpoints**. Verified responses are quoted verbatim below.

| # | Method | Path | Auth | Verified result |
|---|---|---|---|---|
| 1 | GET | `/` | none | `200` `{"message":"Praxis API is running","docs":"/docs"}` — **outside the envelope**, deliberately plain because Render's health check reads it |
| 2 | GET | `/api/levels` | none | `200` envelope, `data` = array of 4 level summaries: `{id,name,desc,varCount,puzzleCount}` |
| 3 | GET | `/api/levels/{level_id}` | none | `200` full level with `puzzles`; `404` for unknown id |
| 4 | GET | `/api/laws` | none | `200` envelope, `data` = 10 law cards `{id,name,formulas[],desc}` |
| 5 | POST | `/api/score` | **optional** | `200` envelope with score payload (works signed-out); `422` on bad body |
| 6 | GET | `/api/progress` | **required** | `200` when bearer valid; `401` `{"code":"unauthorized","message":"Not authenticated"}` when not |
| 7 | POST | `/api/progress/save` | **required** | `200` `{"status":"ok"}`; `401` identically when not |

Plus FastAPI's own `/docs`, `/redoc`, `/openapi.json`, `/docs/oauth2-redirect`.

**Exact successful `POST /api/score` response** (verified, request
`{levelId:1,stageIdx:0,stepsUsed:1,lawsUsed:["absorption"],hintsUsed:0}`):

```json
{"success":true,"data":{"efficiency":40.0,"targetLaw":30.0,"hintIndependence":30.0,
"total":100.0,"earnedPoints":5,"breakdown":{"stepsUsed":1,"optimalSteps":1,
"targetLawsRequired":["absorption"],"targetLawsUsed":["absorption"],"hintsUsed":0,
"guidesUsed":0,"totalAssistance":0}},"error":null}
```

**Exact 404 envelope** (`GET /api/levels/999`):
```json
{"success":false,"data":null,"error":{"code":"not_found","message":"Level 999 not found","detail":null}}
```

**Exact 422 envelope** (`POST /api/score` missing `stepsUsed`):
```json
{"success":false,"data":null,"error":{"code":"validation_error","message":"Request validation failed",
"detail":[{"type":"missing","loc":["body","stepsUsed"],"msg":"Field required","input":{"levelId":1,"stageIdx":0}}, …]}}
```

**There is NO `/api/sandbox/*` endpoint.** The sandbox validates entirely in the browser.
See §7-D1 — the task brief's requested "POST /sandbox/validate" sequence diagram must be
documented as *correcting the brief*.

### Headers
- **Request:** `Authorization: Bearer <supabase-access-token>` on the two `/api/progress*`
  routes (required) and optionally on `/api/score`. `Content-Type: application/json` on POSTs.
- **Response:** `X-Request-ID` on **every** response (echoed from the request header if
  supplied, else a fresh `uuid4().hex`), set by `core/middleware.py`.

---

## 3. Data layer

### `database/init.sql` — 3 tables, all in schema `public`
- **`user_progress`** — PK `user_id UUID` → `auth.users(id)` ON DELETE CASCADE;
  `points INTEGER DEFAULT 0`, `streak INTEGER DEFAULT 0`, `best_streak INTEGER DEFAULT 0`,
  `updated_at TIMESTAMPTZ DEFAULT now()`. One row per user.
- **`stage_progress`** — `id UUID PK DEFAULT gen_random_uuid()`, `user_id UUID NOT NULL` FK,
  `level_id INTEGER NOT NULL`, `stage_idx INTEGER NOT NULL`, `best_score REAL DEFAULT 0`,
  `completed BOOLEAN DEFAULT FALSE`, `completed_at TIMESTAMPTZ DEFAULT now()`,
  `UNIQUE(user_id, level_id, stage_idx)`.
- **`score_history`** — `id UUID PK`, `user_id UUID NOT NULL` FK, `level_id`, `stage_idx`,
  `steps_used INTEGER NOT NULL`, `laws_used TEXT[] NOT NULL`, `hints_used INTEGER NOT NULL`,
  `efficiency REAL NOT NULL`, `target_law REAL NOT NULL`, `hint_independence REAL NOT NULL`,
  `total REAL NOT NULL`, `earned_points INTEGER NOT NULL`, `created_at TIMESTAMPTZ DEFAULT now()`.
- Indexes: `idx_stage_progress_user(user_id)`, `idx_score_history_user(user_id)`,
  `idx_score_history_level(user_id, level_id, stage_idx)`.
- RLS: **enabled on all three**, with one policy each literally named
  `"Service role full access"` for `ALL USING (true)` — i.e. **fully permissive for every
  role, including `anon`**. This is a real security finding: the policy is not scoped to
  `service_role` and there is **no `auth.uid() = user_id` predicate anywhere**. Document it
  honestly; do not describe these as per-user policies.
- The `init.sql` header comment claims "Better Auth tables (user, session, account,
  verification) are created automatically by `npx auth migrate`". **There is no Better Auth
  installation in this repo.** See §7-D3.

### Level index convention — IMPORTANT
There are **two different numbering schemes** and mixing them is the most likely
documentation error in this project:
- **`content/levels.json`** `id` values are **0, 1, 2, 3** where **0 = Tutorial**,
  1 = "Level 1", 2 = "Level 2", 3 = "Level 3 — Boss".
- **The UI** shows Tutorial + Levels 1–3 as four visible cards, and `frontend/src/config/gameRules.js`
  pins `TUTORIAL.levelId = 0`.
- `stage_progress.level_id` stores the **content id** (0-based), i.e. Tutorial rows have
  `level_id = 0`.

### Content volumes (verified)
- `content/laws.json`: **10 laws** — ids in authoring order:
  `complement, idempotent, absorption, identity, annulment, distributive, double-neg,
  demorgan-and, demorgan-or, associative`.
- `content/levels.json`: **4 levels holding 40 puzzles in total** — 4 + 12 + 12 + 12.
  (An earlier revision of this file said "4 levels × 12 stages = 48"; that was an arithmetic
  slip — the Tutorial has 4 stages, not 12. Verified two ways:
  `sum(len(l['puzzles']) for l in levels)` → 40 and `grep -c '"expr"' content/levels.json` → 40.)
  - Tutorial (id 0, varCount 2, 4 puzzles)
  - Level 1 (id 1, varCount 2, 12 puzzles)
  - Level 2 (id 2, varCount 3, 12 puzzles)
  - Level 3 — Boss (id 3, varCount 4, 12 puzzles)
- Per-puzzle keys, exactly: `expr, goal, targetLaws, hints, optimalSteps, optimalHint`.
- The engine also knows an internal law id **`distributive-expand`** that is **not** one of the
  10 reference cards — it is the reverse direction of `distributive`. Note this in
  `boolean-laws.md`.

---

## 4. Frontend engine — the real centre of gravity

`frontend/src/engine/` is **framework-free, network-free, React-free** pure JS. It is the only
Boolean algebra implementation in the repo. The backend does **not** re-implement algebra; it
serves content and scores submitted numbers. This is the **engine contract** — a term the
proposal defines and the code honours.

Key modules — **23 non-test modules, 3,182 lines** (LOC verified, complete list):
`solver.js` 323, `laws/sumLaws.js` 259, `sandbox/validate.js` 251, `sandbox/generator.js` 245,
`laws/productLaws.js` 224, `sandbox/input.js` 206, `sandbox/expand.js` 182, `parser.js` 166,
`laws/helpers.js` 152, `tree.js` 150, `laws/scanHints.js` 135, `laws/notLaws.js` 105,
`laws/constLaws.js` 100, `scoring.js` 98, `laws/definitions.js` 85, `index.js` 84, `validate.js`
78, `laws/index.js` 70, `normalize.js` 69, `equivalence.js` 58, `node.js` 49,
`sandbox/pool.js` 47, `render.js` 46.

> ⚠️ `render.js` (exports `nodeText` / `canonText`) is the easiest module to miss — an earlier
> revision of this file omitted it because a `tail`-truncated listing dropped the smallest
> file. If you re-derive counts, list the full tree before truncating anything.

Tests: `frontend/src/engine/__tests__/*.test.js`, run with `npm test` →
`node --test src/engine/__tests__/*.test.js`. **Verified: 76 tests, 76 pass, 0 fail, ~9.4 s.**
(The proposal claims 46 tests — stale.)

---

## 5. Scoring — verified semantics (differs from the proposal!)

`backend/services/scoring_service.py` + `backend/config/constants.py`:

```
EFFICIENCY_WEIGHT = 40.0   TARGET_LAW_WEIGHT = 30.0   HINT_INDEPENDENCE_WEIGHT = 30.0
MAX_SCORE = 100.0          STEP_PENALTY = 10.0        ASSISTANCE_PENALTY = 10.0
MAX_BONUS_POINTS = 5       SCORE_ROUNDING_DP = 1
STAR_THRESHOLDS = (90.0, 75.0)      UNLOCK_AVERAGE = 80.0
```

Exact algorithm (read the file — this is a summary):
1. `puzzle = content_service.get_puzzle(level_id, stage_idx)` → raises `NotFoundError` (404) for unknown level/stage.
2. `optimal = min(explicit optimalSteps if >0 else puzzle.optimalSteps else steps_used, steps_used)`
   — **a solution shorter than the recorded optimum lowers the bar**. This is subtle and matters.
3. `efficiency = 40` if `steps_used <= optimal`, else `max(0, 40 - (steps_used-optimal)*10)`.
4. `target_law = 30 * |targetLaws ∩ lawsUsed| / |targetLaws|` (rounded to 1 dp);
   **if the puzzle declares no target laws, this is full 30**.
5. `assistance = (hints_used or 0) + (guides_used or 0)`; `hint_independence = max(0, 30 - assistance*10)`.
6. `total = round(efficiency + target_law + hint_independence, 1)`.
7. `earnedPoints = round((total / 100) * 5)` — bonus **on top of** the frontend's base
   `STAGE_COMPLETION_XP = 10`.
   **CAREFUL — this is Python `round()`, i.e. banker's rounding (half-to-even), and the
   frontend mirror in `frontend/src/engine/scoring.js` uses JS `Math.round` (half-up).**
   They genuinely disagree by one point whenever `total` ends in `.5`:
   `total = 90.0` → backend `earnedPoints = 4`, frontend estimate `5`;
   `total = 50.0` → backend `2`, frontend `3`. Verified by executing both:
   `round(4.5) == 4` in Python but `Math.round(4.5) == 5` in JS. Document this divergence
   explicitly wherever both numbers appear — it is register item **D21**.
8. `breakdown` echoes `stepsUsed, optimalSteps, targetLawsRequired[], targetLawsUsed[],
   hintsUsed, guidesUsed, totalAssistance`.

Frontend mirror: `frontend/src/engine/scoring.js` + `frontend/src/config/gameRules.js`
(`SCORE_WEIGHTS`, `SCORE_PENALTY`, `SCORE_BONUS_MAX_POINTS`, `STAGE_COMPLETION_XP = 10`,
`GUIDE_COST_POINTS = 20`, `STAR_THRESHOLDS {three:90, two:75, one:1}`,
`UNLOCK_AVERAGE_SCORE = 80`, `MAX_STARS_PER_STAGE = 3`, `SCORE_RAMP {good:80, fair:50}`).

Note `GUIDE_COST_POINTS = 20` is a **point spend**, separate from `ASSISTANCE_PENALTY = 10`
which is a **score deduction**. Don't conflate them.

---

## 6. Design tokens (verified from `frontend/tailwind.config.js`)

Colors: `bg #f0f2f7`, `bg-card #ffffff`, `border #e2e5ed`, `border-dark #c8ccd6`,
`text.1 #1a2035`, `text.2 #4b5468`, `text.3 #9aa0b0`, `accent #1a2035`,
`teal DEFAULT #0ea5e9 / light #e0f4fd`, `amber DEFAULT #f59e0b / light #fef3c7`,
`green DEFAULT #10b981 / light #d1fae5`, `red #ef4444`.
Shadows: `sm`, `md`, `lg`. Radii: `sm 6px`, `md 12px`, `lg 20px`.
Fonts: sans `Inter, system-ui, sans-serif`; mono `JetBrains Mono, Fira Code, monospace`.
Default transition `180ms`; custom `transitionProperty` includes `right`.

The proposal's §9 colour table matches these values but omits the `-light` variants and the
radii/shadows. Prefer the config file.

---

## 7. DISCREPANCY REGISTER — proposal (`docs/context.md`) vs CODE

These are **mandatory** content for `07-explanation/known-limitations.md`, and each affected
doc must carry a short inline "Known discrepancy" note. The doc owning the claim flags it.

| ID | Proposal says (`docs/context.md`) | Code says (truth) | Severity |
|---|---|---|---|
| **D0** | `docs/context.md` is presented as the project's context source | It is **badly stale** — §2, §5, §10, §11, §12 are all contradicted below. Treat as an historical proposal only. | High |
| **D1** | `POST /sandbox/validate` implied by the task brief's diagram list | **No such endpoint exists.** Sandbox = `frontend/src/engine/sandbox/*` + `SandboxPage.jsx` + `ProblemPage` in sandbox mode. 100% client-side. | High |
| **D2** | "Database: credentials provided, **NOT integrated yet**"; "Auth: **None**" | Fully integrated. `supabase_client.py`, `progress_repository.py`, `/api/progress*` with bearer auth, Supabase Auth on the frontend. | High |
| **D3** | "Better Auth tables … `npx auth migrate`" (init.sql header) and `vite.config.js` proxies `/api/auth` → `127.0.0.1:3001` ("Better Auth server") | **No Better Auth in the repo.** No `auth-server/` directory (though `.gitignore` still lists `auth-server/node_modules/`), no port-3001 service, `VITE_AUTH_URL` is vestigial. Auth is **Supabase Auth** via `@supabase/supabase-js`. These are dead remnants that will confuse newcomers. | High |
| **D4** | "Landing page ❌ MISSING", "Login page ❌ MISSING", "Register page ❌ MISSING", "Protected routes ❌ MISSING" | All exist: `LandingPage.jsx`, `LoginPage.jsx`, `RegisterPage.jsx`, `ProtectedRoute.jsx`, plus `TutorialGate` and `OrientationGate`. | High |
| **D5** | Routes: `/`, `/level/:levelId/stages`, `/level/:levelId/stage/:stageIdx`, `*`; "no landing page exists" | 9 routes: `/`, `/login`, `/register`, `/levels`, `/level/:levelId/stages`, `/level/:levelId/stage/:stageIdx`, `/sandbox`, `/sandbox/play`, `*`. `/` is **LandingPage**; level select moved to **`/levels`**. | High |
| **D6** | Endpoints list: 5 endpoints, counts `/` + 3 GETs + score | **7 endpoints**; adds `GET /api/progress` + `POST /api/progress/save`; `POST /api/score` now **persists** for signed-in users via `BackgroundTasks`. | High |
| **D7** | "`POST /api/score` … **does NOT save to DB**" | It **does** persist in the background (`progress_service.persist_score`) whenever a valid bearer token is present — inserts `score_history` and raises `stage_progress.best_score`. Failure is logged and swallowed. | High |
| **D8** | Score formula: efficiency 40 − over×10; target law proportional; hint 30 − hints×10; `earnedPoints = (total/100)*5` | Matches **except**: (a) `optimal` is `min(declared, stepsUsed)`, (b) `guidesUsed` is added to `hintsUsed` into one `assistance` figure, (c) `SCORE_ROUNDING_DP = 1` rounding, (d) no target laws ⇒ full 30. | Medium |
| **D9** | "Level 2 requires Level 1 average ≥ **70%**"; "Level 3 permanently Coming Soon (no puzzles)" | `UNLOCK_AVERAGE = 80.0` and `UNLOCK_AVERAGE_SCORE = 80`; gameRules adds "**every stage done** AND average ≥ 80". **Level 3 is fully playable** with 12 four-variable puzzles. | High |
| **D10** | "3 levels… 6 puzzles each", Level 3 empty | **4 levels holding 40 puzzles**: Tutorial (id 0) has 4 stages; Levels 1, 2 and 3 have 12 each. Level 3 is a fully playable four-variable boss tier. | High |
| **D11** | Engine has "46 unit tests" | **76 tests, all passing.** | Low |
| **D12** | "Animation pipeline … triggers a **2.5 s** animation" | `gameRules.TIMING.lawAnimationMs = 1350`; `preLawHighlightMs = 1500`. | Medium |
| **D13** | "CORS: allows `localhost:5173` and `127.0.0.1:5173`" | Also includes `http://localhost:3001`, plus `FRONTEND_URL` when set (`build_cors_origins`). | Low |
| **D14** | "**No `.env` file exists yet**" | Both exist locally (`backend/.env`, `frontend/.env.local`) and both are gitignored. **Neither is tracked in git** (verified with `git ls-files` / `git check-ignore`). | Medium |
| **D15** | Proposal §11 prints a concrete `VITE_SUPABASE_PUBLISHABLE_KEY` value | A credential value is committed in a tracked file. Publishable/anon keys are designed for client exposure, but **docs must never reproduce secrets** — use placeholders. | Medium |
| **D16** | "Supabase is used only for progress and score history" / "all data hardcoded" | Correct in spirit: content is static JSON in `content/`, Supabase stores only progress + score history. But the Supabase client **is** wired up. | Low |
| **D17** | Backend layering named `app/core, app/services, app/repositories, app/routers, app/schemas` (task brief) | Real paths: `backend/core`, `backend/services`, `backend/repositories`, `backend/api/routes`, `backend/api/schemas`, `backend/config`. There is **no `backend/app/`**. | High |
| **D18** | Frontend layering named `src/api`, `src/screens` (task brief) | Real paths: `src/services` (not `api`) and `src/pages` (not `screens`). | Medium |
| **D19** | Deploy = "Render (render.yaml)" for the whole app | `render.yaml` defines **one** service — `praxis-backend` (python, `rootDir: backend`, `uvicorn main:app`). The frontend is **not** in `render.yaml`; `frontend/vercel.json` and `render.yaml`'s `FRONTEND_URL: https://praxis-seven-puce.vercel.app` show the SPA is deployed to **Vercel**. | High |
| **D20** | RLS described as policies for safety | Policies are `FOR ALL USING (true)` for all roles — permissive, not per-user. | High |
| **D21** | Proposal implies one consistent bonus-points figure | **Frontend and backend round differently.** `backend/services/scoring_service.py:55` uses Python `round()` = banker's rounding (half-to-even); `frontend/src/engine/scoring.js` mirrors it with JS `Math.round` = half-up. `total = 90.0` → server `earnedPoints = 4` but the client's live estimate shows `5`. Only bites when `total` ends in `.5`. | Medium |
| **D22** | — (not covered by the proposal) | `POST /api/score` and `/api/progress*` declare no OpenAPI security scheme (`Depends(optional_user)` yields `security=None`), so `/docs` shows **no Authorize button** and the bearer requirement on the progress routes is invisible in the generated API reference. | Low |
| **D23** | — (task brief implied a `POST /sandbox/validate` endpoint) | Sandbox validation is **entirely client-side** in `frontend/src/engine/sandbox/validate.js` + `SandboxPage.jsx`. Same underlying fact as D1, recorded here because it is a *brief*-vs-code discrepancy rather than a proposal-vs-code one. | High |
| **D24** | "Score computation ✅ Complete" implies a validated score | **The whole score is client-trusted and trivially maxable.** Verified: `POST /api/score` with `stepsUsed: 0` + three claimed law ids → `total 100.0, earnedPoints 5`; and raising `optimalSteps` to 999 still yields full 40 efficiency because `_resolve_optimal` clamps with `min(optimal, stepsUsed)`. The server cannot check a derivation because the algebra engine lives only in the frontend. Steps can be fabricated entirely. | High |
| **D25** | — | `POST /api/progress/save` performs **no bounds or integrity validation**. Verified: `points: -5`, `level_id: 99`, `stage_idx: -4`, `best_score: 999.9` all parse and are written verbatim (`api/schemas/progress.py` has no validators; `init.sql` has no CHECK constraints or FK on level/stage). | High |
| **D26** | Unlock rule presented as a game rule | **The unlock gate is frontend-only and slightly wrong.** `UNLOCK_AVERAGE` / `STAR_THRESHOLDS` in `backend/config/constants.py:25-26` are never read server-side; `GET /api/levels/{id}` has no auth dependency; no server state records an unlock. Also `frontend/src/state/progressStore.js:301-303` applies `Math.round()` to the average **before** `avgScore >= UNLOCK_AVERAGE_SCORE` at `:309`, so a true average of 79.5 rounds to 80 and **passes** the gate. | Medium |
| **D27** | Proposal describes a tested project | **Nothing tests the scoring arithmetic.** There are **zero backend test files** (`find backend -name 'test_*.py'` → none), the 7 frontend engine test files never reference `estimateScore` / `earnedPoints`, and the e2e suites only assert that a `+N Points` pill renders (`.e2e/acceptance-features.mjs:900`). A D21-style rounding regression would go undetected. | Medium |

### Additional verified facts worth documenting
- `render.yaml` env vars: `FRONTEND_URL` (literal value), `SUPABASE_URL` and
  `SUPABASE_SERVICE_KEY` with `sync: false` (set in the Render dashboard, not in git).
  `backend/requirements.txt` is the real dependency list; root `requirements.txt` is a
  one-line shim (`-r backend/requirements.txt`).
- `config/settings.py` calls `require_env("SUPABASE_URL")` and
  `require_env("SUPABASE_SERVICE_KEY")` at **import time** via the module-level
  `settings = Settings.from_env()` singleton — **the app cannot boot without them**, even to
  serve `/api/levels`. `FRONTEND_URL` is optional.
- `vite.config.js` reads `VITE_API_TARGET` (default `http://127.0.0.1:8000`) and aliases
  `@content` → `<repo>/content`, so the SPA and the API read the same JSON files. `server.fs.allow`
  is widened to the repo root because `content/` sits outside the Vite root.
- `content_repository` uses `functools.lru_cache` on `list_laws()` / `list_levels()` and
  resolves `CONTENT_DIR` as `parents[2] / "content"` — so **`content/` must ship beside
  `backend/`**, which is why Render's `rootDir: backend` works only because the repo root is
  the build context. If content is missing, every content route returns `503 content_unavailable`.
- `supabase_client.SupabaseRESTClient` deliberately avoids the official `supabase` Python SDK
  ("can pull complex compilation dependencies (pyiceberg / C++ build tools)"). Only two
  verbs are implemented: `eq` filters and `select/insert/upsert` with `on_conflict`.
  All repository HTTP is **synchronous** inside `async def` FastAPI routes → blocking I/O in
  the event loop is a real known limitation.
- Logging: one JSON object per line on **stdout**, keys
  `ts, level, logger, message, request_id` + merged `fields` + optional `exception`.
- `backend/core/responses.py` defines `internal_error_response()` which is used by the
  middleware's last-resort handler.

---

## 8. Writing conventions — follow these EXACTLY

1. **Language:** English. Markdown only. No HTML beyond what Markdown needs.
2. **Relative links only.** Every cross-link must be a relative path from the file containing
   it (e.g. from `docs/04-api/API-REFERENCE.md` link to `../03-database/SCHEMA.md`). Verify
   each link resolves on disk before you finish. **Never** link to a file you did not confirm exists.
3. **Cite evidence.** For every non-obvious claim, add the source as `path/to/file.py:12`
   (repo-relative, no leading `./`). Prefer `file:line`. This is what the verifier spot-checks.
   Use inline code for paths: `backend/services/scoring_service.py:80`.
4. **Never invent.** If you cannot verify something, write
   `> ⚠️ Unverified — could not confirm in code.` and tell the Lead. A missing fact is far
   cheaper than a wrong one.
5. **Secrets:** never reproduce a real value from `backend/.env` or `frontend/.env.local`, and
   never reproduce the key printed in `docs/context.md` §11. Use `https://<project-ref>.supabase.co`
   and `<service-role-key>` placeholders. Note *which* variable is needed, not its value.
6. **Terminology — use these exact terms** (they are enforced across all docs and defined in
   `10-project/glossary.md`):
   | Use | Do not use |
   |---|---|
   | literal | variable, letter (unless quoting UI text) |
   | term (product) / clause (sum) | factor group, chunk |
   | product / sum | AND-block, OR-block |
   | SOP / POS | sum-of-products form when abbreviating |
   | dual | inverse form, mirror |
   | law id (`absorption`, `demorgan-and`) | law name, spelled-out slug |
   | step / derivation step | move, action |
   | intermediate state | mid-state |
   | AST / expression tree | parse tree |
   | step-locking | locking, freezing |
   | engine contract | API contract for algebra |
   | tutor / learner | student, user (unless quoting UI text) |
   Numbers: 90 / 75 stars, 80 % unlock, 40/30/30 weights, `earnedPoints`.
7. **Every doc opens with a 2–4 line "What this is / Who it's for" preamble**, then a
   `## Contents` list for anything over 200 lines.
8. **Code fences:** always tag the language (`python`, `js`, `jsx`, `bash`, `sql`, `json`,
   `mermaid`, `text`). PowerShell and POSIX shell get separate `bash`/`powershell` fences.
9. **Accessibility of tone:** audience is a new teammate who is a *student*. Define jargon on
   first use in every doc (assume each doc may be read first). Prefer tables and worked
   examples over prose walls.
10. **Length:** "super-detailed" is the requirement. A reference doc should be exhaustive
    (every column, every field, every code, every env var). A tutorial should be
    step-followable with **exact commands and exact expected output**.

---

## 9. Claim ledger + diagram staging (MANDATORY for every writer)

Besides your docs, write two files under `docs/_staging/`:

**`docs/_staging/claims-<yourname>.md`** — a table of every substantive factual claim you made
and the evidence for it:
```markdown
| Claim | Doc + section | Evidence (file:line) | How verified (read/ran) |
|---|---|---|---|
| efficiency is capped at 40 | 06-reference/scoring-and-rewards.md §2 | backend/config/constants.py:9 | read |
| 76 engine tests pass | ... | frontend/src/engine/__tests__/*.test.js | ran `npm test` |
```

**`docs/_staging/diagram-input-<yourname>.md`** — Mermaid-ready material for the diagrams
teammate, only for diagrams in your domain. Give them copy-pasteable `mermaid` fences or the
precise node/edge lists plus the evidence. Diagrams required per domain:
- **data-scoring** → full `erDiagram` source; level-unlock flowchart; scoring-breakdown flowchart.
- **backend-api** → sandbox Flow decision: the *auth flow* sequence (Supabase signup/login → session → bearer on API calls).
- **engine-guides** → engine component diagram (parser → validator → normalizer → laws → engine); click→law→step→validate sequence.
- **devops-ops** → C4 Level 1 system context; C4 Level 2 container; deployment diagram (Render + Supabase + Vercel).
- **product-arch** → puzzle-session state diagram; frontend data-flow diagram.

The diagrams teammate owns the final `09-diagrams/DIAGRAMS.md` — you supply source, they
assemble and verify. Do not write DIAGRAMS.md yourself.

---

## 10. Boundaries (do not touch other people's files)

Each writer owns a disjoint set of paths. **Never edit a file outside your scope**, including
`docs/context.md`, `docs/ARCHITECTURE.md`, `docs/SKILLS.md`, `docs/REFACTOR_REPORT.md`,
`docs/README.md`, and `docs/09-diagrams/DIAGRAMS.md` — the Lead owns the hub and the legacy
files are frozen inputs. Report contradictions to the Lead instead of editing them.

If a required output file for your scope is not created yet, create it. If you believe a
required file belongs to another writer, tell the Lead — do not "helpfully" write it.
