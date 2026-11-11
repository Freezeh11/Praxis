# Claim ledger — devops-ops (task-4)

Every substantive factual claim in the nine DevOps/guides documents, with its evidence and how it was
verified. `read` means I read the cited source; `ran` means I executed the command and observed the
result. Placeholders are used for all credentials — no real value from `backend/.env`,
`frontend/.env.local` or `docs/context.md` §11 appears anywhere in this work.

Commit under test: `3838343`. Environment used for the executed checks: Node v22.23.1, npm 10.9.8,
Python 3.14.7, fastapi 0.141.1, uvicorn 0.52.4, httpx 0.28.1, python-dotenv 1.2.3.

---

## 1. Deployment topology

| Claim | Doc + section | Evidence (file:line) | How verified |
|---|---|---|---|
| `render.yaml` defines exactly **one** web service, named `praxis-backend` | deployment.md §2 | `render.yaml:1-8` | read |
| That service is `env: python`, `plan: free`, `rootDir: backend` | deployment.md §2 | `render.yaml:4-5`, `render.yaml:8` | read |
| Build command is `pip install -r requirements.txt`, run inside `rootDir` (i.e. the backend list) | deployment.md §2 | `render.yaml:6`, `backend/requirements.txt:1-5` | read |
| Start command is `uvicorn main:app --host 0.0.0.0 --port $PORT` | deployment.md §2, installation-manual.md §4.1 | `render.yaml:7` | read |
| `FRONTEND_URL` is a committed literal `https://praxis-seven-puce.vercel.app` | deployment.md §2 | `render.yaml:10-11` | read |
| `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` use `sync: false` (dashboard-supplied, not in git) | deployment.md §2-§3 | `render.yaml:12-15` | read |
| `render.yaml` declares **no** `healthCheckPath` | deployment.md §2, monitoring.md §2.2 | `render.yaml:1-16` (whole file read; no such key) | read |
| The frontend is **not** in `render.yaml`; it is deployed to Vercel | deployment.md §1, §5 | `render.yaml:1-16`, `frontend/vercel.json:1-12`, `render.yaml:11` | read |
| `frontend/vercel.json` rewrites `/api/(.*)` to `https://praxis-backend-5302.onrender.com/api/$1` | deployment.md §5.1 | `frontend/vercel.json:3-6` | read |
| `frontend/vercel.json` rewrites everything else to `/index.html` (SPA fallback) | deployment.md §5.1 | `frontend/vercel.json:7-10` | read |
| Production backend is live and answers `GET /` with the plain payload | deployment.md §6, monitoring.md §2 | measured | ran `curl https://praxis-backend-5302.onrender.com/` → `200` + `{"message":"Praxis API is running","docs":"/docs"}` |
| The live Vercel SPA is serving the app shell | deployment.md §6 | measured | ran `curl https://praxis-seven-puce.vercel.app/` → `200`, HTML containing `<title>Praxis — Interactive Boolean Simplifier</title>` |
| First request after idle took 22.08 s (free-plan cold start) | deployment.md §6.2, runbooks.md RB-09 | measured | ran `curl -w '%{time_total}'` → `200 22.080381s`; `plan: free` at `render.yaml:5` |
| The deployed backend returns **pre-envelope** bodies: bare array for `/api/levels`, `{"detail":…}` for `/api/progress` | deployment.md §8 | measured | ran `curl` against the Render host and against a local `uvicorn`; local returned `{"success":true,…}`, remote returned `[…` / `{"detail":"Not authenticated"}` |
| Route list is identical local and remote, so production is behind — not ancient | deployment.md §8 | measured | compared `/openapi.json` `paths` on both: 7 entries each |
| Local `GET /` returns `x-request-id` and the exact 50-byte body | installation-manual.md §4.2 | `backend/core/middleware.py:61`, `backend/api/routes/health.py:15-18` | ran `curl -i http://127.0.0.1:8000/` |

