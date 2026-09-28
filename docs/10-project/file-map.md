# Praxis — File Map

**What this is:** an exhaustive "where does X live?" index of every tracked source file in the
Praxis repository — one row per file, with its responsibility, the symbols it exports, and the
modules that import it.

**Who it's for:** a new teammate who knows *what* they want to change but not *which file* to
open, and a reviewer checking that a change landed in the right layer. Read
[glossary.md](glossary.md) first if any term here is unfamiliar.

> **Verified at commit `3838343`.** Every path below was produced by a command, not from memory
> (§1), and every path was re-checked to exist on disk. Where a count differs from a number you
> have seen elsewhere in this repo, the count here is the one that was executed.

---

## Contents

1. [How this map was generated](#1-how-this-map-was-generated)
2. [Verified inventory totals](#2-verified-inventory-totals)
3. [Repo root](#3-repo-root)
4. [`backend/`](#4-backend)
5. [`content/`](#5-content)
6. [`database/`](#6-database)
7. [`.e2e/`](#7-e2e)
8. [`frontend/` — root config](#8-frontend-root-config)
9. [`frontend/src/` — entry points](#9-frontendsrc-entry-points)
10. [`frontend/src/pages/`](#10-frontendsrcpages)
11. [`frontend/src/services/`](#11-frontendsrcservices)
12. [`frontend/src/state/`](#12-frontendsrcstate)
13. [`frontend/src/engine/`](#13-frontendsrcengine)
14. [`frontend/src/components/`](#14-frontendsrccomponents)
15. [`frontend/src/config/`](#15-frontendsrcconfig)
16. [`frontend/src/content/`](#16-frontendsrccontent)
17. [`frontend/src/hooks/`](#17-frontendsrchooks)
18. [`frontend/src/styles/`](#18-frontendsrcstyles)
19. [`frontend/src/assets/` and `frontend/public/`](#19-frontendsrcassets-and-frontendpublic)
20. [`docs/` tracked inputs](#20-docs-tracked-inputs)
21. [Reverse lookups — "I want to change X"](#21-reverse-lookups-i-want-to-change-x)
22. [What is excluded, and why](#22-what-is-excluded-and-why)

---

## 1. How this map was generated

The inventory was produced by listing the git index, not by walking a directory (a directory walk
would include `backend/venv/`, `frontend/node_modules/` and `frontend/dist/`, which are installed
or generated and must never be documented as source):

```bash
cd /home/xris/Documents/GitHub/Praxis
git ls-files | grep -vE 'node_modules|venv|__pycache__|package-lock' | sort
```

That command returns **211 paths**. The raw index has **212**: the single difference is
`frontend/package-lock.json`, a generated dependency lockfile (see §22).

**Paths were then checked against the filesystem** — every one of the 211 paths was tested with
`[ -e ]` and all 211 exist; none is invented:

```bash
git ls-files | grep -vE 'node_modules|venv|__pycache__|package-lock' \
  | while read -r f; do [ -e "$f" ] || echo "MISSING: $f"; done
# (no output — every listed path exists)
```

The **"Depended on by"** column is not a guess. It was produced by parsing every relative import
statement in the tracked `.py`/`.js`/`.jsx`/`.mjs` files and inverting the resulting graph, so the
column reflects real import statements at commit `3838343`. A file listed as an entry point with no
importers (`main.py`, `main.jsx`, `App.jsx`, every `.e2e` suite) is genuinely not imported by
anything else.

Conventions used below:

- Paths are shown **repo-relative** and each one links to the real file.
- `📦` marks a package marker (`__init__.py`) whose only content is a docstring.
- `🖼` marks a binary or non-source asset.

---

## 2. Verified inventory totals

| Area | Tracked files | Composition |
|---|---|---|
| Repo root | **4** | 1 markdown, 1 YAML, 2 requirements text files |
| `backend/` | **29** | **28 Python modules, 1,241 lines** + 1 requirements file |
| `content/` | **2** | 2 JSON data files |
| `database/` | **1** | 1 SQL DDL file |
| `.e2e/` | **22** | 18 `.mjs` suites + 1 shared harness + 1 runner shell script + 2 JSON baselines |
| `frontend/` | **148** | 9 root config files + 138 under `src/` + 1 under `public/` |
| `docs/` (tracked) | **5** | the pre-existing legacy inputs |
| **Total** | **211** | — |

The engine is the largest single subsystem. Splitting `frontend/src/engine/` by role:

| Measure | Count | Verified with |
|---|---|---|
| Engine modules excluding tests | **23** | `git ls-files 'frontend/src/engine/*.js' \| grep -v __tests__ \| wc -l` |
| Engine lines excluding tests | **3,182** | same list piped to `xargs wc -l` |
| Engine test files | **7** | `ls frontend/src/engine/__tests__/*.test.js \| wc -l` |
| Engine test lines | **1,246** | `xargs wc -l` over `__tests__/` |
| Engine files incl. tests | **30** | `git ls-files 'frontend/src/engine/*.js' \| wc -l` |
| Engine lines incl. tests | **4,428** | `xargs wc -l` over the same list |

> **Careful with the 4,428 figure.** It is the engine's **total including the 7 test files**. The
> engine's production code is **23 modules / 3,182 lines**. Do not describe 4,428 lines as "22
> modules" — an older summary in this repo dropped `frontend/src/engine/render.js`
> (46 lines) from its list, which is why the two numbers do not line up.

Content and test volumes referenced throughout this map:

| Measure | Value | Verified with |
|---|---|---|
| Laws | **10** | `content/laws.json` is a 10-element array |
| Levels | **4** | `content/levels.json` is a 4-element array |
| Puzzles | **40** | `[4, 12, 12, 12]` — Tutorial has 4 stages, Levels 1–3 have 12 each |
| Engine unit tests | **76 passing** | `npm test` → `# tests 76 / # pass 76 / # fail 0` |
| Browser/node e2e suites | **19 `.mjs`** (18 suites + 1 shared harness), of which **16 wired** | `.e2e/run-all-suites.sh` has 16 `run` lines |

---

## 3. Repo root

| Path | Responsibility | Key exports / symbols | Depended on by |
|---|---|---|---|
| [`.gitignore`](../../.gitignore) | Which local artifacts git must never track: `__pycache__/`, `venv/`, `.env`, `node_modules/`, `dist/`, `.e2e/_results/`, `.e2e/shots-mobile/`, `.e2e/*.png`, `.refactor-tmp/`. Note it still lists `auth-server/node_modules/` for a directory that does not exist. | — | git itself |
| [`README.md`](../../README.md) | The human entry point: what Praxis is, the tech stack table, prerequisites, and the two-server setup guide (Supabase project → `database/init.sql` → `.env` files → run backend → run frontend). Links to the legacy docs, not to this suite. | — | — (root doc; referenced by `frontend/README.md`) |
| [`render.yaml`](../../render.yaml) | The Render blueprint. Defines **one** web service, `praxis-backend`, Python, `rootDir: backend`, `buildCommand: pip install -r requirements.txt`, `startCommand: uvicorn main:app`. Sets `FRONTEND_URL` to a literal Vercel URL and declares `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` with `sync: false` (supplied in the Render dashboard). | — | Render |
| [`requirements.txt`](../../requirements.txt) | One-line shim: `-r backend/requirements.txt`, so `pip install -r requirements.txt` from the repo root still works. Not the real dependency list. | — | humans running pip from the root |

---

## 4. `backend/`

**28 Python modules, 1,241 lines.** The layer order is `api/routes` → `services` → `repositories`
→ `supabase_client`; §4.7 states the rule and the evidence. Every `__init__.py` here is a
package marker (`📦`) containing only a docstring that names the layer.

### 4.1 Application entry and transport shim

| Path | Responsibility | Key exports / symbols | Depended on by |
|---|---|---|---|
| [`backend/main.py`](../../backend/main.py) | Application assembly only — no business logic. Creates `FastAPI(title="Praxis API", version="1.0.0")`, registers CORS and `RequestContextMiddleware`, installs four exception handlers (`AppError`, `StarletteHTTPException`, `RequestValidationError`, bare `Exception`), and includes all five routers. | `app`, `handle_app_error`, `handle_http_exception`, `handle_validation_error`, `handle_unexpected_error` (83 lines) | `uvicorn main:app` (Render `startCommand`) |
| [`backend/supabase_client.py`](../../backend/supabase_client.py) | A hand-rolled PostgREST/Auth shim over `httpx`, written to avoid the official `supabase` SDK because it "can pull complex compilation dependencies (pyiceberg / C++ build tools)". Implements only two verbs: `eq` filters and `select`/`insert`/`upsert` with `on_conflict`. Exposes a module-level `supabase` singleton built from `settings`. | `SupabaseRESTClient`, `SupabaseRESTClient.QueryBuilder`, `supabase` (102 lines) | `core/security.py`, `repositories/progress_repository.py` |
| [`backend/requirements.txt`](../../backend/requirements.txt) | The real dependency list: `fastapi`, `uvicorn[standard]`, `python-multipart`, `python-dotenv`, `httpx`. Installed by Render from `rootDir: backend`. | — | `render.yaml`, root `requirements.txt` |

### 4.2 `backend/config/`

| Path | Responsibility | Key exports / symbols | Depended on by |
|---|---|---|---|
| [`backend/config/__init__.py`](../../backend/config/__init__.py) 📦 | Package docstring: "Configuration package: environment-backed settings and shared constants." | — | — |
| [`backend/config/constants.py`](../../backend/config/constants.py) | **Every scoring weight, penalty, bonus and progression threshold.** 26 lines, no imports. The file its own docstring says is "imported by `services/*` only". | `EFFICIENCY_WEIGHT` 40.0, `TARGET_LAW_WEIGHT` 30.0, `HINT_INDEPENDENCE_WEIGHT` 30.0, `MAX_SCORE` 100.0, `STEP_PENALTY` 10.0, `ASSISTANCE_PENALTY` 10.0, `MAX_BONUS_POINTS` 5, `SCORE_ROUNDING_DP` 1, `STAR_THRESHOLDS` `(90.0, 75.0)`, `UNLOCK_AVERAGE` 80.0 | `services/scoring_service.py` |
| [`backend/config/settings.py`](../../backend/config/settings.py) | Environment-backed config. Loads `backend/.env` explicitly first (so the app works from any cwd) then python-dotenv's cwd search; `require_env()` fails fast naming the missing variable; `build_cors_origins()` merges the three dev origins with `FRONTEND_URL`. Ends with the import-time singleton `settings = Settings.from_env()`, so a missing Supabase credential crashes the boot. | `BACKEND_DIR`, `DEFAULT_CORS_ORIGINS`, `require_env`, `Settings`, `Settings.from_env`, `build_cors_origins`, `settings` (75 lines) | `main.py`, `supabase_client.py` |

### 4.3 `backend/core/`

| Path | Responsibility | Key exports / symbols | Depended on by |
|---|---|---|---|
| [`backend/core/__init__.py`](../../backend/core/__init__.py) 📦 | Docstring: "Cross-cutting infrastructure: errors, envelopes, logging, auth." | — | — |
| [`backend/core/errors.py`](../../backend/core/errors.py) | The named application errors — the only failures the API reports. `ErrorCode` holds the seven stable machine-readable codes; `AppError` carries `code`/`message`/`detail`/`status`; four subclasses each pin a default code and status. | `ErrorCode`, `AppError`, `NotFoundError` (404), `ContentUnavailableError` (503), `UpstreamError` (502), `UnauthorizedError` (401) (81 lines) | `core/responses.py`, `core/security.py`, `main.py`, both repositories, `services/content_service.py` |
| [`backend/core/responses.py`](../../backend/core/responses.py) | The one response envelope every `/api/*` route declares. `success()` / `failure()` build the dict; `error_response()` renders an `AppError` with its own status; `internal_error_response()` is the generic 500 used by the middleware's last-resort handler. | `ErrorBody`, `Envelope`, `success`, `failure`, `error_response`, `internal_error_response` (60 lines) | all four `/api` route modules, `core/middleware.py`, `main.py` |
| [`backend/core/logging.py`](../../backend/core/logging.py) | Structured logging: one JSON object per line on stdout, keys `ts, level, logger, message, request_id` plus merged `fields` and an optional `exception`. `configure_logging()` is idempotent; the request id lives in a `ContextVar` so it follows async work. | `REQUEST_ID_DEFAULT`, `set_request_id`, `reset_request_id`, `current_request_id`, `JsonFormatter`, `configure_logging`, `get_logger`, `log_fields` (76 lines) | `core/middleware.py`, `main.py`, `services/progress_service.py` |
| [`backend/core/middleware.py`](../../backend/core/middleware.py) | `RequestContextMiddleware` — echoes or generates `X-Request-ID`, binds it to the context, times the request, logs one access line, and converts an unhandled exception into the generic 500 envelope. The header is set on **every** response, including errors. | `REQUEST_ID_HEADER`, `RequestContextMiddleware` (62 lines) | `main.py` |
| [`backend/core/security.py`](../../backend/core/security.py) | The two FastAPI auth dependencies. `get_current_user` reads `Authorization: Bearer …`, calls `supabase.get_user(token)`, and raises `UnauthorizedError` on a missing/invalid session; `optional_user` is the same but returns `None` instead of raising — which is what lets `POST /api/score` work signed out. | `get_current_user`, `optional_user` (43 lines) | `api/routes/progress.py`, `api/routes/score.py` |

### 4.4 `backend/api/`

| Path | Responsibility | Key exports / symbols | Depended on by |
|---|---|---|---|
| [`backend/api/__init__.py`](../../backend/api/__init__.py) 📦 | Docstring: "Request/response payload contracts for the HTTP layer." | — | — |
| [`backend/api/routes/__init__.py`](../../backend/api/routes/__init__.py) 📦 | Docstring: "HTTP routes — thin adapters: parse, call a service, return the envelope." | — | — |
| [`backend/api/routes/health.py`](../../backend/api/routes/health.py) | `GET /` — the liveness probe. Returns plain JSON **outside the envelope** on purpose, because Render reads this body verbatim. 18 lines. | `router`, `read_health` | `main.py` |
| [`backend/api/routes/laws.py`](../../backend/api/routes/laws.py) | `GET /api/laws` — thin transport over `content_service.list_laws()`. 21 lines. | `router`, `read_laws` | `main.py` |
| [`backend/api/routes/levels.py`](../../backend/api/routes/levels.py) | `GET /api/levels` (summaries, no puzzle detail) and `GET /api/levels/{level_id}` (full level, 404 envelope when unknown). 27 lines. | `router`, `read_levels`, `read_level` | `main.py` |
| [`backend/api/routes/progress.py`](../../backend/api/routes/progress.py) | `GET /api/progress` and `POST /api/progress/save`, both behind `Depends(get_current_user)`. Maps the request body to service arguments and returns `{"status": "ok"}` for the save. 41 lines. | `router`, `get_progress`, `save_progress` | `main.py` |
| [`backend/api/routes/score.py`](../../backend/api/routes/score.py) | `POST /api/score` — validates, scores via `scoring_service.compute_score`, and for a signed-in caller queues `progress_service.persist_score` on `BackgroundTasks` so persistence "must never delay or fail the response". 49 lines. | `router`, `compute_score` | `main.py` |
| [`backend/api/schemas/__init__.py`](../../backend/api/schemas/__init__.py) 📦 | Docstring: "Pydantic transport contracts (request bodies and data payloads)." | — | — |
| [`backend/api/schemas/progress.py`](../../backend/api/schemas/progress.py) | Progress transport models. Field names are a **frozen frontend contract** — `points`, `streak`, `bestStreak`, `stageProgress`, `stageScores`. The `int \| float` union on `stageScores` keeps whole scores as ints so the value written to Supabase is byte-identical to the request. | `ProgressData`, `SaveProgressRequest` (22 lines) | `api/routes/progress.py` |
| [`backend/api/schemas/score.py`](../../backend/api/schemas/score.py) | Scoring transport models — also a frozen contract. `ScoreRequest` carries `levelId, stageIdx, stepsUsed, lawsUsed, hintsUsed, guidesUsed, optimalSteps`; `ScoreResponse` carries `efficiency, targetLaw, hintIndependence, total, earnedPoints, breakdown`. | `ScoreRequest`, `ScoreResponse` (29 lines) | `api/routes/score.py` |

### 4.5 `backend/services/`

| Path | Responsibility | Key exports / symbols | Depended on by |
|---|---|---|---|
| [`backend/services/__init__.py`](../../backend/services/__init__.py) 📦 | Docstring: "Business rules — the layer between routes and repositories." | — | — |
| [`backend/services/content_service.py`](../../backend/services/content_service.py) | Level/law content plus the **not-found semantics** of the content API. `get_level` raises `NotFoundError` for an unknown id; `get_puzzle` raises for a stage index past the end but deliberately keeps Python-style negative indexing (`-1` is the last stage). | `list_level_summaries`, `list_laws`, `get_level`, `get_puzzle` (42 lines) | `api/routes/laws.py`, `api/routes/levels.py`, `services/scoring_service.py` |
| [`backend/services/scoring_service.py`](../../backend/services/scoring_service.py) | The scoring rules. Resolves the optimal step count, computes the three weighted bands, sums and rounds the total, and derives `earnedPoints`. Every number comes from `config/constants.py`. | `ScoreOutcome`, `compute_score`, `_resolve_optimal`, `_efficiency`, `_target_law`, `_hint_independence` (115 lines) | `api/routes/score.py`, `services/progress_service.py` |
| [`backend/services/progress_service.py`](../../backend/services/progress_service.py) | Progress logic: merges stored rows into the client snapshot, writes the client's snapshot back (one totals row plus one row per completed stage), and `persist_score` appends a `score_history` row and raises `stage_progress.best_score` in a background task. Storage failures are logged and swallowed. | `load_progress`, `build_progress`, `save_progress`, `persist_score` (127 lines) | `api/routes/progress.py`, `api/routes/score.py` |

### 4.6 `backend/repositories/`

| Path | Responsibility | Key exports / symbols | Depended on by |
|---|---|---|---|
| [`backend/repositories/__init__.py`](../../backend/repositories/__init__.py) 📦 | Docstring: "Data access layer — the only modules that know where data lives." | — | — |
| [`backend/repositories/content_repository.py`](../../backend/repositories/content_repository.py) | Read-only access to `<repo>/content/*.json`. Resolves `CONTENT_DIR` as `parents[2] / "content"` — so **`content/` must ship beside `backend/`** — and caches both loaders with `functools.lru_cache`. A missing or malformed file becomes a `ContentUnavailableError` (503), not a crash. | `CONTENT_DIR`, `list_laws`, `list_levels`, `list_level_summaries`, `get_level`, `_load` (62 lines) | `services/content_service.py` |
| [`backend/repositories/progress_repository.py`](../../backend/repositories/progress_repository.py) | **All Supabase access** for the three tables. Names the tables and the `stage_progress` conflict columns as constants, and wraps `execute()` so an `httpx.HTTPError` becomes an `UpstreamError` (502). | `USER_PROGRESS_TABLE`, `STAGE_PROGRESS_TABLE`, `SCORE_HISTORY_TABLE`, `STAGE_CONFLICT_COLUMNS`, `get_user_progress_row`, `list_stage_progress_rows`, `get_best_score`, `insert_score_history`, `upsert_stage_progress`, `upsert_user_progress` (73 lines) | `services/progress_service.py` |

### 4.7 The import direction (evidence)

Every first-party import in `backend/` points **downward or sideways within a layer** — never up:

```
main.py
  └─> api/routes/*  ──> services/*  ──> repositories/*  ──> supabase_client.py
        │                  │                                    │
        └──────────────────┴──> core/*  (errors, responses, logging, security, middleware)
                               config/*  (settings, constants)
```

| Rule | Evidence |
|---|---|
| `api/routes/*` import `services` and `core`, never `repositories` | `backend/api/routes/levels.py:13`, `backend/api/routes/score.py:15` |
| `services/*` import `repositories`, never `api` | `backend/services/content_service.py:11`, `backend/services/progress_service.py:12` |
| `repositories/*` are the **only** modules that call `supabase.table(...)` | `grep -rn "supabase.table(" backend/` matches `backend/repositories/progress_repository.py:32` only; the single other `supabase.` use is `backend/core/security.py:27` (`supabase.get_user`) for token verification, not data access |
| `main.py` contains wiring only | It imports `api.routes`, `config.settings`, `core.*` and nothing else — no `services`, no `repositories`, no business logic (`backend/main.py:15-20`) |
| `supabase_client.py` depends only on `config.settings` | `backend/supabase_client.py:12` |

---

## 5. `content/`

The single source of truth for what the game teaches. Both consumers read these exact files: the
FastAPI backend through `CONTENT_DIR`, and the SPA through the Vite `@content` alias.

| Path | Responsibility | Key exports / symbols | Depended on by |
|---|---|---|---|
| [`content/laws.json`](../../content/laws.json) | The **10 Boolean law reference cards**, in authoring order. Each element is exactly `{ id, name, formulas[], desc }`. Ids, in file order: `complement`, `idempotent`, `absorption`, `identity`, `annulment`, `distributive`, `double-neg`, `demorgan-and`, `demorgan-or`, `associative`. | data | `backend/repositories/content_repository.py:37`; `frontend/src/content/gameContent.js:14` via `@content/laws.json` |
| [`content/levels.json`](../../content/levels.json) | The **4 levels and their 40 puzzles**: Tutorial (id `0`, `varCount` 2, 4 puzzles), Level 1 (id `1`, 2 vars, 12), Level 2 (id `2`, 3 vars, 12), Level 3 — Boss (id `3`, 4 vars, 12). Level keys are `{ id, name, desc, varCount, puzzles[] }`; every puzzle has exactly `{ expr, goal, targetLaws, hints, optimalSteps, optimalHint }`. | data | `backend/repositories/content_repository.py:43`; `frontend/src/content/gameContent.js:15` via `@content/levels.json` |

> **Level ids are 0-based.** `id: 0` is the Tutorial, `id: 1` is "Level 1". The UI shows four
> cards, and `frontend/src/config/gameRules.js:83` pins `TUTORIAL.levelId = 0`. Storage rows use
> the same 0-based content id, so a Tutorial row has `level_id = 0`.

---

## 6. `database/`

| Path | Responsibility | Key exports / symbols | Depended on by |
|---|---|---|---|
| [`database/init.sql`](../../database/init.sql) | The entire Supabase DDL, run by hand in the SQL Editor. Creates **three** tables — `user_progress`, `stage_progress`, `score_history` — plus three indexes and three RLS policies literally named `"Service role full access"` with `FOR ALL USING (true)`. Its header comment still describes Better Auth tables created by `npx auth migrate`; **no such tooling exists in this repo** (see [glossary.md](glossary.md) → *Better Auth*). | 58 lines of SQL | Supabase; referenced by `README.md` §Setup |

---

## 7. `.e2e/`

**19 `.mjs` files — 18 suites plus 1 shared harness (`.e2e/_harness.mjs`).** Of the 18 suites,
**16 are wired into the runner** and 2 are not:
`gate-fresh-user-check.mjs` and `lead-engine-fingerprint.mjs` (standalone diagnostics run by hand).
Of the 16 wired suites, **13 drive a real browser** through the Playwright harness and **3 are pure
node**: `verify-sandbox.mjs`, `verify-sandbox-input.mjs`, `generator-stress.mjs`.

| Path | Responsibility | Key exports / symbols | Depended on by |
|---|---|---|---|
| [`.e2e/run-all-suites.sh`](../../.e2e/run-all-suites.sh) | The runner. `cd`s to the repo root from its own location, writes each suite's log to `.e2e/_results/<name>.log` under a 1800 s `timeout`, prints `exit=N` plus the log tail, and ends with `ALL DONE`. Wired suites, in order: `verify-sandbox`, `verify-sandbox-input`, `sandbox-engine-audit`, `generator-stress`, `sandbox-ui`, `sandbox-input-ui`, `responsive-tiers`, `mobile-landscape`, `mobile-ux`, `mobile-pages`, `tutorial-overlap`, `popup-overlap`, `tutorial-gate`, `gameplay`, `law-comments`, `acceptance`. | 16 `run` invocations | humans; CI |
| [`.e2e/_harness.mjs`](../../.e2e/_harness.mjs) | Shared browser harness — **not a suite and not wired into the runner**. Owns every machine-specific path (`PRAXIS_PLAYWRIGHT_MODULE`, `PRAXIS_CHROMIUM`, `PRAXIS_ENV_FILE`), the e2e learner identity, the eight device presets, `launch()`, `seededState()`, `device()`, `nav()`, `reporter()`, `foldReport()`, `noHorizontalScroll()`, `shot()` and `resetE2eProgress()`. Re-exports the app's storage keys from `frontend/src/config/storageKeys.js` so no suite inlines a literal. | `REPO_ROOT`, `PLAYWRIGHT_MODULE`, `CHROMIUM`, `ENV_FILE`, `BASE`, `EMAIL`, `PASSWORD`, `DEVICES`, `readEnv`, `resetE2eProgress`, `launch`, `seededState`, `device`, `nav`, `reporter`, `foldReport`, `noHorizontalScroll`, `shot`, `HIDE_SURVEY` | 13 browser suites |
| [`.e2e/verify-sandbox.mjs`](../../.e2e/verify-sandbox.mjs) | Node-only. Checks four sandbox contracts: the restored engine helpers behave, the curated pool is usable end to end, the randomizer only returns solver-verified in-scope problems, and a generated problem is solvable through the same law engine the UI uses. | script assertions | runner |
| [`.e2e/verify-sandbox-input.mjs`](../../.e2e/verify-sandbox-input.mjs) | Node-only. Covers the free-text input contract in `frontend/src/engine/sandbox/input.js`: frozen API surface, every `errorCode` with its exact message, every accepted notation, `buildSandboxPuzzle` behaviour and the gating of the Distributive-Expand law. | script assertions | runner |
| [`.e2e/sandbox-engine-audit.mjs`](../../.e2e/sandbox-engine-audit.mjs) | Browser. Proves two fixed defects: input strictness and recommended-input playability. | script assertions | runner |
| [`.e2e/generator-stress.mjs`](../../.e2e/generator-stress.mjs) | Node-only stress test of the randomizer across every difficulty: parseability, 2–3 variable scope, goal reachability matching BFS, SOP and POS shapes both appearing. | script assertions | runner |
| [`.e2e/sandbox-ui.mjs`](../../.e2e/sandbox-ui.mjs) | Browser. The user-visible contract of Sandbox mode. | script assertions | runner |
| [`.e2e/sandbox-input-ui.mjs`](../../.e2e/sandbox-input-ui.mjs) | Browser. The user-visible contract of the `/sandbox` input screen. | script assertions | runner |
| [`.e2e/responsive-tiers.mjs`](../../.e2e/responsive-tiers.mjs) | Browser. Device-tier detection, rotate overlay, rotate banner and the additive CSS foundation. | script assertions | runner |
| [`.e2e/mobile-landscape-workspace.mjs`](../../.e2e/mobile-landscape-workspace.mjs) | Browser. Drives the real workspace and measures the DOM for custom sandbox play and device-tiered layouts. | script assertions | runner |
| [`.e2e/mobile-ux-verify.mjs`](../../.e2e/mobile-ux-verify.mjs) | Browser. Workspace mobile UX: the two user asks plus five measured mobile defects. | script assertions | runner |
| [`.e2e/mobile-pages-verify.mjs`](../../.e2e/mobile-pages-verify.mjs) | Browser. Mobile verification for the non-workspace screens. | script assertions | runner |
| [`.e2e/tutorial-overlap-verify.mjs`](../../.e2e/tutorial-overlap-verify.mjs) | Browser. Walks every step of the 4-stage interactive tutorial on every required device and asserts the coach card never covers the box it points at. Imports `tutorialTargets.js` and `tutorialContent.js` directly. | script assertions | runner |
| [`.e2e/popup-overlap-verify.mjs`](../../.e2e/popup-overlap-verify.mjs) | Browser. Non-blocking popups (step-inspection tip, law explanation, hint bubble) must not overlay what the learner still needs. Run twice by the runner, the second time with `SKIP_TIP=1`. | script assertions | runner (`run popup-overlap env SKIP_TIP=1 …`) |
| [`.e2e/tutorial-gate.mjs`](../../.e2e/tutorial-gate.mjs) | Browser. A learner must finish the interactive tutorial before Levels 1–3 or the Sandbox open. | script assertions | runner |
| [`.e2e/gameplay.mjs`](../../.e2e/gameplay.mjs) | Browser. End-to-end gameplay against a live frontend and backend. | script assertions | runner |
| [`.e2e/law-comments.mjs`](../../.e2e/law-comments.mjs) | Browser. Law-comment rendering during play. | script assertions | runner |
| [`.e2e/acceptance-features.mjs`](../../.e2e/acceptance-features.mjs) | Browser. Acceptance harness for the sandbox input validator and the orientation/device tiers. | script assertions | runner |
| [`.e2e/gate-fresh-user-check.mjs`](../../.e2e/gate-fresh-user-check.mjs) | Browser, **not wired into the runner**. Wipes the account's server progress, then confirms a browser with no local snapshot is redirected into the tutorial from every gated route — and that the tutorial stays reachable. | script assertions | run by hand |
| [`.e2e/lead-engine-fingerprint.mjs`](../../.e2e/lead-engine-fingerprint.mjs) | Node, **not wired into the runner**. Dumps engine behaviour for every graded puzzle and every state along its optimal path, for diffing against the two JSON baselines. | script assertions | run by hand; compared against `.e2e/baselines/*.json` |
| [`.e2e/baselines/engine-default-pre-expand.json`](../../.e2e/baselines/engine-default-pre-expand.json) | Recorded engine fingerprint (`"mode": "default"`) over all 40 puzzles: for each puzzle, its `expr`, `goal`, `optimalSteps` and every reachable state with its canonical text and transitions. ~110 KB. A regression baseline, not an input. | data | `lead-engine-fingerprint.mjs` by comparison |
| [`.e2e/baselines/engine-default-post-expand.json`](../../.e2e/baselines/engine-default-post-expand.json) | The same fingerprint captured after the Distributive-Expand gating landed, for an explicit before/after diff. ~112 KB. | data | `lead-engine-fingerprint.mjs` by comparison |

---

## 8. `frontend/` root config

| Path | Responsibility | Key exports / symbols | Depended on by |
|---|---|---|---|
| [`frontend/package.json`](../../frontend/package.json) | The npm manifest. Scripts: `dev` (`vite`), `build` (`vite build`), `lint` (`eslint .`), `preview`, and **`test`: `node --test src/engine/__tests__/*.test.js`**. Runtime deps: `@supabase/supabase-js`, `framer-motion`, `react`, `react-dom`, `react-router-dom`, `sonner`. | — | npm |
| [`frontend/vite.config.js`](../../frontend/vite.config.js) | Dev-server and build config. Aliases **`@content` → `<repo>/content`** ("One source of truth, two consumers"), widens `server.fs.allow` to the repo root because `content/` sits outside the Vite root, and proxies `/api/auth` → `127.0.0.1:3001` (a **dead Better Auth remnant**) before `/api` → `VITE_API_TARGET` (default `http://127.0.0.1:8000`). | `default` config object | Vite |
| [`frontend/tailwind.config.js`](../../frontend/tailwind.config.js) | The design-token source of truth for anything reached through a class name: the `bg`/`border`/`text.1-3`/`accent` palette, `teal`/`amber`/`green`/`red` with `-light` variants, three shadows, three radii, the `Inter` + `JetBrains Mono` font stacks, the 180 ms default transition. | `default` config object | PostCSS/Tailwind build |
| [`frontend/postcss.config.js`](../../frontend/postcss.config.js) | Two PostCSS plugins: `tailwindcss`, `autoprefixer`. | `default` config object | PostCSS |
| [`frontend/eslint.config.js`](../../frontend/eslint.config.js) | Flat ESLint config: `js.configs.recommended` + `react-hooks` + `react-refresh`, browser globals for app code, and a separate block giving **node globals to `*.config.js`/`vite.config.js`** because `vite.config.js` reads `process.env`. | `default` config array | `npm run lint` |
| [`frontend/index.html`](../../frontend/index.html) | The Vite HTML entry: `#root` mount point, the `/src/main.jsx` module script, the `/favicon.svg` icon, and the Google Fonts preconnect + Inter/JetBrains Mono stylesheet. | — | Vite build |
| [`frontend/vercel.json`](../../frontend/vercel.json) | The Vercel routing rule for the SPA: `/api/(.*)` is rewritten to the deployed Render backend, everything else falls back to `/index.html` so client-side routes survive a refresh. | — | Vercel |
| [`frontend/.gitignore`](../../frontend/.gitignore) | The frontend's own ignores — logs, `node_modules`, `dist`, `.env`/`.env.*`, `*.local`, editor directories. This is why `frontend/.env.local` is never committed. | — | git |
| [`frontend/README.md`](../../frontend/README.md) | The frontend-only quick start (the four npm scripts, the port-8000 backend dependency, pointing `VITE_API_TARGET` elsewhere). Explicitly defers setup to the root `README.md` and the architecture map to `docs/ARCHITECTURE.md`. | — | humans |

---

## 9. `frontend/src/` entry points

| Path | Responsibility | Key exports / symbols | Depended on by |
|---|---|---|---|
| [`frontend/src/main.jsx`](../../frontend/src/main.jsx) | The React entry. **Import order is load-bearing** and documented in the file: `index.css` (Tailwind layers) → `tokens.css` → `utilities.css` → `orientation.css` → `animations.css`, then `App.jsx`. Mounts into `#root` inside `StrictMode`. | — (side effects only) | `frontend/index.html` |
| [`frontend/src/App.jsx`](../../frontend/src/App.jsx) | The route table and provider tree: `ErrorBoundary` → `AuthProvider` → `BrowserRouter` → global `OrientationGate` + `Toaster` → `Routes`. Declares **9 routes**: `/`, `/login`, `/register`, `/levels`, `/level/:levelId/stages`, `/level/:levelId/stage/:stageIdx`, `/sandbox`, `/sandbox/play`, `*`. Everything below `/levels` is wrapped `ProtectedRoute > TutorialGate`; `/sandbox/play` reuses `ProblemPage`, and the absence of route params is what puts it in sandbox mode. | `default` component | `main.jsx` |

---

## 10. `frontend/src/pages/`

One file per route. Pages own routing, data wiring and screen-level state; they do not own the
workspace internals (that is `components/puzzle/`).

| Path | Responsibility | Key exports / symbols | Depended on by |
|---|---|---|---|
| [`frontend/src/pages/LandingPage.jsx`](../../frontend/src/pages/LandingPage.jsx) | `/` — the public landing screen: logo, hero, sign-in/sign-out affordances, the survey button and the sound toggle. | `default` component | `App.jsx` |
| [`frontend/src/pages/LoginPage.jsx`](../../frontend/src/pages/LoginPage.jsx) | `/login` — the sign-in form; calls `signIn` from `services/authActions.js` and routes on success. | `default` component | `App.jsx` |
| [`frontend/src/pages/RegisterPage.jsx`](../../frontend/src/pages/RegisterPage.jsx) | `/register` — the sign-up form, same shape as login, with an invalid-state border treatment. | `default` component | `App.jsx` |
| [`frontend/src/pages/LevelSelectPage.jsx`](../../frontend/src/pages/LevelSelectPage.jsx) | `/levels` — the four level cards with points, stars, lock state and the unlock-gate reasoning. | `default` component | `App.jsx` |
| [`frontend/src/pages/StageSelectorPage.jsx`](../../frontend/src/pages/StageSelectorPage.jsx) | `/level/:levelId/stages` — the stage grid for one level: per-stage stars, completion and the level's average-score gate. | `default` component | `App.jsx` |
| [`frontend/src/pages/ProblemPage.jsx`](../../frontend/src/pages/ProblemPage.jsx) | **The composition root of the puzzle workspace**, for both `/level/:levelId/stage/:stageIdx` and `/sandbox/play`. Owns the device tier, transient UI state and the wiring; delegates the session to `usePuzzleSession`, the sandbox contract to `sandboxPuzzle` and the popup layer to `useCollisionPlacement`. | `default` component | `App.jsx` |
| [`frontend/src/pages/SandboxPage.jsx`](../../frontend/src/pages/SandboxPage.jsx) | `/sandbox` — the expression-entry screen: live debounced syntax verdict, then a solvability check via `buildSandboxPuzzle` before handing the puzzle to `/sandbox/play`. | `default` component | `App.jsx` |

---

## 11. `frontend/src/services/`

**Every HTTP call in the app goes through this directory.** `fetch(` appears exactly **once** in
`frontend/src/` — at [`frontend/src/services/apiClient.js:63`](../../frontend/src/services/apiClient.js#L63).
No component, page, hook or state module calls it.

| Path | Responsibility | Key exports / symbols | Depended on by |
|---|---|---|---|
| [`frontend/src/services/apiClient.js`](../../frontend/src/services/apiClient.js) | The single HTTP entry point for the FastAPI backend. Attaches the Supabase access token, sets `Content-Type`, unwraps the `{ success, data, error }` envelope (still tolerating legacy plain JSON), and throws `ApiError` with `status`/`code`/`detail`. `silent: true` returns `null` on failure instead of throwing. | `ApiError`, `apiRequest`, `authHeaders`, `unwrap` | `services/contentApi.js`, `services/progressApi.js`, `services/scoreApi.js` |
| [`frontend/src/services/authActions.js`](../../frontend/src/services/authActions.js) | The **only** module that calls `supabase.auth` mutations: `signIn`, `signUp`, `signOut`. Each returns `{ data, error: { message } \| null }` so screens never need to know which provider is behind it. | `signIn`, `signUp`, `signOut` | `pages/LandingPage.jsx`, `pages/LevelSelectPage.jsx`, `pages/LoginPage.jsx`, `pages/RegisterPage.jsx` |
| [`frontend/src/services/contentApi.js`](../../frontend/src/services/contentApi.js) | Content access. Serves laws and level summaries straight from the bundle (never blocks on the network) and `fetchLevel` falls back to `GET /api/levels/{id}` only for an id that is not bundled, de-duplicating concurrent requests. | `getLevelSummaries`, `getLaws`, `fetchLevel` | `state/useGameContent.js` |
| [`frontend/src/services/progressApi.js`](../../frontend/src/services/progressApi.js) | Server-side progress sync via `GET /api/progress` and `POST /api/progress/save`. Both are **silent** on failure, so a network problem can never block gameplay. | `loadProgress`, `saveProgress` | `state/progressStore.js` |
| [`frontend/src/services/scoreApi.js`](../../frontend/src/services/scoreApi.js) | Carries a finished derivation to `POST /api/score`. Failures are silent by design: an offline solver still sees the local breakdown, they just do not get it persisted. | `submitScore` | `state/useGameContent.js` |
| [`frontend/src/services/soundEffects.js`](../../frontend/src/services/soundEffects.js) | The app's only audio code: synthesised Web Audio cues, no assets, no network. Every cue is built from `config/gameRules.SOUND`; the mixer is module state, never React state. | `isSoundEnabled`, `setSoundEnabled`, `primeAudio`, `playSound` | `components/puzzle/usePuzzleSession.js`, `hooks/useSoundEnabled.js`, `state/useGameState.js` |
| [`frontend/src/services/supabaseClient.js`](../../frontend/src/services/supabaseClient.js) | The app's only connection to the auth backend. `createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)`. | `supabase` | `services/apiClient.js`, `services/authActions.js`, `state/AuthProvider.jsx` |

---

## 12. `frontend/src/state/`

| Path | Responsibility | Key exports / symbols | Depended on by |
|---|---|---|---|
| [`frontend/src/state/authContext.js`](../../frontend/src/state/authContext.js) | The auth context **object**, isolated in a module with no component and no hook so `AuthProvider.jsx` exports only a component and `useSession.js` only a hook — React Fast Refresh breaks when one file mixes them. | `AuthContext` | `state/AuthProvider.jsx`, `state/useSession.js` |
| [`frontend/src/state/AuthProvider.jsx`](../../frontend/src/state/AuthProvider.jsx) | Subscribes to Supabase auth once and publishes `{ data: { user, session } \| null, isPending, error }`. Mounted once above the router; nothing else talks to `supabase.auth`. | `AuthProvider` | `App.jsx` |
| [`frontend/src/state/useSession.js`](../../frontend/src/state/useSession.js) | The read side of the auth context. 10 lines. | `useSession` | `components/ProtectedRoute.jsx`, `pages/LandingPage.jsx`, `pages/LoginPage.jsx`, `pages/RegisterPage.jsx`, `state/useProgress.js` |
| [`frontend/src/state/progressStore.js`](../../frontend/src/state/progressStore.js) | **The single source of truth for learner state**, living outside React. Owns the localStorage snapshot, the `GUEST_USER_ID` path, points/streak mutations, stage and level completion, saved solutions, and the pure selectors `getLevelProgress` (completion, average score, `unlocked`) and `starsForScore`. | `GUEST_USER_ID`, `PROGRESS_KEY_PREFIX`, `subscribe`, `getSnapshot`, `setUser`, `addPoints`, `deductPoints`, `completeStage`, `completeLevel`, `saveScore`, `saveSolution`, `resetStreak`, `markTutorialSeen`, `resetLevelProgress`, `getStagesCompleted`, `isStageCompleted`, `isLevelCompleted`, `getSavedSolution`, `getLevelProgress`, `hasSeenTutorial`, `hasCompletedTutorial` | `state/useProgress.js` |
| [`frontend/src/state/useProgress.js`](../../frontend/src/state/useProgress.js) | The React binding for the store via `useSyncExternalStore`, so every component observes the **same** state. Merges the localStorage snapshot with the server snapshot after hydration. | `useProgress` | `components/TutorialGate.jsx`, `components/puzzle/usePuzzleSession.js`, `pages/LevelSelectPage.jsx`, `pages/StageSelectorPage.jsx` |
| [`frontend/src/state/useGameContent.js`](../../frontend/src/state/useGameContent.js) | The React binding for the content and score services. Levels and laws render on first paint, so `loading`/`error` stay `false`/`null`; the shape is kept because the screens render against it. | `useGameContent` | `components/puzzle/usePuzzleSession.js`, `pages/LevelSelectPage.jsx`, `pages/StageSelectorPage.jsx` |
| [`frontend/src/state/useGameState.js`](../../frontend/src/state/useGameState.js) | The puzzle state machine: parse the expression into an AST, track selection, resolve which laws apply, apply a step, keep the derivation history with undo, and detect a dead end. Takes the sandbox-only `allowExpand` opt-in. | `useGameState` | `components/puzzle/usePuzzleSession.js` |
| [`frontend/src/state/hintText.js`](../../frontend/src/state/hintText.js) | Turns an engine hint (law id + node paths) into the sentence the learner reads. Pure, so the wording is testable without mounting React. | `DEAD_END_MSG`, `buildHintText` | `state/useGameState.js` |

---

## 13. `frontend/src/engine/`

**23 modules / 3,182 lines excluding tests**, plus 7 test files. This is the only Boolean-algebra
implementation in the repository, and it is framework-free, network-free and React-free — verified:
these three commands all return **nothing**:

```bash
grep -rnE "^import .* from '[^.]" frontend/src/engine/ | grep -v __tests__
grep -rnE "fetch\(|window\.|document\.|localStorage|sessionStorage" frontend/src/engine/
grep -rnE "from '(react|react-dom|react-router|react-router-dom|@supabase)" frontend/src/engine/
``` Consumers import the barrel [`frontend/src/engine/index.js`](../../frontend/src/engine/index.js),
never a deep module, and §13.5 shows that nothing in the engine imports upward.

### 13.1 Public API and AST

| Path | Responsibility | Key exports / symbols | Depended on by |
|---|---|---|---|
| [`frontend/src/engine/index.js`](../../frontend/src/engine/index.js) | The **barrel** — the engine's public API and the file that states the layering rule: "nothing in engine/ may import from components/, screens/, state/, services/ or hooks/. The only external imports are plain data/constants (config/gameRules.js)." Re-exports AST builders, traversal, text↔AST, semantics, law detection, search, client scoring and the sandbox builders. | ~45 re-exported names | 5 `.e2e` suites, `components/AnimationOverlay.jsx`, `components/animations/DeMorganSplitAnimation.jsx`, `components/puzzle/sandboxPuzzle.js`, `components/puzzle/usePuzzleSession.js`, `pages/SandboxPage.jsx`, `state/hintText.js`, `state/useGameState.js` |
| [`frontend/src/engine/node.js`](../../frontend/src/engine/node.js) | The AST node primitives and their shape: `lit { v, n }`, `const { val }`, `prod { factors }`, `sum { terms }`, `not { child }`. Every node carries a monotonic `_id` so the UI can track the same node across edits. | `nextNodeId`, `lit`, `con`, `prod`, `sum`, `neg`, `cloneN`, `ensureNodeId` | 13 modules incl. the barrel |
| [`frontend/src/engine/tree.js`](../../frontend/src/engine/tree.js) | **Tree traversal and structural edits — and the definition of the node-path convention** (`'R'` = root, `'R.1'` = second term of the root, `'R.1.0'` = its first child, a `not` node's child is `.0`). | `getNode`, `setNode`, `findCommonSum`, `findCommonProd`, `removeLitFromNode`, `removeLitFromSumNode`, `termContainsLit`, `sumContainsLit`, `getSumLits`, `isSubSum` | 10 modules incl. the barrel |
| [`frontend/src/engine/parser.js`](../../frontend/src/engine/parser.js) | Text → AST. | `parseExpr` | 10 modules incl. the barrel |
| [`frontend/src/engine/render.js`](../../frontend/src/engine/render.js) | AST → text: `nodeText` (display form) and `canonText` (canonical comparison form). Smallest engine module at 46 lines — and the one an older summary of this repo omitted. | `nodeText`, `canonText` | 16 modules incl. the barrel |
| [`frontend/src/engine/normalize.js`](../../frontend/src/engine/normalize.js) | Flattening and canonicalization: `normalize` (structural, to the house shape) and `normalizeFlat` (comparison form). | `normalize`, `normalizeFlat` | 7 modules incl. the barrel |
| [`frontend/src/engine/validate.js`](../../frontend/src/engine/validate.js) | Syntax validation of a typed expression. | `validateExpr` | `engine/__tests__/validate.test.js`, `engine/index.js`, `engine/sandbox/generator.js` |
| [`frontend/src/engine/equivalence.js`](../../frontend/src/engine/equivalence.js) | Semantics: collect the variables, evaluate the AST under an assignment, and decide equivalence (by truth-table evaluation, not by string comparison). | `extractVariables`, `evalAST`, `isEquivalent` | 10 modules incl. the barrel |

### 13.2 Law detection

| Path | Responsibility | Key exports / symbols | Depended on by |
|---|---|---|---|
| [`frontend/src/engine/laws/definitions.js`](../../frontend/src/engine/laws/definitions.js) | **The one place a law's identity lives.** `LAW_DEFINITIONS` holds `{ id, name, formula, mode, form }` for every detection arm — including the internal `distributive-expand`, which is *not* one of the 10 reference cards; `LAW_NAME_TO_ID` is derived from it so scoring maps names to ids once; `defineLaw` throws on an unknown name+form so a typo fails loudly. | `LAW_MODE`, `LAW_FORM`, `LAW_DEFINITIONS`, `LAW_NAME_TO_ID`, `defineLaw` | `engine/laws/constLaws.js`, `notLaws.js`, `productLaws.js`, `sumLaws.js`, `laws/index.js`, `engine/scoring.js`, `engine/__tests__/laws.test.js` |
| [`frontend/src/engine/laws/index.js`](../../frontend/src/engine/laws/index.js) | The law-layer barrel. `analyzeSelection` is the entry point the UI calls when the learner selects something; `analyzeNot` / `analyzeSumConst` / `analyzeProductConst` are the per-shape arms. | `getLits`, `isSubT`, `termsEq`, `scanHints`, `LAW_DEFINITIONS`, `LAW_MODE`, `LAW_FORM`, `LAW_NAME_TO_ID`, `defineLaw`, `analyzeSelection`, `analyzeNot`, `analyzeSumConst`, `analyzeProductConst` | 5 modules incl. the barrel and `engine/solver.js` |
| [`frontend/src/engine/laws/helpers.js`](../../frontend/src/engine/laws/helpers.js) | Shared predicates for the law arms: literal collection, term equality, sub-term tests, and the absorption/expansion predicates that the soundness fix centred on. | `getLits`, `termsEq`, `isSubT`, `absorbsInSum`, `absorbsInProduct`, `findLitPath`, `findExpandablePair` | `engine/laws/index.js`, `productLaws.js`, `scanHints.js`, `sumLaws.js` |
| [`frontend/src/engine/laws/sumLaws.js`](../../frontend/src/engine/laws/sumLaws.js) | The SOP (sum-level) law arm — the largest law module at 259 lines. | `sumLaws` | `engine/laws/index.js` |
| [`frontend/src/engine/laws/productLaws.js`](../../frontend/src/engine/laws/productLaws.js) | The POS (product-level) law arm, 224 lines. Contains the deliberate no-op for `distributive-expand`, which has no animation branch. | `productLaws` | `engine/laws/index.js` |
| [`frontend/src/engine/laws/notLaws.js`](../../frontend/src/engine/laws/notLaws.js) | The negated-node arm: double negation and De Morgan's two directions. | `notLaws` | `engine/laws/index.js` |
| [`frontend/src/engine/laws/constLaws.js`](../../frontend/src/engine/laws/constLaws.js) | The constant arm: identity (`+0`, `·1`) and annulment (`+1`, `·0`). | `sumConstLaws`, `productConstLaws` | `engine/laws/index.js` |
| [`frontend/src/engine/laws/scanHints.js`](../../frontend/src/engine/laws/scanHints.js) | **The whole-expression hint scanner** — a pure structural walk that reports every place a law applies, de-duplicated by `law\|paths` and returned in traversal order so the first hint is always the left-most one. Powers the Hint button, the Guide's pre-selection and dead-end detection. | `scanHints` | `engine/laws/index.js` |

### 13.3 Search and client scoring

| Path | Responsibility | Key exports / symbols | Depended on by |
|---|---|---|---|
| [`frontend/src/engine/solver.js`](../../frontend/src/engine/solver.js) | The search: `getLegalTransitions` enumerates the moves from one state, `findOptimalPath` returns the shortest derivation, `findSimplestForm` returns the simplest reachable form. Bounded by `SOLVER_BUDGET` from `config/gameRules.js`; `allowExpand` (default `false`) opts the sandbox into the gated Distributive-Expand law. 323 lines — the largest engine module. | `getLegalTransitions`, `findOptimalPath`, `findSimplestForm` | 7 modules incl. the barrel |
| [`frontend/src/engine/scoring.js`](../../frontend/src/engine/scoring.js) | The **ONE client-side implementation** of the scoring rules — a mirror of `backend/services/scoring_service.py` so the UI can render a breakdown instantly and offline. Weights and penalties come from `config/gameRules.js`; `round1` is `Math.round(value * 10) / 10`. Must stay in lockstep with the backend. | `lawIdOf`, `lawsUsedFromSteps`, `effectiveOptimalSteps`, `estimateScore` | `engine/index.js` |

### 13.4 Sandbox

| Path | Responsibility | Key exports / symbols | Depended on by |
|---|---|---|---|
| [`frontend/src/engine/sandbox/input.js`](../../frontend/src/engine/sandbox/input.js) | The learner-authored expression contract: validate the typed text, normalize it, and `buildSandboxPuzzle` the playable puzzle from it. Takes its variable ceiling and search budget from `SANDBOX` in `config/gameRules.js`. | `normalizeSandboxExpr`, `validateSandboxInput`, `MAX_SANDBOX_VARS`, `buildSandboxPuzzle` | `engine/__tests__/sandbox.test.js`, `engine/index.js` |
| [`frontend/src/engine/sandbox/validate.js`](../../frontend/src/engine/sandbox/validate.js) | The sandbox tokenizer + strict validator: `scanTokens`, `canonicalTokenText`, the frozen error-code contract and `resolveMaxVariables`. 251 lines. | `resolveMaxVariables`, `scanTokens`, `canonicalTokenText`, `validateSandboxInput`, `normalizeSandboxExpr` | `engine/sandbox/generator.js`, `engine/sandbox/input.js` |
| [`frontend/src/engine/sandbox/generator.js`](../../frontend/src/engine/sandbox/generator.js) | The random problem generator: variable pools, the four difficulty presets, a seeded RNG, and `generateRandomPuzzle` / `generatePuzzlePair`, both solver-verified before they are returned. 245 lines. | `VAR_POOL`, `VAR_POOL_COMPLEX`, `DIFFICULTIES`, `normalizeDifficulty`, `makeRng`, `randomSeed`, `generateRandomPuzzle`, `generatePuzzlePair` | `engine/__tests__/sandbox.test.js`, `engine/index.js` |
| [`frontend/src/engine/sandbox/expand.js`](../../frontend/src/engine/sandbox/expand.js) | The gated expansion helpers: recognise a SOP/POS root and expand one step, plus `coverVariables` for scope checks. | `isSopRoot`, `isPosRoot`, `expandOnce`, `coverVariables` | `engine/sandbox/generator.js` |
| [`frontend/src/engine/sandbox/pool.js`](../../frontend/src/engine/sandbox/pool.js) | The curated, hand-checked practice pool and a sampler over it. 47 lines — the smallest engine module. | `SANDBOX_POOL`, `randomPoolEquation` | `engine/__tests__/sandbox.test.js`, `engine/index.js`, `engine/sandbox/generator.js` |

### 13.5 The engine rule (evidence)

| Rule | Evidence |
|---|---|
| The engine imports nothing from React, the DOM, storage or the network | `grep -rnE "fetch\(|window\.|document\.|localStorage|sessionStorage" frontend/src/engine/` → no matches, and `grep -rnE "^import .* from '[^.]" frontend/src/engine/` (excluding `__tests__`) → no matches |
| The engine's only external import is plain data/constants | `engine/solver.js:1`, `engine/sandbox/generator.js:11`, `engine/sandbox/validate.js:26`, `engine/sandbox/input.js:36`, `engine/scoring.js:14-18` — all import `config/gameRules.js` |
| Nothing in the engine imports upward into the app | `grep -rn "from '\.\./\(components\|pages\|state\|services\|hooks\)" frontend/src/engine/` → no matches |
| Consumers use the barrel, not deep paths | `components/AnimationOverlay.jsx`, `components/animations/DeMorganSplitAnimation.jsx`, `components/puzzle/sandboxPuzzle.js`, `components/puzzle/usePuzzleSession.js`, `pages/SandboxPage.jsx`, `state/hintText.js`, `state/useGameState.js` all import `engine/index.js` |

### 13.6 Tests

Run with `npm test` → `node --test src/engine/__tests__/*.test.js`. **76 tests, 76 pass, 0 fail**
(verified; ~13.7 s in this environment).

| Path | Responsibility | Key exports / symbols | Depended on by |
|---|---|---|---|
| [`frontend/src/engine/__tests__/parser.test.js`](../../frontend/src/engine/__tests__/parser.test.js) | Parser and round-trip tests (including the tolerated trailing-whitespace case). | `node:test` cases | `npm test` |
| [`frontend/src/engine/__tests__/validate.test.js`](../../frontend/src/engine/__tests__/validate.test.js) | Syntax-validator tests: every rejection reason and the valid-expression path. | `node:test` cases | `npm test` |
| [`frontend/src/engine/__tests__/laws.test.js`](../../frontend/src/engine/__tests__/laws.test.js) | Law-detection tests, including the two assertions that pin Distributive-Expand off by default and on in sandbox mode. | `node:test` cases | `npm test` |
| [`frontend/src/engine/__tests__/absorption.test.js`](../../frontend/src/engine/__tests__/absorption.test.js) | Focused absorption-law regression suite. | `node:test` cases | `npm test` |
| [`frontend/src/engine/__tests__/solver.test.js`](../../frontend/src/engine/__tests__/solver.test.js) | Solver tests: legal transitions, optimal path length, simplest form. | `node:test` cases | `npm test` |
| [`frontend/src/engine/__tests__/sandbox.test.js`](../../frontend/src/engine/__tests__/sandbox.test.js) | Sandbox contract tests: input, generator, curated pool, `SANDBOX` budget. | `node:test` cases | `npm test` |
| [`frontend/src/engine/__tests__/law-soundness.property.test.js`](../../frontend/src/engine/__tests__/law-soundness.property.test.js) | The property test: every law, applied to randomly generated expressions, must preserve semantics according to `isEquivalent`. The suite the soundness fix was re-baselined against. | `node:test` cases | `npm test` |

---

## 14. `frontend/src/components/`

**65 files across 6 subdirectories plus 10 top-level `.jsx` files.** Components render; they do not
fetch (§11) and they do not implement algebra (§13).

### 14.1 Top level

| Path | Responsibility | Key exports / symbols | Depended on by |
|---|---|---|---|
| [`frontend/src/components/ErrorBoundary.jsx`](../../frontend/src/components/ErrorBoundary.jsx) | The outermost class component: catches a render error and shows a fallback instead of a blank page. | `default` class | `App.jsx` |
| [`frontend/src/components/ProtectedRoute.jsx`](../../frontend/src/components/ProtectedRoute.jsx) | Redirects an unauthenticated visitor to `/login` while auth is pending/resolved. | `default` component | `App.jsx` |
| [`frontend/src/components/TutorialGate.jsx`](../../frontend/src/components/TutorialGate.jsx) | Blocks the graded levels and the Sandbox until the interactive tutorial is finished, sent to `/level/0/stage/0?tutorial=true`. Exempts the tutorial route itself, and waits for `progressHydrated` so a returning learner on a new device is not bounced. Its own comment is explicit: "a UX gate, not a security boundary". | `default` component | `App.jsx` |
| [`frontend/src/components/OrientationGate.jsx`](../../frontend/src/components/OrientationGate.jsx) | The app-wide orientation policy: phone + portrait → blocking `RotateOverlay`; small tablet + portrait → dismissible `RotateBanner`; everything else → nothing. Decided by `useDeviceTier`, **no User-Agent sniffing**. | `default` component | `App.jsx` |
| [`frontend/src/components/RotateOverlay.jsx`](../../frontend/src/components/RotateOverlay.jsx) | The non-dismissible full-screen "rotate your device" gate for phones in portrait. Opaque by design. | `default` component | `components/OrientationGate.jsx` |
| [`frontend/src/components/RotateBanner.jsx`](../../frontend/src/components/RotateBanner.jsx) | The advisory, dismissible rotate hint for small tablets in portrait; the app stays usable. | `default` component | `components/OrientationGate.jsx` |
| [`frontend/src/components/AnimationOverlay.jsx`](../../frontend/src/components/AnimationOverlay.jsx) | Renders the physical law animation for the law id of the step just applied, by resolving through `components/animations/index.js`. | `default` component | `components/puzzle/DerivationCanvas.jsx` |
| [`frontend/src/components/ExpressionDisplay.jsx`](../../frontend/src/components/ExpressionDisplay.jsx) | Renders the expression AST as interactive elements: one ⠿ grip per SOP term (click = select the term, drag = reorder within the sum) and one clickable capsule per literal, with negation capsules. Consumes the frozen `useTermDrag` contract. | `default` component | `components/puzzle/DerivationCanvas.jsx` |
| [`frontend/src/components/ExprText.jsx`](../../frontend/src/components/ExprText.jsx) | Renders a plain `nodeText()` string with real overline bars instead of apostrophes. Used everywhere an expression is shown read-only. | `default` component | 7 animation components, `components/puzzle/DerivationCanvas.jsx`, `components/puzzle/StepHistoryPanel.jsx`, `pages/StageSelectorPage.jsx` |
| [`frontend/src/components/InteractiveTutorial.jsx`](../../frontend/src/components/InteractiveTutorial.jsx) | The **thin orchestrator** of the 4-stage guided walkthrough: backdrop, modal cross-fade and the adaptive coach card. Delegates the step machine to `useTutorialProgress`, the spotlight rects to `useSpotlightRects`, the placement to `useCoachCardPlacement` and the visuals to `Spotlight` / `CoachCard` / `WelcomeModal`. | `default` component | `pages/ProblemPage.jsx` |

### 14.2 `animations/`

| Path | Responsibility | Key exports / symbols | Depended on by |
|---|---|---|---|
| [`frontend/src/components/animations/index.js`](../../frontend/src/components/animations/index.js) | **The lawId → animation registry.** Ordered prefix rules for `demorgan*` and `annulment*`, exact matches for the rest; an unmatched id (e.g. `distributive-expand`) resolves to `null` and the host renders nothing. | `resolveLawAnimation` | `components/AnimationOverlay.jsx` |
| [`frontend/src/components/animations/animationStyles.js`](../../frontend/src/components/animations/animationStyles.js) | The shared inline styles the law overlays use: ghost-text layers sitting on a measured term rect, and shockwave rings centred on one. Their `animation` shorthands are what drive the keyframes in `styles/animations.css`. | `ghostTextStyle`, `shockwaveStyle` | all 8 animation components |
| [`frontend/src/components/animations/AbsorptionAnimation.jsx`](../../frontend/src/components/animations/AbsorptionAnimation.jsx) | `A + A·B = A` — the shorter survivor pulses while the absorbed term evaporates. | `default` component | registry |
| [`frontend/src/components/animations/AnnulmentAnimation.jsx`](../../frontend/src/components/animations/AnnulmentAnimation.jsx) | `A + 1 = 1`, `A · 0 = 0` — the variable is swallowed by a singularity shockwave. | `default` component | registry |
| [`frontend/src/components/animations/ComplementBurstAnimation.jsx`](../../frontend/src/components/animations/ComplementBurstAnimation.jsx) | `A + A' = 1`, `A · A' = 0` — the literals collide and burst into the constant. | `default` component | registry |
| [`frontend/src/components/animations/DeMorganSplitAnimation.jsx`](../../frontend/src/components/animations/DeMorganSplitAnimation.jsx) | De Morgan's — the overbar dissolves, the operator flips, overbars cancel and re-drop. The only animation that imports the engine barrel. | `default` component | registry |
| [`frontend/src/components/animations/DistributiveFactoringAnimation.jsx`](../../frontend/src/components/animations/DistributiveFactoringAnimation.jsx) | Distributive factoring — the shared factor lifts out and parentheses materialise. | `default` component | registry |
| [`frontend/src/components/animations/DoubleNegationAnimation.jsx`](../../frontend/src/components/animations/DoubleNegationAnimation.jsx) | `(A')' = A` — dual overbars cross-cancel. | `default` component | registry |
| [`frontend/src/components/animations/IdempotentAnimation.jsx`](../../frontend/src/components/animations/IdempotentAnimation.jsx) | `A + A = A` — the duplicate glides into the survivor under a harmonic shockwave. | `default` component | registry |
| [`frontend/src/components/animations/IdentityAnimation.jsx`](../../frontend/src/components/animations/IdentityAnimation.jsx) | `A + 0 = A`, `A · 1 = A` — the inert constant drops in and evaporates. | `default` component | registry |

### 14.3 `laws/`

| Path | Responsibility | Key exports / symbols | Depended on by |
|---|---|---|---|
| [`frontend/src/components/laws/LawCard.jsx`](../../frontend/src/components/laws/LawCard.jsx) | One law reference entry: name, formula lines, prose description. Presentational — the caller owns the data. | `default` component | `components/laws/LawsDrawer.jsx`, `components/puzzle/LawsReferenceSheet.jsx` |
| [`frontend/src/components/laws/LawsDrawer.jsx`](../../frontend/src/components/laws/LawsDrawer.jsx) | The sliding full-height law-reference drawer for the level screens (scrim + right-edge panel). | `default` component | `components/layout/PageOverlays.jsx` |

### 14.4 `layout/`

| Path | Responsibility | Key exports / symbols | Depended on by |
|---|---|---|---|
| [`frontend/src/components/layout/AppHeader.jsx`](../../frontend/src/components/layout/AppHeader.jsx) | The shared page-header shell — card/backdrop-blur bar with left and right slots; `variant` keeps the two existing bar treatments. | `default` component | `pages/LevelSelectPage.jsx`, `pages/StageSelectorPage.jsx` |
| [`frontend/src/components/layout/BackNav.jsx`](../../frontend/src/components/layout/BackNav.jsx) | The back control + Praxis logo cluster shared by the level screens (`variant`: `home` / `levels`). | `default` component | `pages/LevelSelectPage.jsx`, `pages/StageSelectorPage.jsx` |
| [`frontend/src/components/layout/PageOverlays.jsx`](../../frontend/src/components/layout/PageOverlays.jsx) | The two overlays every level screen ends with — the tutorial-replay prompt and the law drawer. Presentational; visibility and measured placement are props. | `default` component | `pages/LevelSelectPage.jsx`, `pages/StageSelectorPage.jsx` |
| [`frontend/src/components/layout/SurveyButton.jsx`](../../frontend/src/components/layout/SurveyButton.jsx) | The outbound learner-survey anchor: no router, no state, no tracking; `compact` shrinks it to an icon and it stays ≥ 44 px on landscape phones. | `default` component | `components/puzzle/WorkspaceHeader.jsx`, `pages/LandingPage.jsx`, `pages/LevelSelectPage.jsx`, `pages/StageSelectorPage.jsx` |

### 14.5 `puzzle/`

| Path | Responsibility | Key exports / symbols | Depended on by |
|---|---|---|---|
| [`frontend/src/components/puzzle/usePuzzleSession.js`](../../frontend/src/components/puzzle/usePuzzleSession.js) | **The orchestration hook of the workspace.** Owns the route identity (graded vs sandbox), loads the puzzle to play (fetched, restored from a saved solution, or generated), binds `useGameState`, and runs completion + scoring. | `default` hook | `pages/ProblemPage.jsx` |
| [`frontend/src/components/puzzle/sandboxPuzzle.js`](../../frontend/src/components/puzzle/sandboxPuzzle.js) | The whole sandbox contract of the workspace: the synthetic `SANDBOX_LEVEL`, the sessionStorage custom-puzzle slot, and `resolveCustomPuzzle` / `buildSandboxState` for the `/sandbox` → `/sandbox/play` hand-off. | `SANDBOX_LEVEL`, `useStoredCustomPuzzleSlot`, `buildSandboxState`, `resolveCustomPuzzle` | `components/puzzle/usePuzzleSession.js` |
| [`frontend/src/components/puzzle/DerivationCanvas.jsx`](../../frontend/src/components/puzzle/DerivationCanvas.jsx) | The expression workspace: animation overlay, status banner, zoom wrapper, the derivation chain, and the stepper rail that opens a step's explanation. | `default` component | `pages/ProblemPage.jsx` |
| [`frontend/src/components/puzzle/WorkspaceHeader.jsx`](../../frontend/src/components/puzzle/WorkspaceHeader.jsx) | The centre-panel header: back nav, step-history toggle, title/subtitle, sandbox/points chip, randomize action, and the wide controls or the compact control rail. | `default` component | `pages/ProblemPage.jsx` |
| [`frontend/src/components/puzzle/SidePanel.jsx`](../../frontend/src/components/puzzle/SidePanel.jsx) | The right column of the wide tiers: level/sandbox progress, the points card with Hint/Guide/Laws, and the quick stage picker. | `default` component | `pages/ProblemPage.jsx` |
| [`frontend/src/components/puzzle/LawPanel.jsx`](../../frontend/src/components/puzzle/LawPanel.jsx) | The applicable-laws dock under the canvas — scrollable strip on compact tiers, grid on tablet portrait; becomes the completion bar once the stage is solved. | `default` component | `pages/ProblemPage.jsx` |
| [`frontend/src/components/puzzle/LawsReferenceSheet.jsx`](../../frontend/src/components/puzzle/LawsReferenceSheet.jsx) | The in-workspace laws quick reference: bottom sheet on narrow/short viewports, right-hand drawer on wide+tall ones. | `LawsReferenceButton`, `default` component | `components/puzzle/SidePanel.jsx`, `components/puzzle/WorkspaceHeader.jsx`, `pages/ProblemPage.jsx` |
| [`frontend/src/components/puzzle/StepHistoryPanel.jsx`](../../frontend/src/components/puzzle/StepHistoryPanel.jsx) | The derivation history — first column on wide tiers, overlay drawer on compact ones, carrying the tutorial/zoom controls that have no header room there. | `default` component | `pages/ProblemPage.jsx` |
| [`frontend/src/components/puzzle/ScoreModal.jsx`](../../frontend/src/components/puzzle/ScoreModal.jsx) | The completion overlay: the three-metric breakdown for a graded stage (local estimate, overwritten by the server result), an unscored summary in the sandbox. | `default` component | `pages/ProblemPage.jsx` |
| [`frontend/src/components/puzzle/AssistanceControls.jsx`](../../frontend/src/components/puzzle/AssistanceControls.jsx) | The Hint + Guide pair. The Guide costs `guideCost` points; the sandbox sets that to 0. | `default` component | `components/puzzle/SidePanel.jsx`, `components/puzzle/WorkspaceHeader.jsx` |
| [`frontend/src/components/puzzle/HintBubble.jsx`](../../frontend/src/components/puzzle/HintBubble.jsx) | The hint popup, parked against the Hint button by the collision-aware popup layer. | `default` component | `pages/ProblemPage.jsx` |
| [`frontend/src/components/puzzle/LawExplanationCard.jsx`](../../frontend/src/components/puzzle/LawExplanationCard.jsx) | The card explaining the law behind an inspected derivation step. | `default` component | `pages/ProblemPage.jsx` |
| [`frontend/src/components/puzzle/StepInspectionTip.jsx`](../../frontend/src/components/puzzle/StepInspectionTip.jsx) | The first-run tip that a past step can be inspected; shares the popup layer with the law explanation. | `default` component | `pages/ProblemPage.jsx` |
| [`frontend/src/components/puzzle/ResetConfirmModal.jsx`](../../frontend/src/components/puzzle/ResetConfirmModal.jsx) | The confirmation shown when a solved stage is reset, with its per-session opt-out. | `default` component | `pages/ProblemPage.jsx` |
| [`frontend/src/components/puzzle/TutorialToggle.jsx`](../../frontend/src/components/puzzle/TutorialToggle.jsx) | The "Tutorial" on/off control of the guided walkthrough — header on wide tiers, step-history drawer on compact ones. | `default` component | `components/puzzle/StepHistoryPanel.jsx`, `components/puzzle/WorkspaceHeader.jsx` |
| [`frontend/src/components/puzzle/ZoomControls.jsx`](../../frontend/src/components/puzzle/ZoomControls.jsx) | The zoom out / reset / in cluster of the expression canvas. Presentational — `zoom` in, `onZoom` out. | `default` component | `components/puzzle/StepHistoryPanel.jsx`, `components/puzzle/WorkspaceHeader.jsx` |

### 14.6 `tutorial/`

| Path | Responsibility | Key exports / symbols | Depended on by |
|---|---|---|---|
| [`frontend/src/components/tutorial/useTutorialProgress.js`](../../frontend/src/components/tutorial/useTutorialProgress.js) | The tutorial step state machine: stage step lists, current index, welcome-modal state, the auto-advance effect and the manual action handler. Reads `content/tutorialContent.js` for its copy. | `useTutorialProgress` | `components/InteractiveTutorial.jsx` |
| [`frontend/src/components/tutorial/useSpotlightRects.js`](../../frontend/src/components/tutorial/useSpotlightRects.js) | Tracks the rectangles the spotlight highlights — the active equation, the current target and its optional secondary target — refreshed on resize/scroll and on the poll interval from `gameRules.TIMING.spotlightRectPollMs`. | `useSpotlightRects` | `components/InteractiveTutorial.jsx` |
| [`frontend/src/components/tutorial/useCoachCardPlacement.js`](../../frontend/src/components/tutorial/useCoachCardPlacement.js) | Owns the coach card's measured placement: its DOM ref, the post-commit placement pass, and the resize/orientation/scroll/interval reflow. | `useCoachCardPlacement` | `components/InteractiveTutorial.jsx` |
| [`frontend/src/components/tutorial/coachCardPlacement.js`](../../frontend/src/components/tutorial/coachCardPlacement.js) | The pure placement decision: given the card's natural size, the highlighted targets, every on-screen control and the step's declared placement, pick the rectangle that covers as little as possible. | `pickCoachPlacement` | `components/tutorial/useCoachCardPlacement.js` |
| [`frontend/src/components/tutorial/coachCardGeometry.js`](../../frontend/src/components/tutorial/coachCardGeometry.js) | Pure geometry primitives: card size constants, rect overlap/union math, obstacle collection and free-span scans. No React, no state. | `CARD_EDGE_MARGIN`, `CARD_OBSTACLE_GAP`, `CARD_USABLE_HEIGHT`, `CARD_MIN_WIDTH`, `CARD_NATURAL_WIDTH`, `rectOverlapArea`, `unionRect`, `clampToViewport`, `collectCardObstacles`, `cardSideRect`, `cardFreeExtent`, `cardFreeBands` | `components/tutorial/coachCardPlacement.js`, `components/tutorial/useCoachCardPlacement.js` |
| [`frontend/src/components/tutorial/spotlightRects.js`](../../frontend/src/components/tutorial/spotlightRects.js) | Pure builders for the spotlight rectangles (teal ring + backdrop cutout) for the equation, target, score-modal fallback and secondary target, plus the rect comparison that skips redundant writes. | `cutoutRectOf`, `isSameRect`, `buildEquationHighlight`, `buildTargetHighlight`, `buildScoreModalFallbackHighlight`, `buildSecondaryHighlight` | `components/tutorial/useCoachCardPlacement.js`, `components/tutorial/useSpotlightRects.js` |
| [`frontend/src/components/tutorial/tutorialTargets.js`](../../frontend/src/components/tutorial/tutorialTargets.js) | **Owns every `[data-tutorial=...]` obstacle selector** the coach card must dodge and the named anchor zones. The shared vocabulary between the app and the e2e overlap suites. | `TUTORIAL_OBSTACLE_SELECTORS`, `CARD_OBSTACLE_SELECTOR`, `CARD_ANCHOR_ZONES` | `.e2e/tutorial-overlap-verify.mjs`, `components/tutorial/coachCardGeometry.js`, `components/tutorial/useCoachCardPlacement.js` |
| [`frontend/src/components/tutorial/coachCardFallbackStyle.js`](../../frontend/src/components/tutorial/coachCardFallbackStyle.js) | Pre-measurement fallback styling for the coach card: declarative coordinates and target-relative offsets, overwritten by the measured pass before first paint. | `getTooltipStyle` | `components/tutorial/CoachCard.jsx` |
| [`frontend/src/components/tutorial/CoachCard.jsx`](../../frontend/src/components/tutorial/CoachCard.jsx) | The floating coach tooltip: step counter, dead-end-aware title/description, exit control and the manual action button. | `default` component | `components/InteractiveTutorial.jsx` |
| [`frontend/src/components/tutorial/Spotlight.jsx`](../../frontend/src/components/tutorial/Spotlight.jsx) | The in-situ spotlight: masked backdrop cutout, click blockers outside the hole, primary/secondary rings. | `default` component | `components/InteractiveTutorial.jsx` |
| [`frontend/src/components/tutorial/WelcomeModal.jsx`](../../frontend/src/components/tutorial/WelcomeModal.jsx) | The two-slide cinematic welcome modal; copy comes from `WELCOME_SLIDES`. | `default` component | `components/InteractiveTutorial.jsx` |
| [`frontend/src/components/tutorial/TutorialReplayModal.jsx`](../../frontend/src/components/tutorial/TutorialReplayModal.jsx) | The tutorial-replay confirmation dialog shared by the level screens. Presentational — `shift` is the nudge published by `usePopupPlacement`. | `default` component | `components/layout/PageOverlays.jsx` |

### 14.7 `ui/`

| Path | Responsibility | Key exports / symbols | Depended on by |
|---|---|---|---|
| [`frontend/src/components/ui/AuthCard.jsx`](../../frontend/src/components/ui/AuthCard.jsx) | The auth page shell: logo link, heading, subtitle, back link, white card. `children` is the form, `footer` the alternate-action slot. | `default` component | `pages/LoginPage.jsx`, `pages/RegisterPage.jsx` |
| [`frontend/src/components/ui/authInputStyles.js`](../../frontend/src/components/ui/authInputStyles.js) | Shared auth-input classes, kept out of the component files so React Fast Refresh stays happy. | `authInputClassName` | `components/ui/AuthTextField.jsx`, `components/ui/PasswordField.jsx` |
| [`frontend/src/components/ui/AuthTextField.jsx`](../../frontend/src/components/ui/AuthTextField.jsx) | Label + input for the auth forms; `borderClassName` replaces the default border so the register page can show its invalid state. | `default` component | `pages/LoginPage.jsx`, `pages/RegisterPage.jsx` |
| [`frontend/src/components/ui/PasswordField.jsx`](../../frontend/src/components/ui/PasswordField.jsx) | Password input with a show/hide toggle; owns only the reveal boolean. | `default` component | `pages/LoginPage.jsx`, `pages/RegisterPage.jsx` |
| [`frontend/src/components/ui/SubmitButton.jsx`](../../frontend/src/components/ui/SubmitButton.jsx) | The full-width auth submit button: spinner + `busyLabel` while loading. | `default` component | `pages/LoginPage.jsx`, `pages/RegisterPage.jsx` |
| [`frontend/src/components/ui/LoadingSpinner.jsx`](../../frontend/src/components/ui/LoadingSpinner.jsx) | The accent loading spinner; `size` takes Tailwind size classes. | `default` component | `pages/ProblemPage.jsx`, `pages/StageSelectorPage.jsx` |
| [`frontend/src/components/ui/PointsChip.jsx`](../../frontend/src/components/ui/PointsChip.jsx) | The points/streak readout, with two deliberate skins: the `xp-bar` footer pair of pills and the single amber `header` pill. | `default` component | `pages/LevelSelectPage.jsx`, `pages/StageSelectorPage.jsx` |
| [`frontend/src/components/ui/StarRating.jsx`](../../frontend/src/components/ui/StarRating.jsx) | The read-only 3-star display, one star per earned point. Presentational only. | `default` component | `pages/StageSelectorPage.jsx` |
| [`frontend/src/components/ui/ScoreGateBar.jsx`](../../frontend/src/components/ui/ScoreGateBar.jsx) | The score progress bar with the **unlock-threshold notch** drawn at `UNLOCK_AVERAGE_SCORE` %, and ramp colours keyed to `SCORE_RAMP`. | `default` component | `pages/LevelSelectPage.jsx`, `pages/StageSelectorPage.jsx` |
| [`frontend/src/components/ui/SurveyBillboard.jsx`](../../frontend/src/components/ui/SurveyBillboard.jsx) | The high-visibility feedback banner, linking straight to `SURVEY_URL`. | `default` component | `pages/LevelSelectPage.jsx`, `pages/StageSelectorPage.jsx` |
| [`frontend/src/components/ui/SoundToggle.jsx`](../../frontend/src/components/ui/SoundToggle.jsx) | The speaker on/off control for the header rails. Presentational: renders the preference it is handed and reports the click. | `default` component | `components/puzzle/WorkspaceHeader.jsx`, `pages/LandingPage.jsx`, `pages/LevelSelectPage.jsx` |

---

## 15. `frontend/src/config/`

**Every tunable number in the frontend lives here.** These three modules are imported by **24** other
frontend files (23 excluding test files), including 6 engine modules.

| Path | Responsibility | Key exports / symbols | Depended on by |
|---|---|---|---|
| [`frontend/src/config/gameRules.js`](../../frontend/src/config/gameRules.js) | The game-rule constants, explicitly the client mirror of `backend/config/constants.py`: `SCORE_WEIGHTS` 40/30/30, `SCORE_PENALTY` 10/10, `SCORE_BONUS_MAX_POINTS` 5, `STAGE_COMPLETION_XP` 10, `GUIDE_COST_POINTS` 20, `STAR_THRESHOLDS` `{three:90, two:75, one:1}`, `MAX_STARS_PER_STAGE` 3, `UNLOCK_AVERAGE_SCORE` 80, `SCORE_RAMP` `{good:80, fair:50}`, `TIMING` (11 values, incl. `lawAnimationMs` 1350 and `preLawHighlightMs` 1500), `TUTORIAL` `{levelId: 0, stageIndexes: [0,1,2,3]}`, `DRAG`, `SANDBOX` (variable ceiling + measured search budgets), `SOUND`, `SOLVER_BUDGET`. | 16 named exports | **21 modules** (20 excluding tests), incl. `engine/solver.js`, `engine/scoring.js`, `engine/sandbox/*`, `state/progressStore.js`, `state/useGameState.js`, `services/soundEffects.js`, 5 pages, 4 components/hooks, `engine/__tests__/sandbox.test.js`. A 22nd file, `engine/index.js`, only *mentions* the path in a comment at `:10` |
| [`frontend/src/config/storageKeys.js`](../../frontend/src/config/storageKeys.js) | Every browser storage key the app uses. "Changing a key here changes it everywhere; never inline a key at a call site." | `progressKey`, `PROGRESS_KEY_PREFIX`, `SKIP_TUTORIAL_REPLAY_PROMPT`, `SKIP_RESET_CONFIRM`, `CUSTOM_SANDBOX_PUZZLE`, `HIDE_ROTATE_BANNER`, `SOUND_ENABLED` | `.e2e/_harness.mjs`, `components/puzzle/sandboxPuzzle.js`, `hooks/useDeviceTier.js`, `hooks/useTutorialReplay.js`, `pages/ProblemPage.jsx`, `services/soundEffects.js`, `state/progressStore.js` |
| [`frontend/src/config/appLinks.js`](../../frontend/src/config/appLinks.js) | Outbound links in one place — "a URL never belongs inline at a call site". | `SURVEY_URL` | `components/layout/SurveyButton.jsx`, `components/ui/SurveyBillboard.jsx` |

> **Note the overlap by design.** `SCORE_WEIGHTS`/`SCORE_PENALTY` in the frontend and
> `EFFICIENCY_WEIGHT`/`TARGET_LAW_WEIGHT`/`HINT_INDEPENDENCE_WEIGHT` in the backend are two copies
> of the same contract — the backend is authoritative, the frontend only mirrors it for an instant
> offline estimate. Changing a weight means changing both files.

---

## 16. `frontend/src/content/`

| Path | Responsibility | Key exports / symbols | Depended on by |
|---|---|---|---|
| [`frontend/src/content/gameContent.js`](../../frontend/src/content/gameContent.js) | The frontend's reader for the shared JSON. Imports `@content/laws.json` and `@content/levels.json` (the Vite alias to `<repo>/content`), so the bundled copy and the API response are byte-identical. Its own rule: "Nothing here may hardcode a law or a puzzle: add it to the JSON." | `LAWS`, `LEVELS`, `LEVEL_SUMMARIES`, `getLevel` | `services/contentApi.js` |
| [`frontend/src/content/tutorialContent.js`](../../frontend/src/content/tutorialContent.js) | The interactive tutorial's own curated content: the welcome-modal slide sequence and the per-stage guided step lists. This is **not** in `content/*.json` — the tutorial's expressions are authored here. | `WELCOME_SLIDES`, `TUTORIAL_STAGES` | `.e2e/tutorial-overlap-verify.mjs`, `components/tutorial/WelcomeModal.jsx`, `components/tutorial/useTutorialProgress.js` |

---

## 17. `frontend/src/hooks/`

**8 UI hooks.** Layout/measurement/device concerns shared by the screens. (Several components also
carry their own `use*.js` next to them — those are listed with their component in §14.)

| Path | Responsibility | Key exports / symbols | Depended on by |
|---|---|---|---|
| [`frontend/src/hooks/useDeviceTier.js`](../../frontend/src/hooks/useDeviceTier.js) | Device class + orientation detection. **No User-Agent sniffing**: touch comes from `(pointer: coarse)` / `maxTouchPoints` / `ontouchstart`, and the class comes from the width of a touch device. `detectDeviceTier` is a pure function so it can be tested without a DOM. | `DEVICE_TIERS`, `ROTATE_BANNER_STORAGE_KEY`, `PHONE_MAX_WIDTH`, `SMALL_TABLET_MAX_WIDTH`, `detectDeviceTier`, `default` hook | `components/OrientationGate.jsx`, `pages/ProblemPage.jsx` |
| [`frontend/src/hooks/useCollisionPlacement.js`](../../frontend/src/hooks/useCollisionPlacement.js) | **The collision-aware popup layer of the workspace**: measure the anchor and the popup, try candidate sides in priority order, keep the first that overlaps nothing the learner still needs, otherwise clamp into the largest free gap, and recompute on resize/orbit/scroll. | `CANVAS_SELECTOR`, `POPUP_MARGIN`, `POPUP_GAP`, `clampNum`, `viewportBox`, `popupLayerStyle`, `INSPECT_POPUP_CANDIDATES`, `HINT_POPUP_CANDIDATES`, `default` hook | `hooks/useBandedOverlay.js`, `pages/ProblemPage.jsx` |
| [`frontend/src/hooks/useBandedOverlay.js`](../../frontend/src/hooks/useBandedOverlay.js) | Places a panel in the free vertical band below the control that opened it (so the laws drawer never hides the header rail that opens it). | `default` hook | `pages/ProblemPage.jsx` |
| [`frontend/src/hooks/usePopupPlacement.js`](../../frontend/src/hooks/usePopupPlacement.js) | Measures the free band below an anchor (for the law drawer) and the vertical nudge that keeps a centred dialog clear of it. | `usePopupPlacement` | `hooks/usePageOverlays.js` |
| [`frontend/src/hooks/usePageOverlays.js`](../../frontend/src/hooks/usePageOverlays.js) | The overlay state shared by the level screens: the tutorial-replay prompt, the laws drawer and the anchor both are measured against. | `usePageOverlays` | `pages/LevelSelectPage.jsx`, `pages/StageSelectorPage.jsx` |
| [`frontend/src/hooks/useTutorialReplay.js`](../../frontend/src/hooks/useTutorialReplay.js) | The replay-prompt state: ask before resetting level 0, remember "don't ask again" for the session, then reset that level and open the walkthrough at the very first stage. | `useTutorialReplay` | `hooks/usePageOverlays.js` |
| [`frontend/src/hooks/useTermDrag.js`](../../frontend/src/hooks/useTermDrag.js) | **The one pointer-event drag implementation** behind the reorderable term/factor capsules. Pointer events, not HTML5 drag-and-drop, because `draggable` never fires on touch. Exposes a frozen contract consumed by `ExpressionDisplay`. | `DRAG_THRESHOLD_PX`, `default` hook | `components/ExpressionDisplay.jsx` |
| [`frontend/src/hooks/useSoundEnabled.js`](../../frontend/src/hooks/useSoundEnabled.js) | The preference half of the sound feature: read the stored value, flip it, and prime the AudioContext on the click that turns sound on. | `default` hook | `pages/LandingPage.jsx`, `pages/LevelSelectPage.jsx`, `pages/ProblemPage.jsx` |

---

## 18. `frontend/src/styles/`

**Import order in `main.jsx` is load-bearing** and repeated in `styles/index.css`.

| Path | Responsibility | Key exports / symbols | Depended on by |
|---|---|---|---|
| [`frontend/src/styles/index.css`](../../frontend/src/styles/index.css) | The Tailwind entry, imported **first**: `@tailwind base/components/utilities` plus the layer order note. | Tailwind layers | `main.jsx` |
| [`frontend/src/styles/tokens.css`](../../frontend/src/styles/tokens.css) | Design tokens + base element styles. `tailwind.config.js` is the source of truth for anything reached by class name; the custom properties here exist for the few inline styles that cannot use a class (rotate banner/overlay chrome). Deliberately not wrapped in `@layer base`. | CSS custom properties | `main.jsx` |
| [`frontend/src/styles/utilities.css`](../../frontend/src/styles/utilities.css) | The shared `praxis-*` class contract every screen uses so popups, sheets and chip rails behave the same on phones, short-landscape phones and tablets; ends with the sonner toast overrides. | `.praxis-*` classes | `main.jsx` |
| [`frontend/src/styles/orientation.css`](../../frontend/src/styles/orientation.css) | The orientation-gate styles, owned by `OrientationGate` / `RotateOverlay` / `RotateBanner`. | keyframes + scoped body state | `main.jsx` |
| [`frontend/src/styles/animations.css`](../../frontend/src/styles/animations.css) | The law-animation keyframes. Owned by `components/animations/*`, which set the per-animation custom properties these consume — "keyframes and the JSX that drives them must move together". | `@keyframes` incl. `guidePulse` | `main.jsx` |

---

## 19. `frontend/src/assets/` and `frontend/public/`

| Path | Responsibility | Key exports / symbols | Depended on by |
|---|---|---|---|
| [`frontend/src/assets/logo-full.png`](../../frontend/src/assets/logo-full.png) 🖼 | The full Praxis wordmark, imported as a module URL so Vite hashes it into the bundle. Binary; 81 KB. | — | `components/layout/BackNav.jsx`, `components/tutorial/WelcomeModal.jsx`, `components/ui/AuthCard.jsx`, `pages/LandingPage.jsx` |
| [`frontend/public/favicon.svg`](../../frontend/public/favicon.svg) 🖼 | The site icon, served verbatim at `/favicon.svg` and linked from `index.html`. Binary/vector asset; 9.5 KB. | — | `frontend/index.html` |

---

## 20. `docs/` tracked inputs

Five markdown files predate this suite and are tracked. They are **historical inputs**, not the
current documentation. `docs/context.md` in particular is a *proposal* written before most of the
application existed and is contradicted by the code in many places.

| Path | Responsibility | Key exports / symbols | Depended on by |
|---|---|---|---|
| [`docs/context.md`](../../docs/context.md) | The original product proposal and setup notes. Stale: it states Supabase is not integrated, that there is no auth, that landing/login/register pages are missing, that there are 3 levels with 6 puzzles each, and that Level 3 is unplayable. Kept as an historical input. | prose | `README.md`, `docs/ARCHITECTURE.md` |
| [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md) | A pre-suite folder map and data-flow note. Partially superseded by this file. | prose | `README.md`, `frontend/README.md` |
| [`docs/REFACTOR_REPORT.md`](../../docs/REFACTOR_REPORT.md) | The refactor's before/after, deletions and verification notes. Input to the architecture notes in the new suite. | prose | `README.md` |
| [`docs/SKILLS.md`](../../docs/SKILLS.md) | Engineering skills demonstrated plus common recipes; onboarding-adjacent prose. | prose | `README.md` |
| [`docs/Software Proposal Writing Guide (LAWS) v2.0.docx.md`](../../docs/Software%20Proposal%20Writing%20Guide%20%28LAWS%29%20v2.0.docx.md) | The original assignment's proposal-writing guide. Context for *why* the project brief reads the way it does. | prose | `README.md` |

> The rest of this documentation suite (`docs/README.md`, `01-product/` … `09-diagrams/`,
> `rules/`, `verification-report.md`) was written during the documentation pass and was **untracked
> at the time this map was generated**. It is intentionally not enumerated here: this map is an
> index of the *codebase*, and `docs/README.md` is the index of the docs.

---

## 21. Reverse lookups: "I want to change X"

| I want to change… | Open these files | Why |
|---|---|---|
| **The scoring weights** (40/30/30) | [`backend/config/constants.py`](../../backend/config/constants.py), [`frontend/src/config/gameRules.js`](../../frontend/src/config/gameRules.js) | Two copies of one contract. The backend is authoritative; the frontend mirrors it. |
| **The step penalty, assistance penalty, bonus points or rounding** | [`backend/config/constants.py`](../../backend/config/constants.py), [`backend/services/scoring_service.py`](../../backend/services/scoring_service.py), [`frontend/src/engine/scoring.js`](../../frontend/src/engine/scoring.js) | Constants live in one file; the two implementations that consume them are the backend service and the client mirror. |
| **The star thresholds or the unlock average** | [`frontend/src/config/gameRules.js`](../../frontend/src/config/gameRules.js) (`STAR_THRESHOLDS`, `UNLOCK_AVERAGE_SCORE`), then [`frontend/src/state/progressStore.js`](../../frontend/src/state/progressStore.js) (`starsForScore`, `getLevelProgress`), [`frontend/src/pages/StageSelectorPage.jsx`](../../frontend/src/pages/StageSelectorPage.jsx), [`backend/config/constants.py`](../../backend/config/constants.py) | The UI computes stars and unlocks; the backend constant exists to keep the contract explicit. |
| **A law's behaviour** | [`frontend/src/engine/laws/definitions.js`](../../frontend/src/engine/laws/definitions.js) first (identity), then the matching arm: [`sumLaws.js`](../../frontend/src/engine/laws/sumLaws.js), [`productLaws.js`](../../frontend/src/engine/laws/productLaws.js), [`notLaws.js`](../../frontend/src/engine/laws/notLaws.js), [`constLaws.js`](../../frontend/src/engine/laws/constLaws.js) | Definitions are the join key; the arms implement the rewrite. |
| **A law's card text or formula** | [`content/laws.json`](../../content/laws.json) | The single source for the reference cards, read by both the API and the SPA. |
| **A law's animation** | [`frontend/src/components/animations/index.js`](../../frontend/src/components/animations/index.js), the specific `*Animation.jsx`, and [`frontend/src/styles/animations.css`](../../frontend/src/styles/animations.css) | Registry → component → keyframes must move together. |
| **An existing puzzle, or a new one** | [`content/levels.json`](../../content/levels.json), then [`content/laws.json`](../../content/laws.json) for valid `targetLaws` ids | The puzzle's keys are a frozen set and its law ids must exist. |
| **A level's name, description or variable count** | [`content/levels.json`](../../content/levels.json) | `varCount` is served verbatim by `GET /api/levels`. |
| **The tutorial's steps or welcome copy** | [`frontend/src/content/tutorialContent.js`](../../frontend/src/content/tutorialContent.js) | Tutorial content is deliberately *not* in `content/*.json`. |
| **Which routes exist, or which are gated** | [`frontend/src/App.jsx`](../../frontend/src/App.jsx) | The single route table. |
| **The tutorial gate's behaviour** | [`frontend/src/components/TutorialGate.jsx`](../../frontend/src/components/TutorialGate.jsx) | It owns the redirect target and the `progressHydrated` wait. |
| **The orientation/device policy** | [`frontend/src/hooks/useDeviceTier.js`](../../frontend/src/hooks/useDeviceTier.js), [`frontend/src/components/OrientationGate.jsx`](../../frontend/src/components/OrientationGate.jsx) | Detection is a pure function; the policy is the gate. |
| **Animation or interaction timing** | [`frontend/src/config/gameRules.js`](../../frontend/src/config/gameRules.js) (`TIMING`, `DRAG`) | 11 named timings in one object. |
| **The sandbox's variable ceiling or search budget** | [`frontend/src/config/gameRules.js`](../../frontend/src/config/gameRules.js) (`SANDBOX`) | One number owns the ceiling; the engine takes the budget per call. |
| **Sound cues** | [`frontend/src/config/gameRules.js`](../../frontend/src/config/gameRules.js) (`SOUND`), [`frontend/src/services/soundEffects.js`](../../frontend/src/services/soundEffects.js) | Data here, synthesis there. |
| **An API endpoint's path, request or response** | [`backend/api/routes/`](../../backend/api/routes/), [`backend/api/schemas/`](../../backend/api/schemas/) | Routes are thin; schemas are the frozen field contract. |
| **The response envelope or an error code** | [`backend/core/responses.py`](../../backend/core/responses.py), [`backend/core/errors.py`](../../backend/core/errors.py) | One envelope, seven codes. |
| **Auth behaviour, or how a bearer token is checked** | [`backend/core/security.py`](../../backend/core/security.py), [`frontend/src/services/supabaseClient.js`](../../frontend/src/services/supabaseClient.js), [`frontend/src/services/authActions.js`](../../frontend/src/services/authActions.js) | Dependency on the backend, client on the frontend. |
| **CORS origins** | [`backend/config/settings.py`](../../backend/config/settings.py) (`DEFAULT_CORS_ORIGINS`, `build_cors_origins`) | Defaults plus `FRONTEND_URL`. |
| **A database table, column, index or RLS policy** | [`database/init.sql`](../../database/init.sql), then [`backend/repositories/progress_repository.py`](../../backend/repositories/progress_repository.py) for the queries, [`backend/api/schemas/progress.py`](../../backend/api/schemas/progress.py) for the wire shape | DDL → repository → transport. |
| **How progress is merged or persisted** | [`backend/services/progress_service.py`](../../backend/services/progress_service.py), [`frontend/src/state/progressStore.js`](../../frontend/src/state/progressStore.js), [`frontend/src/services/progressApi.js`](../../frontend/src/services/progressApi.js) | Server merge, client store, client transport. |
| **The dev-server proxy or the `@content` alias** | [`frontend/vite.config.js`](../../frontend/vite.config.js) | Proxy order matters: `/api/auth` is matched before `/api`. |
| **The colour palette, radii, shadows or fonts** | [`frontend/tailwind.config.js`](../../frontend/tailwind.config.js), [`frontend/src/styles/tokens.css`](../../frontend/src/styles/tokens.css) | Class-reachable values in the config; inline-only values in the CSS. |
| **The deployment topology** | [`render.yaml`](../../render.yaml), [`frontend/vercel.json`](../../frontend/vercel.json) | Backend on Render, SPA on Vercel with `/api` rewritten to Render. |
| **A browser storage key** | [`frontend/src/config/storageKeys.js`](../../frontend/src/config/storageKeys.js) | Never inline a key at a call site. |
| **A test** | [`frontend/src/engine/__tests__/`](../../frontend/src/engine/__tests__/) (`npm test`) or [`.e2e/`](../../.e2e/) (`bash .e2e/run-all-suites.sh`) | Engine unit tests vs browser/node end-to-end suites. |

---

## 22. What is excluded, and why

| Excluded | Why | Evidence it is not source |
|---|---|---|
| `frontend/package-lock.json` | Generated dependency lockfile; the only tracked path the inventory filter removes. | It is the sole difference between 212 raw tracked paths and the 211 documented here. |
| `frontend/node_modules/` | Installed dependencies. | Ignored by `frontend/.gitignore:10`; not in the git index. |
| `frontend/dist/` | Build output. | Ignored by `frontend/.gitignore:11` and listed in `frontend/eslint.config.js:8` as a global ignore. |
| `backend/venv/` | Installed Python environment (it exists on disk here and contains 887 `.py` files that are **not** part of the project — counting them inflates "backend Python" from 28 to 915 modules). | Ignored by `.gitignore:2`; not in the git index. |
| `backend/__pycache__/`, `**/__pycache__/` | Compiled bytecode. | Ignored by `.gitignore:1`. |
| `backend/.env`, `frontend/.env.local` | Local secrets. Both exist on this machine and **neither is tracked**. | `.gitignore:3` and `frontend/.gitignore:12-13`; confirmed absent from `git ls-files`. |
| `.e2e/_results/`, `.e2e/shots-mobile/`, `.e2e/*.png` | Regenerable test artifacts. | `.gitignore:17-20`. |
| `.idea/`, `.vscode/`, `.DS_Store` | Editor/OS noise. | `.gitignore:13-15`, `.gitignore:24`. |
| `docs/_staging/` | The documentation team's working area (ground truth, claim ledgers, tools). Not product source. | Untracked at the time of writing; excluded from this map by scope, not by the filter. |
| `docs/README.md` and `docs/01-product/` … `docs/09-diagrams/`, `docs/rules/` | The documentation suite itself, written in parallel with this map and untracked when it was generated. | `git status --porcelain` reports `?? docs/README.md`, `?? docs/04-api/`. |

> **Binary assets are included, not excluded.** `frontend/src/assets/logo-full.png` and
> `frontend/public/favicon.svg` are tracked source assets that the app imports or serves, so they
> are listed in §19 with a 🖼 marker rather than dropped.

---

**Related:** [glossary.md](glossary.md) for every term used above ·
[changelog.md](changelog.md) for how this map is kept current ·
[RULES.md](../rules/RULES.md) for the layering and naming rules this map illustrates.