## 2. Environment and configuration

| Claim | Doc + section | Evidence (file:line) | How verified |
|---|---|---|---|
| `settings = Settings.from_env()` is a **module-level singleton** built at import time | installation-manual.md §2.1, configuration-guide.md §3.1 | `backend/config/settings.py:74-75` | read |
| `Settings.from_env` calls `require_env` for `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`, and `os.getenv` for `FRONTEND_URL` | configuration-guide.md §3.1-§3.3 | `backend/config/settings.py:56-63` | read |
| `require_env` raises `RuntimeError` naming the missing variable | configuration-guide.md §3.1 | `backend/config/settings.py:30-38` | read |
| Without `backend/.env` the app **cannot import**: `RuntimeError: Missing required environment variable: SUPABASE_URL` | installation-manual.md §2.1 | `backend/config/settings.py:75` | ran: copied `backend/` without `.env` into a temp dir and executed `python -c "import main"` → reproduced the traceback |
| Because of that, even `GET /api/levels` fails without credentials | installation-manual.md §2.1 | `backend/supabase_client.py:12` imports the singleton; `backend/main.py:15-16` | read + the run above |
| `backend/.env` is loaded first by absolute path, then a cwd-relative `.env`, with `override=False` (real env vars win) | configuration-guide.md §2.1 | `backend/config/settings.py:14-20` | read |
| Default CORS origins are `localhost:5173`, `127.0.0.1:5173`, `localhost:3001` | configuration-guide.md §3.3 | `backend/config/settings.py:23-27` | read |
| `FRONTEND_URL` is appended only when not already present (de-duplicated) | installation-manual.md Stage 2, configuration-guide.md §3.3 | `backend/config/settings.py:66-71` | read |
| Live CORS response header for `Origin: http://localhost:5173` | configuration-guide.md §8.1, runbooks.md RB-02 | measured | ran `curl -D -` against the local server → `access-control-allow-origin: http://localhost:5173` |
| `backend/.env` sets `FRONTEND_URL=http://localhost:5173/` **with a trailing slash**, so `settings.cors_origins` builds four entries and the last never matches the browser's origin | installation-manual.md Stage 2, configuration-guide.md §3.3 | `backend/config/settings.py:66-71`; the observed value is a localhost dev URL, not a secret | ran `python3 -c "from config.settings import settings; print('origins:', settings.cors_origins)"` from `backend/` → 4 entries, last `'http://localhost:5173/'` |
| Root `requirements.txt` is a one-line shim `-r backend/requirements.txt` | installation-manual.md §3.2 | `requirements.txt:6` | read |
| `backend/requirements.txt` has five entries and **no version pins** | installation-manual.md §3.2, runbooks.md RB-07, deployment.md §4.3 | `backend/requirements.txt:1-5` | read |
| Resolved dependencies require Python ≥ 3.10 | installation-manual.md §2.1 | `importlib.metadata` `Requires-Python`: fastapi 0.141.1 `>=3.10`, uvicorn 0.52.4 `>=3.10`, starlette 1.6.0 `>=3.10`, python-dotenv 1.2.3 `>=3.10` | ran |
| Vite 8 / plugin-react 6 require Node `^20.19.0 \|\| >=22.12.0`; eslint 10 requires `^20.19.0 \|\| ^22.13.0 \|\| >=24` | installation-manual.md §2.1 | installed `package.json` `engines` fields under `frontend/node_modules`; lockfile versions (`vite 8.2.2`, `eslint 10.4.0`) | ran |
| `frontend/.env.local` holds `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_AUTH_URL` | installation-manual.md Stage 5 | file present; keys read with values redacted | ran (names only; values never printed) |
| `backend/.env` holds `FRONTEND_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | installation-manual.md Stage 2 | file present; keys read with values redacted | ran (names only) |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` are read in `supabaseClient.js` | configuration-guide.md §4 | `frontend/src/services/supabaseClient.js:7-8` | read |
| `VITE_AUTH_URL` is referenced by **no** code | configuration-guide.md §4.3, §9 | grep over `frontend/src` → 0 matches | ran |
| `VITE_API_TARGET` is read from `process.env` (default `http://127.0.0.1:8000`) | configuration-guide.md §2.2, §5.1 | `frontend/vite.config.js:8` | read |
| `.env` file contents do **not** reach `process.env` for the Vite config; a shell variable does | configuration-guide.md §2.2 | — | ran an isolated Vite build with a `.env.local` containing `VITE_API_TARGET` (config logged `undefined`) and with the value exported in the shell (config logged `"http://from-shell:8001"`) |
| `frontend/.env.local` uses `.env.local` precedence over `.env` | installation-manual.md Stage 5 | `frontend/README.md:14`-style Vite conventions; the existing file is `.env.local` | read |
| `@content` aliases `<repo>/content`, and `server.fs.allow` is widened to the repo root | installation-manual.md §6.3, deployment.md §5.2 | `frontend/vite.config.js:16`, `:22` | read |
| `/api` is proxied to `VITE_API_TARGET` | installation-manual.md §6.3 | `frontend/vite.config.js:30-33` | read |
| `/api/auth` is proxied to port 3001 labelled "Better Auth server", before `/api` | installation-manual.md §1, §6.3, configuration-guide.md §9 | `frontend/vite.config.js:24-28` | read |
| Nothing listens on port 3001 (dead proxy) | same | measured | ran a listening-port check → only 8000, 5173, 3080 are bound |
| There is no `auth-server/` directory, yet `.gitignore` still ignores `auth-server/node_modules/` | configuration-guide.md §9 | `.gitignore:4`; directory absent | read + ran `ls` |
| `database/init.sql:4` claims Better Auth tables are created by `npx auth migrate` — no such step exists | installation-manual.md §1, configuration-guide.md §9 | `database/init.sql:4`; no auth-server code anywhere | read |
| `backend/.env` is ignored by root `.gitignore:3`; `frontend/.env.local` by `frontend/.gitignore:15`; `git ls-files` lists no env file | installation-manual.md §1.3, §14, configuration-guide.md §7 | `.gitignore:3`, `frontend/.gitignore:15` | ran `git ls-files | grep -i env` → empty |

## 3. API behaviour and error semantics

| Claim | Doc + section | Evidence (file:line) | How verified |
|---|---|---|---|
| `GET /` returns `{"message":"Praxis API is running","docs":"/docs"}`, outside the envelope | monitoring.md §2, installation-manual.md §4.2 | `backend/api/routes/health.py:15-18`, docstring `:1-3` | ran (local `curl` → `200`, exact body) |
| There are exactly 7 application routes | deployment.md §8 | measured `/openapi.json` on the local server | ran |
| Every `/api/*` response uses the `{success,data,error}` envelope | runbooks.md RB-10, monitoring.md §2.1 | `backend/core/responses.py:32-43`, `backend/main.py:79-83` | read + ran |
| `GET /api/levels` returns 4 level summaries (Tutorial 4 puzzles, Levels 1-3 with 12 each) | installation-manual.md Stage 4, deployment.md §6 | `content/levels.json` (`[4,12,12,12]`); `backend/repositories/content_repository.py:46-57` | ran: local + remote `curl`; and `python -c` over the JSON → total 40 puzzles |
| **40** puzzles in total, not 48 (Lead correction) | getting-started.md, installation-manual.md Stage 4 | `content/levels.json` counts `[4,12,12,12]` | ran |
| `GET /api/levels/999` → `404` `not_found` envelope | installation-manual.md Stage 4, deployment.md §6 | measured | ran `curl` → `{"success":false,…"code":"not_found","message":"Level 999 not found"}` |
| `GET /api/progress` without a token → `401` `unauthorized` / `Not authenticated` | runbooks.md RB-03, deployment.md §6 | `backend/core/security.py:21-22`, `backend/core/errors.py:76-81` | ran `curl` → exact envelope |
| A token that Supabase rejects yields `Not authenticated`'s sibling `Invalid session` | runbooks.md RB-03 | `backend/core/security.py:31-32`, `backend/supabase_client.py:96-98` | read |
| `POST /api/score` works signed-out and returns efficiency 40 / targetLaw 30 / hintIndependence 30 / total 100 / earnedPoints 5 for `{levelId:1,stageIdx:0,stepsUsed:1,lawsUsed:["absorption"],hintsUsed:0}` | installation-manual.md Stage 4, deployment.md §6, getting-started.md Step 7 | `backend/services/scoring_service.py`; `backend/config/constants.py:9-19` | ran `curl` → exact JSON |
| `POST /api/score` with a missing field → `422` `validation_error` | installation-manual.md, runbooks.md RB-10 | `backend/main.py:60-66` | ran `curl` → `422` |
| `X-Request-ID` is echoed from the request or generated as `uuid4().hex`, and set on every response | monitoring.md §5, runbooks.md RB-10 | `backend/core/middleware.py:27`, `:61` | ran TestClient with `X-Request-ID: abc123` → response header `abc123` |
| Application errors ≥ 500 are logged with `code` and `status`; 4xx are not logged at ERROR | monitoring.md §4.1 | `backend/main.py:39-47` | read + observed both line shapes in a real run |
| The OpenAPI document declares **no** `securitySchemes`, so `/docs` has no Authorize button (D22) | deployment.md §6.1, installation-manual.md Stage 4 | `backend/main.py:20-25`, no security dependency declared in `backend/api/routes/*` | ran: `/openapi.json` on local and remote → `securitySchemes: NONE`; every operation `security = NONE` |
| With `content/` missing, `/api/levels`, `/api/laws` and `/api/score` return `503 content_unavailable`, while `/` still returns `200` | runbooks.md RB-04, monitoring.md §2.1 | `backend/repositories/content_repository.py:19-31`, `backend/core/errors.py:60-65` | ran: temp copy of `backend/` with `content/` removed → `503` for content routes, `200` for `/`; error `detail` named the exact missing path |
| Content is read once and cached with `functools.lru_cache` (so a JSON edit needs a restart) | runbooks.md RB-04, installation-manual.md §11 | `backend/repositories/content_repository.py:34-43` | read |
| `CONTENT_DIR` resolves to `<repo>/content`, i.e. one level above `backend/` | runbooks.md RB-04, deployment.md §2, run-locally-with-docker.md §4.3 | `backend/repositories/content_repository.py:16` | read + confirmed by the 503 `detail` path |
| Score persistence is a FastAPI background task that never fails the response | getting-started.md Step 8, monitoring.md §4.1 | `backend/api/routes/score.py:38-39`, `backend/services/progress_service.py:87-127` | read |
| A persistence failure is logged as `failed to save score to database` and swallowed | monitoring.md §7 (alert 6), runbooks.md RB-06 | `backend/services/progress_service.py:123-127` | read |
| `save_progress` performs one upsert for the totals row plus **one per completed stage**, sequentially | runbooks.md RB-06 | `backend/services/progress_service.py:63-84` | read |
| Supabase access is synchronous `httpx.Client()` inside `async def` routes (blocking the event loop) | runbooks.md RB-06, monitoring.md §3.1 | `backend/supabase_client.py:69`; `backend/api/routes/progress.py:21`, `:27` | read |
| Error codes are the seven values in `ErrorCode` | runbooks.md escalation, deployment.md §6 | `backend/core/errors.py:11-20` | read |

## 4. Data layer

| Claim | Doc + section | Evidence (file:line) | How verified |
|---|---|---|---|
| `database/init.sql` creates exactly 3 tables: `user_progress`, `stage_progress`, `score_history` | reset-user-progress.md §1, monitoring.md §6.2 | `database/init.sql:7-42` | read |
| `stage_progress` has `UNIQUE(user_id, level_id, stage_idx)` and the app upserts on those columns | runbooks.md RB-08, monitoring.md §6.2 | `database/init.sql:24`; `backend/repositories/progress_repository.py:18`, `:62-68` | read |
| All three tables reference `auth.users(id)` with `ON DELETE CASCADE` | reset-user-progress.md §3.3, runbooks.md RB-08 | `database/init.sql:8`, `:18`, `:30` | read |
| `score_history` is append-only: one row per authenticated scored attempt, never deleted by app code | monitoring.md §6.2 | `backend/repositories/progress_repository.py:57-59`, `backend/services/progress_service.py:94-108` | read |
| The script is idempotent (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`) | installation-manual.md Stage 1, runbooks.md RB-08 | `database/init.sql:7`, `:16`, `:28`, `:45-47` | read |
| RLS policies are `FOR ALL USING (true)` for all roles, with no `auth.uid() = user_id` predicate (D20) | configuration-guide.md §7, installation-manual.md Stage 1.2 | `database/init.sql:50-58` | read |
| The frontend never queries the tables directly — only `supabase.auth.*` | configuration-guide.md §7 | grep over `frontend/src`: only `authActions.js:11,21,33`, `AuthProvider.jsx:23,37`, `apiClient.js:28` | ran |
| Anon key + permissive policies ⇒ anyone holding the anon key can read/write the three tables | configuration-guide.md §7 | `database/init.sql:56-58` (no role scoping) | read (logical consequence of the policy, stated as such) |

## 5. Frontend behaviour used by the guides

| Claim | Doc + section | Evidence (file:line) | How verified |
|---|---|---|---|
| Progress is stored per learner under `praxis_v1_<userId>` | reset-user-progress.md §1 | `frontend/src/config/storageKeys.js:10` | read |
| The guest learner uses `praxis_v1_guest` | reset-user-progress.md §1, §4 | `frontend/src/state/progressStore.js:28` | read |
| Four session flags and one sound preference use the documented keys | reset-user-progress.md §1, config-reference.md §4 | `frontend/src/config/storageKeys.js:16-28` | read |
| Sign-in hydration **merges** local and server progress with `Math.max` on points/bestStreak and a union of stages | reset-user-progress.md §4, runbooks.md RB-08 | `frontend/src/state/progressStore.js:96-130`, `:147-166` | read |
| Progress is pushed to the server 500 ms after a change, and only when signed in | reset-user-progress.md §4 | `frontend/src/state/progressStore.js:87-94`; `frontend/src/config/gameRules.js:68` | read |
| Guests never sync to the server | reset-user-progress.md §4 | `frontend/src/state/progressStore.js:88` | read |
| The only UI-driven reset is the tutorial replay, calling `resetLevelProgress(TUTORIAL.levelId)` | reset-user-progress.md §5.1 | `frontend/src/hooks/useTutorialReplay.js:31`; grep for `resetLevelProgress` shows no other caller of a reset action | read + grep |
| Levels 1-3 and the sandbox are gated until **all four** tutorial stages are complete | getting-started.md Step 6, installation-manual.md §11 | `frontend/src/components/TutorialGate.jsx:61-73`; `frontend/src/state/progressStore.js:330-335`; `frontend/src/config/gameRules.js:84` | read |
| The tutorial is content level 0 and the gate redirects to `/level/0/stage/0?tutorial=true` | installation-manual.md §11, getting-started.md Step 6 | `frontend/src/components/TutorialGate.jsx:5`, `:56`, `:65` | read |
| Tutorial puzzles are `x + xy`→`x` (1 step), `x'y + z + xy`→`y + z` (2), `(x + y)' + x'y'`→`x'y'` (1), `x + x'y + xy`→`x + y` (2) | getting-started.md Step 6 | `content/levels.json` level 0 | ran (dumped the JSON) |
| Level 1 stage 1 is `x + xy`→`x` with target law `absorption` and `optimalSteps` 1 | getting-started.md Step 7 | `content/levels.json` level 1, puzzle 0 | ran |
| A first-time completion awards `STAGE_COMPLETION_XP + earnedPoints` and increments the streak | getting-started.md Step 7, config-reference.md §8 | `frontend/src/components/puzzle/usePuzzleSession.js:190-192`; `frontend/src/state/progressStore.js:170-176`; `frontend/src/state/useGameState.js:439` | read |
| `GUIDE_COST_POINTS = 20` is a spend; the Guide is free in the sandbox and disabled below 20 points | getting-started.md Step 6 | `frontend/src/config/gameRules.js:35`; `frontend/src/components/puzzle/AssistanceControls.jsx:13-32`; `frontend/src/pages/ProblemPage.jsx:259-273` | read |
| Hint and Guide labels/tooltips are `💡 Hint` and `🎯 Guide (20p)` / `(Free)` | getting-started.md Step 6 | `frontend/src/components/puzzle/AssistanceControls.jsx:13-32` | read |
| Routes are `/`, `/login`, `/register`, `/levels`, `/level/:levelId/stages`, `/level/:levelId/stage/:stageIdx`, `/sandbox`, `/sandbox/play`, `*` | getting-started.md, installation-manual.md | `frontend/src/App.jsx:30-57` | read |
| The SPA reads bundled content and only calls the API for unbundled ids | runbooks.md RB-02 | `frontend/src/services/contentApi.js:22-60` | read |
| The SPA attaches the Supabase access token when signed in | runbooks.md RB-03 | `frontend/src/services/apiClient.js:27-31` | read |
| The SPA tolerates both the envelope and the legacy plain-JSON body | deployment.md §8 | `frontend/src/services/apiClient.js:33-45` | read |
| Network failures surface as the message `Could not reach the Praxis server.` | runbooks.md RB-02 | `frontend/src/services/apiClient.js:68-74` | read |
| `npm test` runs 76 engine tests, all passing | installation-manual.md §7.1 | `frontend/package.json:11` | ran `npm test` → `# tests 76 / # pass 76 / # fail 0` (~13.0 s) |
| `npm run build` succeeds (596 modules; 880.23 kB JS / 252.13 kB gzip, 69.29 kB CSS) | installation-manual.md §7.2 | `frontend/package.json:8` | ran `npx vite build --outDir /tmp/…` → exit 0, sizes as quoted |
| Tailwind tokens and CSS custom properties match the config files | config-reference.md §6-§7 | `frontend/tailwind.config.js:9-53`; `frontend/src/styles/tokens.css:15-24` | read |
| Style import order in `main.jsx` is load-bearing | config-reference.md §7 | `frontend/src/main.jsx:6-10`; `frontend/src/styles/index.css:1-14` | read |

## 6. Docker

| Claim | Doc + section | Evidence | How verified |
|---|---|---|---|
| The repository contains **no** Dockerfile, docker-compose file or `.dockerignore` | run-locally-with-docker.md §1-§2 | — | ran a recursive filename search over the checkout (excluding `node_modules`) → no matches; `render.yaml:4` is `env: python` (native runtime) |
| The compose/Dockerfiles in §4 are **new** material, not part of the repository, and were **not executed** | run-locally-with-docker.md §4 | — | ran `docker --version` (podman shim) and `docker info` → daemon unavailable (`/run/user/1000/libpod: read-only file system`); the files are therefore labelled unverified |
| The container mount layout must place `content/` one level above `backend/`, Vite must bind `0.0.0.0`, and the proxy target must be the service name | run-locally-with-docker.md §4.3 | `backend/repositories/content_repository.py:16`; `frontend/vite.config.js:8`, `:30-33` | read (properties of the code; the compose file itself is untested) |

## 7. Discrepancies recorded

| ID / claim | Doc + section | Evidence | How verified |
|---|---|---|---|
| README says "Python 3.9 or higher" — contradicted by the resolved dependencies | installation-manual.md §2.1, §14 | `README.md:30-31` vs `Requires-Python >=3.10` metadata | read + ran |
| README says "Node.js v18 or higher" — contradicted by Vite 8 / ESLint 10 engines | installation-manual.md §2.1, §14 | `README.md:30-31` vs installed `engines` | read + ran |
| README says create `frontend/.env`; the checkout ships `frontend/.env.local` | installation-manual.md §14 | `README.md:62-66`; file listing | read + ran |
| `docs/context.md` claims "No `.env` file exists yet" (D14) — both exist and are gitignored | installation-manual.md §14 | `docs/context.md`; `.gitignore:3`, `frontend/.gitignore:15`; `git ls-files` | read + ran |
| `docs/context.md` §11 prints a real publishable key (D15) — never reproduced anywhere in this work | installation-manual.md §14, configuration-guide.md §7 | `docs/context.md:232-233` | read; values deliberately not copied |
| Proposal's 70 % unlock figure vs the real 80 % (D9) | config-reference.md §3.2 | `frontend/src/config/gameRules.js:49`; `backend/config/constants.py:26` | read |
| Proposal's "46 unit tests" vs the real 76 (D11) | installation-manual.md §7.1 | measured | ran `npm test` |
| Proposal's "2.5 s animation" vs `lawAnimationMs = 1350` (D12) | config-reference.md §3.3 | `frontend/src/config/gameRules.js:60` | read |
| Deploy = "Render for the whole app" (D19) — only the backend is on Render | deployment.md §1, §10 | `render.yaml:1-16`, `frontend/vercel.json` | read |
| D22 — no OpenAPI security scheme, no Authorize button in `/docs` | deployment.md §6.1 | measured `/openapi.json` (local and remote) | ran |
| D21 — Python `round()` vs `Math.round` differ by 1 for `total` ∈ {10, 30, 50, 70, 90} | config-reference.md §2 | `backend/config/constants.py:19`; `frontend/src/engine/scoring.js:80` | ran both languages: Python `0,2,2,4,4` vs JS `1,3,3,4,5` |
| 40 puzzles, not 48 (Lead arithmetic correction) | installation-manual.md Stage 4, getting-started.md | `content/levels.json` | ran |
| Better Auth is dead config in three places (D3) | installation-manual.md §1, configuration-guide.md §9 | `database/init.sql:4`, `frontend/vite.config.js:24-28`, `.gitignore:4`, `.env.local` | read + ran (grep for `VITE_AUTH_URL`, port check) |

## 8. Unverified or environment-dependent

Stated here so the verifier does not have to hunt for them:

| Item | Status |
|---|---|
| Vercel project settings (Root Directory `frontend`, Build `npm run build`, Output `dist`) | **Not in the repository** — documented as expected dashboard configuration, flagged as such in deployment.md §5.2 |
| Render's platform semantics for health checks and free-instance sleep | Not verified from this checkout; phrased conservatively and linked to Render's own docs. The 22.08 s cold-start figure **was** measured |
| Supabase backup/PITR availability per plan | Plan-dependent; runbooks.md RB-08 tells the reader to confirm in the dashboard rather than asserting it |
| Python/Node versions *other* than the ones on the development machine | Version floors derived from package metadata, not from exhaustively testing every older interpreter |
| The compose setup in run-locally-with-docker.md §4 | **Never executed** — no working Docker daemon in the authoring environment. Labelled NEW/unverified in the document |
| Live drift observation (production behind the repo) | A dated snapshot (2026-09-28) with the exact re-check command included; not a permanent claim |
