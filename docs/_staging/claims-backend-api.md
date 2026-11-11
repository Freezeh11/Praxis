# Claim ledger — `backend-api` (task-2)

Every substantive factual claim written by the `backend-api` writer, with its evidence and how
it was verified. **How verified** values mean:

- **read** — I opened the file and read the cited lines.
- **ran** — I executed the code and observed the output (see §3 for the exact commands).
- **ran (stub)** — executed through the real route with one data-layer call substituted,
  because a real Supabase session was unavailable. Envelope/field names are real route output;
  only the data source was substituted. Flagged in the doc itself wherever used.
- **simulated fault** — executed through the real exception handlers after injecting the
  failure (missing content dir, `httpx` transport error, `RuntimeError` in a route).

Deliverables covered: `docs/04-api/API-REFERENCE.md` (**API**),
`docs/06-reference/error-codes.md` (**ERR**), `docs/_staging/diagram-input-backend-api.md`
(**DIA**).

---

## 1. Endpoint inventory and routing

| Claim | Doc + section | Evidence (file:line) | How verified |
|---|---|---|---|
| There are exactly 7 application endpoints | API §1.2, ERR §2 | `backend/main.py:79-83`, `backend/api/routes/*.py` | ran (`/openapi.json` paths = 7) |
| `/openapi.json` lists exactly `/`, `/api/levels`, `/api/levels/{level_id}`, `/api/laws`, `/api/score`, `/api/progress`, `/api/progress/save` | API §2.9 | observed `GET /openapi.json` | ran |
| `GET /` is registered without the `/api` prefix | API §1.2, §3.1 | `backend/main.py:79` | read |
| The other six routes are registered with `prefix="/api"` | API §1.2 | `backend/main.py:80-83` | read |
| There is **no** `/api/sandbox/*` endpoint | API §1.3, §8.1; ERR §8; DIA §2 | `backend/main.py:79-83` (complete router list) | ran (`/openapi.json`) + read |
| There is no `/api/auth` route on this service | API §1.3 | `backend/main.py:79-83` | ran + read |
| FastAPI adds `/docs`, `/redoc`, `/openapi.json`, `/docs/oauth2-redirect` | API §2.9 | observed each returning `200` | ran |
| OpenAPI `info` is `{"title":"Praxis API","version":"1.0.0"}` | API §2.9 | `backend/main.py:25` | ran |
| The OpenAPI document declares no tags | API §2.9 | observed `"tags"` absent on every operation | ran |
| Only `200` and `422` appear as documented responses per operation | API §2.9; ERR §8 | observed `/openapi.json` | ran |
| Service starts as `uvicorn main:app` with `rootDir: backend` | API §1.1 | `render.yaml:7-8` | read |

## 2. Envelope, headers, middleware

| Claim | Doc + section | Evidence (file:line) | How verified |
|---|---|---|---|
| Every `/api/*` route returns `{success, data, error}` with all three keys always present | API §2.1 | `backend/core/responses.py:24-34` | ran |
| `success(data)` returns `{"success":True,"data":data,"error":None}` | API §2.1 | `backend/core/responses.py:32-34` | ran |
| `failure(code,message,detail)` returns `{"success":False,"data":None,"error":{...}}` | API §2.1 | `backend/core/responses.py:37-43` | ran |
| `error` is `{code, message, detail}` with `detail` nullable | API §2.1 | `backend/core/responses.py:16-21` | ran |
| `GET /` returns a plain payload outside the envelope, deliberately | API §2.2, §8.2; ERR §2 | `backend/api/routes/health.py:15-18`; comment at `:1-4` | ran |
| Exact `GET /` body is `{"message":"Praxis API is running","docs":"/docs"}` | API §3.1 | observed `GET /` | ran |
| Every 2xx envelope response is `application/json`, single-line | API §2.1 | observed `content-type` on all routes | ran |
| `X-Request-ID` is set on every response | API §2.3 | `backend/core/middleware.py:61` | ran (10-case presence matrix) |
| A client-supplied `X-Request-ID` is echoed verbatim | API §2.3 | `backend/core/middleware.py:27` | ran (`abc123deadbeef` echoed) |
| Without the header, a fresh `uuid4().hex` is generated | API §2.3 | `backend/core/middleware.py:27` | ran |
| `X-Request-ID` is present on `404`, `401`, `422`, `500`, `503` responses | API §2.3, §5 | `backend/core/middleware.py:61` | ran |
| CORS preflight responses have **no** `X-Request-ID` | API §2.3, §2.6; ERR §6 | observed `OPTIONS` preflight | ran |
| The header is also stamped on the middleware's own `500` response | API §5 | `backend/core/middleware.py:45,61` | simulated fault |
| Log line format is one JSON object per line on stdout | API §2.3, §8.10; ERR §7.2 | `backend/core/logging.py:34-50` | ran (observed lines) |
| Log keys are `ts, level, logger, message, request_id` + merged fields + optional `exception` | API §2.3, §8.10; ERR §7.2 | `backend/core/logging.py:38-50` | ran |
| `request_id` joins the access line to the failure line for one request | API §2.3; ERR §7.2 | `backend/core/middleware.py:27-61` | ran (observed identical ids) |
| CORS is added last so it is outermost | API §2.6 | `backend/main.py:27-36` (comment at `:27-28`) | read |
| Allowed origins are `localhost:5173`, `127.0.0.1:5173`, `localhost:3001` + `FRONTEND_URL` | API §2.6 | `backend/config/settings.py:23-27`, `:66-71` | read + ran (echoed ACAO) |
| `allow_credentials=True`, `allow_methods=["*"]`, `allow_headers=["*"]` | API §2.6 | `backend/main.py:33-35` | read |
| A preflight from a disallowed origin returns `400` with plain text `Disallowed CORS origin` | API §2.6; ERR §6 | observed `OPTIONS` with `Origin: https://evil.example` | ran |
| Preflight `access-control-max-age` is `600` | API §2.6 | observed preflight headers | ran |
| Simple cross-origin requests get `ACAO` + `ACAC=true` + `Vary: Origin` | API §2.6 | observed `GET /api/levels` with an allowed `Origin` | ran |
| No `access-control-expose-headers`, so scripts cannot read `X-Request-ID` cross-origin | API §2.6 | observed preflight/response headers | ran |

## 3. Authentication

| Claim | Doc + section | Evidence (file:line) | How verified |
|---|---|---|---|
| Auth is Supabase Auth via a bearer token | API §2.4; ERR §3.4 | `backend/core/security.py:17-35` | read + ran |
| The token is validated by calling Supabase `GET /auth/v1/user` | API §2.4 | `backend/supabase_client.py:87-98` | read + ran (live 403 for a bogus token) |
| The user check uses `apikey: <service-role-key>` and the user's bearer token | API §2.4 | `backend/supabase_client.py:90-93` | read |
| The auth call has a 5 s timeout | ERR §3.3 | `backend/supabase_client.py:95` | read |
| Any non-200 from Supabase yields `None` → `401 Invalid session` | API §2.4; ERR §3.4 | `backend/supabase_client.py:96-98`, `backend/core/security.py:31-32` | ran (live call returned 403 → 401) |
| An `httpx.HTTPError` from the auth call yields `502 upstream_error` | API §2.4; ERR §3.3 | `backend/core/security.py:28-29` | simulated fault |
| There is no local JWT verification and no token cache | API §2.4 | `backend/core/security.py:17-35` (whole function) | read |
| The `Bearer ` prefix check is case-sensitive | API §2.4; ERR §3.4 | `backend/core/security.py:21` | ran (5-case header matrix) |
| No header / wrong prefix / leading space all give `401 Not authenticated` | API §2.4; ERR §3.4 | `backend/core/security.py:19-22` | ran |
| `Authorization: Bearer ` (empty token) gives `502`, not `401` | API §2.4, §8.5; ERR §3.3 | `backend/core/security.py:24` + `backend/supabase_client.py:94-95` | ran (detail `Illegal header value b'Bearer '`) |
| `get_current_user` is used by both progress routes | API §1.2, §2.4; ERR §5.2 | `backend/api/routes/progress.py:21,29` | read |
| `optional_user` is used by `POST /api/score` | API §2.4 | `backend/api/routes/score.py:24` | read |
| `optional_user` swallows only `UnauthorizedError` | API §2.4; ERR §3.3 | `backend/core/security.py:38-43` | read |
| `POST /api/score` with a token returns `502` when Auth is unreachable; without a token returns `200` | API §2.4, §3.5; ERR §3.3, §5.2 | `backend/core/security.py:38-43`, `backend/api/routes/score.py:24` | simulated fault (both variants) |
| `POST /api/score` with a bogus token still returns `200` | API §2.4, §3.5 | `backend/core/security.py:42-43` | ran (live Supabase 403, response 200) |
| Auth is resolved before body validation on `/api/progress/save` | API §3.7; ERR §3.4 | dependency ordering observed | ran (4 body shapes, all `401` without a token) |
| There is no Better Auth server in the repo | API §2.4 (D3), §1.3 | no `auth-server/` directory; `frontend/vite.config.js:28-33` is dead config | read |
| The `/api/auth` Vite proxy entry is dead configuration | API §1.3, §2.4 | `frontend/vite.config.js:28-33` | read |
| `init.sql`'s Better Auth comment is stale | API §2.4 (D3) | `database/init.sql:4` | read |
| The frontend attaches the token via `supabase.auth.getSession()` | API §2.4, §6.1 | `frontend/src/services/apiClient.js:27-31` | read |
| Auth mutations go through `authActions.js` only | DIA §1 | `frontend/src/services/authActions.js:9-33` | read |
| `AuthProvider` seeds the session and subscribes to auth changes | DIA §1 | `frontend/src/state/AuthProvider.jsx:23,37` | read |

## 4. Per-endpoint claims

| Claim | Doc + section | Evidence (file:line) | How verified |
|---|---|---|---|
| `GET /api/levels` returns 4 summaries with `puzzleCount` `[4,12,12,12]` | API §1.2, §3.2, §7 | observed body; `backend/repositories/content_repository.py:46-57` | ran |
| Total puzzle count is **40**, not 48 | API §3.2, §7 | observed `puzzleCount` sum | ran |
| Level ids are `[0,1,2,3]` with `0` = Tutorial | API §2.8, §3.2 | observed body; `content/levels.json` | ran |
| Level names/descs are exactly as published (incl. `Level 3 — Boss`) | API §3.2 | observed body | ran |
| `GET /api/levels` summary is a projection; `puzzles` becomes `puzzleCount` | API §3.2 | `backend/repositories/content_repository.py:46-57` | read |
| `list_levels()`/`list_laws()` are `lru_cache`d | API §3.2, §3.4; ERR §3.2 | `backend/repositories/content_repository.py:34-43` | read |
| `CONTENT_DIR` resolves to `<repo>/content` | API §3.2; ERR §3.2 | `backend/repositories/content_repository.py:16` | read + simulated fault (path in `detail`) |
| `GET /api/levels/999` → `404 not_found` with message `Level 999 not found` | API §3.3; ERR §3.1 | `backend/services/content_service.py:26-28` | ran |
| `GET /api/levels/-1` → `404` `Level -1 not found` (no special case) | API §3.3; ERR §3.1 | `backend/repositories/content_repository.py:60-62` | ran |
| `GET /api/levels/abc` → `422` with `loc ["path","level_id"]` | API §3.3; ERR §3.5 | `backend/main.py:60-66` | ran |
| `GET /api/levels/{id}` top-level keys are `id,name,desc,varCount,puzzles` | API §3.3, §4.2 | observed body | ran |
| Every puzzle has exactly the 6 keys `expr,goal,targetLaws,hints,optimalSteps,optimalHint` | API §3.3, §4.3, §7 | observed body for all 40 puzzles | ran |
| The full `GET /api/levels/1` body is 4 693 bytes with 12 puzzles | API §3.3 | observed `len(response.text)` | ran |
| `GET /api/laws` returns 10 cards in authoring order | API §3.4 | observed body; `content/laws.json` | ran |
| Law ids are `complement,idempotent,absorption,identity,annulment,distributive,double-neg,demorgan-and,demorgan-or,associative` | API §3.4, §4.4 | observed body | ran |
| Every law card has exactly `id,name,formulas,desc` | API §4.4 | observed body | ran |
| `distributive-expand` exists in the engine but is **not** a law card | API §3.4 | observed 10-card list | ran + read |
| `POST /api/score` request fields and optionality | API §3.5, §4.5 | `backend/api/schemas/score.py:13-20` | read + ran (5-field `422` for `{}`) |
| `hintsUsed` and `lawsUsed` are **required** (no default) | API §3.5 | `backend/api/schemas/score.py:17-18` | ran (`{}` → 5 missing) |
| Unknown extra body fields are ignored | API §2.5, §3.5 | pydantic default; no `model_config` in `backend/api/schemas/` | ran (`bogus` field → 200) |
| Exact `POST /api/score` success body for the perfect Level 1 stage 0 submission | API §3.5 | observed body | ran |
| Score components are capped 40/30/30 and `total` ≤ 100 | API §4.5 | `backend/config/constants.py:9-12` | read + ran |
| `earnedPoints = round(total/100 × 5)` | API §3.5, §4.5 | `backend/services/scoring_service.py:55` | read + ran (100→5, 60→3, 70→4) |
| Steps over the optimum cost 10 points each, floored at 0 | API §3.5 | `backend/services/scoring_service.py:91-96` | ran (`stepsUsed:40` → `efficiency 0.0`) |
| Hints and guides each cost 10 hint-independence points, floored at 0 | API §3.5 | `backend/services/scoring_service.py:110-115` | ran (1 hint + 1 guide → 10.0) |
| `guidesUsed` folds into `totalAssistance` alongside `hintsUsed` | API §3.5 | `backend/services/scoring_service.py:51` | ran (`totalAssistance: 2`) |
| `optimalSteps` is used only when `> 0`, else the puzzle's own value | API §3.5 | `backend/services/scoring_service.py:80-86` | read |
| The resolved optimum is `min(optimal, stepsUsed)` | API §3.5 | `backend/services/scoring_service.py:88` | read |
| Empty `lawsUsed` yields `targetLaw 0.0` when the puzzle has target laws | API §3.5 | `backend/services/scoring_service.py:99-107` | ran (`targetLaw: 0.0`) |
| A puzzle with no target laws yields the full 30 | API §3.5, §4.3 | `backend/services/scoring_service.py:101-102` | read |
| `breakdown` has exactly the 7 documented keys | API §3.5, §4.5 | `backend/services/scoring_service.py:68-76` | ran |
| `targetLawsRequired`/`targetLawsUsed` come from Python `set`s and are unordered | API §3.5 | `backend/services/scoring_service.py:46-47,71-72` | ran (two different orders across runs) |
| Signed-in scores persist via a `BackgroundTask` | API §2.4, §3.5, §8.3; ERR §3.3 | `backend/api/routes/score.py:38-39` | ran (stub) |
| Persistence inserts `score_history` then conditionally upserts `stage_progress` | API §3.5 | `backend/services/progress_service.py:87-127` | ran (stub) + read |
| The `score_history.hints_used` column receives `hints + guides` | API §3.5 | `backend/services/progress_service.py:101` | read |
| Persistence exceptions are logged and swallowed | API §3.5; ERR §7.2 | `backend/services/progress_service.py:123-127` | read |
| `stageIdx: 99` → `404 Stage 99 not found` | API §2.8, §3.5; ERR §3.1 | `backend/services/content_service.py:40-41` | ran |
| `stageIdx: -1` → `200`, scores the **last** puzzle of the level | API §2.8, §3.5, §8.6; ERR §3.1, §3.7 | `backend/services/content_service.py:40-41` (no lower-bound guard) | ran |
| `stageIdx: -12` → `200`, scores the **first** puzzle | API §2.8; ERR §3.7 | same | ran |
| `stageIdx: -13` and `-100` → `500 internal_error` | API §2.8, §3.5; ERR §3.7 | `IndexError` escaping `backend/services/content_service.py:40-41` | ran |
| `GET /api/progress` requires a bearer token | API §3.6 | `backend/api/routes/progress.py:20-23` | read + ran (401) |
| Progress snapshot fields are `points,streak,bestStreak,stageProgress,stageScores` | API §3.6, §4.6 | `backend/services/progress_service.py:44-50` | ran (stub) + read |
| `stageProgress` maps level id (**string**) → array of completed stage indices | API §3.6 | `backend/services/progress_service.py:30-39` | ran (stub) + read |
| `stageScores` keys are `"<levelId>:<stageIdx>"` and only `best_score > 0` appears | API §3.6 | `backend/services/progress_service.py:41-42` | ran (stub) + read |
| A user with no rows gets zeros and empty maps | API §3.6 | `backend/services/progress_service.py:45-47` | ran (stub) |
| `stageProgress`/`stageScores` key order is not specified | API §3.6 | PostgREST row order; `backend/services/progress_service.py:33-42` | read |
| The client merges `stageSolutions`, `levelsCompleted`, `hasCompletedTutorial` which the API never returns | API §3.6, §4.6 | `frontend/src/state/progressStore.js:119,121,125` vs `backend/services/progress_service.py:44-50` | read |
| `POST /api/progress/save` success is `{"status":"ok"}` | API §3.7 | `backend/api/routes/progress.py:41` | ran (stub) |
| The save body is `{"progress": {...}}` with `progress` required | API §3.7; ERR §3.5 | `backend/api/schemas/progress.py:21-22` | read + ran (`loc ["body","progress","points"]`) |
| `ProgressData` fields and defaults (`points/streak/bestStreak` 0, maps `{}`) | API §3.7, §4.6 | `backend/api/schemas/progress.py:11-18` | read + ran |
| `stageScores` values keep int-or-float (the `int \| float` union) | API §3.7 | `backend/api/schemas/progress.py:16-18` | read |
| Save writes exactly one `user_progress` upsert plus one `stage_progress` upsert per completed stage | API §3.7 | `backend/services/progress_service.py:53-84` | ran (stub, captured 4 records) |
| A missing `stageScores` key makes `best_score` default to `0` | API §3.7 | `backend/services/progress_service.py:75` | ran (stub, Tutorial row `best_score: 0`) |
| The upsert conflicts on `user_id,level_id,stage_idx` | API §3.7 | `backend/repositories/progress_repository.py:18,62-68` | read |
| `best_score` on this route is last-write-wins, not max | API §3.7, §8.7 | `backend/services/progress_service.py:75-84` (no max guard) | read |
| The save route issues one HTTP request per completed stage (sequential) | API §3.7 | `backend/services/progress_service.py:72-84` | read |

## 5. Error codes

| Claim | Doc + section | Evidence (file:line) | How verified |
|---|---|---|---|
| `ErrorCode` declares exactly 7 codes | ERR §2 | `backend/core/errors.py:11-20` | read |
| There are exactly 7 `raise` sites for `AppError` subclasses | ERR §2 | grep of `backend/**/*.py` | ran |
| `not_found` = 404, default message `Resource not found` (never used) | ERR §3.1 | `backend/core/errors.py:52-57` | read + ran |
| `content_unavailable` = 503 with a path-bearing `detail` | ERR §3.2 | `backend/core/errors.py:60-65`, `backend/repositories/content_repository.py:24-31` | simulated fault |
| `upstream_error` = 502 from two raise sites | ERR §3.3 | `backend/core/errors.py:68-73`, `backend/core/security.py:29`, `backend/repositories/progress_repository.py:26` | simulated fault + ran |
| `unauthorized` = 401 with two messages | ERR §3.4 | `backend/core/errors.py:76-81`, `backend/core/security.py:22,32` | ran |
| `validation_error` = 422, always message `Request validation failed` | ERR §3.5 | `backend/main.py:60-66` | ran (6 distinct modes) |
| `http_error` = framework status with the framework's message | ERR §3.6 | `backend/main.py:50-57` | ran (`Not Found`, `Method Not Allowed`) |
| `internal_error` = 500 with message `Internal server error` | ERR §3.7 | `backend/core/responses.py:55-59`, `backend/core/middleware.py:45` | simulated fault + ran (`stageIdx: -13`) |
| `AppError()`'s default message is `Unexpected error` (a different code path) | ERR §3.7, §8 | `backend/core/errors.py:32` | read |
| The middleware's last-resort `500` takes precedence over `main.py`'s `Exception` handler | API §5; ERR §3.7 | `backend/core/middleware.py:33-45` vs `backend/main.py:69-76` | simulated fault (traceback logged by `praxis.request`, not `praxis.api`) |
| PostgREST non-2xx becomes `502 upstream_error`, not `409`/`400` | ERR §3.3 | `backend/supabase_client.py:80`, `backend/repositories/progress_repository.py:21-26` | ran (live `409 Conflict` captured) |
| `upstream_error` `detail` can leak the Supabase project host | ERR §3.3 | observed `409` detail string | ran (hostname redacted in the doc) |
| A `4xx` `AppError` is not logged as an error; `>= 500` is | ERR §7.2 | `backend/main.py:42-46` | read + ran (log lines) |
| `network_error` is client-only, `status: 0` | ERR §4.1 | `frontend/src/services/apiClient.js:68-74` | read |
| `invalid_response` is client-only, set on an unparseable body | ERR §4.2 | `frontend/src/services/apiClient.js:99-104` | read |
| A `204` short-circuits to `null` before parsing | ERR §4.2 | `frontend/src/services/apiClient.js:91` | read |
| `http_<status>` is used only when the body has no `error.code` | ERR §4.3, §5.3 | `frontend/src/services/apiClient.js:84-88` | read |
| `api_error` is the constructor default and is unreachable from this API | ERR §4.4 | `frontend/src/services/apiClient.js:17,38-41`; every backend failure sets `code` | read |
| `ApiError` carries `name, message, status, code, detail` | ERR §4.5 | `frontend/src/services/apiClient.js:16-24` | read |
| `ApiError` is referenced only inside `apiClient.js` | ERR §4.5 | grep of `frontend/src` | ran |
| Three of the four call sites are `silent: true`, so no API error reaches the learner | ERR §4.5, §7.1; API §6.4 | `frontend/src/services/scoreApi.js:34`, `progressApi.js:12,20` | read |
| `useGameContent` hard-codes `error: null` | ERR §4.5 | `frontend/src/state/useGameContent.js:20` | read |
| No rate limiting / `429` exists | ERR §8 | no limiter middleware in `backend/main.py` | read |
| No `403`, `409`, `408`, `501` codes are produced | ERR §8 | grep of `backend/**/*.py` for those statuses | ran |
| No `WWW-Authenticate` header on `401` | ERR §8 | `backend/core/errors.py:76-81` (plain exception, no headers) | read |
| The CORS `400` is the only non-envelope, non-`X-Request-ID` failure | ERR §6 | observed preflight | ran |

## 6. Data layer and configuration

| Claim | Doc + section | Evidence (file:line) | How verified |
|---|---|---|---|
| `user_progress` is keyed by `user_id` UUID → `auth.users(id)` | API §3.7 | `database/init.sql:7-13` | read |
| `stage_progress` has `UNIQUE(user_id, level_id, stage_idx)` | API §3.7 | `database/init.sql:16-25` | read |
| `score_history` holds one row per attempt | API §3.5 | `database/init.sql:28-42` | read |
| `stage_progress.level_id` stores the 0-based content id | API §2.8 | `database/init.sql:19`, `backend/services/progress_service.py:72-75` | read |
| RLS is enabled with one permissive `FOR ALL USING (true)` policy per table | ERR §9 (cross-ref) | `database/init.sql:49-58` | read |
| The backend uses the service-role key, bypassing RLS | API §3.6 | `backend/supabase_client.py:26-31` | read |
| Repository HTTP is synchronous inside `async def` routes | API §3.6 | `backend/supabase_client.py:69`; `backend/api/routes/progress.py:20-23` | read |
| The Supabase shim implements only `select`/`insert`/`upsert` with `eq` filters | API §3.7 | `backend/supabase_client.py:33-85` | read |
| `settings` is built at import time and requires `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` | API §2.10; ERR §3.3 | `backend/config/settings.py:56-63,74-75` | read + ran (app booted) |
| `FRONTEND_URL` is optional and appended to the CORS list | API §2.6 | `backend/config/settings.py:62,66-71` | read |
| Production is one Render service; the SPA is on Vercel | API §1.1 | `render.yaml:1-15`, `frontend/vercel.json:7-10` (the SPA fallback `/(.*)` → `/index.html`) | read |
| Vercel rewrites `/api/(.*)` to the Render host, so the browser is same-origin | API §1.1; ERR §4.2 | `frontend/vercel.json:3-6` (the `/api` rewrite) | read |
| Vite proxies `/api` to `127.0.0.1:8000`, overridable via `VITE_API_TARGET` | API §1.1; ERR §4.1 | `frontend/vite.config.js:8,34-38` | read |
| The SPA bundles `content/*.json` through the `@content` alias | API §3.2, §3.4, §8.8 | `frontend/vite.config.js:9-17`, `frontend/src/content/gameContent.js:13-14` | read |
| `GET /api/levels` and `GET /api/laws` have no frontend caller | API §3.2, §3.4, §8.8 | grep `apiRequest` in `frontend/src` → 4 hits, none for these | ran |
| `getLevelSummaries`/`getLaws` are synchronous and never hit the network | API §3.2, §3.4 | `frontend/src/services/contentApi.js:22-29` | read |
| `fetchLevel` is bundled-first with a network fallback using `auth: false` | API §3.3 | `frontend/src/services/contentApi.js:36-61`, request at `:49` | read |
| The backend Python package is 28 modules / 1 241 lines | (context only; not asserted in the docs) | `git ls-files 'backend/*.py'` | ran |
| `list_levels`/`list_laws` caches do **not** cache exceptions: a `503` retries every request and self-heals when the file returns; a *successful* load is cached for the process lifetime | API §3.2; ERR §3.2 | `backend/repositories/content_repository.py:34-43` | ran (5-step cache-counter probe: `misses` 1→1→2→3, `hits` 1 after restore) |
| The engine is framework-free, network-free and React-free (only relative imports plus `config/gameRules.js`) | DIA §2.1 | `frontend/src/engine/index.js:1-13`; `grep '^import' frontend/src/engine/**/*.js` shows only relative paths | ran + read |
| The sandbox is behind `ProtectedRoute` + `TutorialGate` | DIA §2.1 | `frontend/src/App.jsx:47,53` | read |

## 7. Discrepancy-register items owned or co-owned by this task

| Register item | Where documented | Evidence | How verified |
|---|---|---|---|
| **D1 / D23** — brief implies `POST /sandbox/validate`; no such endpoint | API §1.3, §8.1; DIA §2 | `backend/main.py:79-83`; sandbox lives in `frontend/src/engine/sandbox/` | ran + read |
| **D3** — Better Auth remnants are dead | API §2.4, §1.3 | `frontend/vite.config.js:28-33`, `database/init.sql:4` | read |
| **D6** — the brief lists 5 endpoints; the code has 7 | API §1.2, §8.3 | `backend/main.py:79-83` | ran + read |
| **D7** — `POST /api/score` **does** persist for signed-in users | API §2.4, §3.5, §8.3 | `backend/api/routes/score.py:38-39`, `backend/services/progress_service.py:87-127` | ran (stub) + read |
| **D13** — CORS also allows `localhost:3001` and `FRONTEND_URL` | API §2.6 | `backend/config/settings.py:23-27,66-71` | read |
| **D17** — real backend paths, no `app/` package | API §1.3 | `backend/main.py:15-20` | read |
| **D18** — `src/services`, `src/pages` | API §1.3 | `frontend/src/services/`, `frontend/src/pages/` | read |
| **D22** (new, from the Lead) — no OpenAPI security scheme ⇒ no Authorize button | API §2.4, §8.4 | observed `/openapi.json`: no `components.securitySchemes`, no per-operation `security`, no root `security` | ran |
| **D15 / D14** — no secret values reproduced | API §2.10; ERR §3.3 | secrets replaced by `<project-ref>` / `<service-role-key>` placeholders; the one leaked host in an observed `detail` string was redacted | read |

## 8. Corrections reported back to the Lead

| Item | Finding | Evidence | How verified |
|---|---|---|---|
| **GROUND-TRUTH.md arithmetic slip** | §3 of `docs/_staging/GROUND-TRUTH.md` states "4 levels, 12 stages each = 48 puzzles"; the per-level counts in the same section (Tutorial 4, L1/L2/L3 12 each) give **40**. The live API confirms 40. | `GET /api/levels` → `puzzleCount [4,12,12,12]`; `GET /api/levels/0` has 4 puzzles | ran |
| **GROUND-TRUTH.md §3 wording** | Same section says `content/levels.json` has "4 levels, 12 stages each", which contradicts its own per-level breakdown. The docs state 40 and flag the slip. | `content/levels.json`; observed API | ran |
| **New finding (not in GROUND-TRUTH): empty `Bearer` returns 502** | The task brief said "401 identically when not" authenticated. True for a missing/malformed header, but `Authorization: Bearer ` (empty token) returns `502 upstream_error`. | `backend/core/security.py:24` | ran |
| **New finding (not in GROUND-TRUTH): no OpenAPI security** | Per the Lead's D22 request; confirmed and documented with evidence. | `/openapi.json` | ran |
| **New finding (not in GROUND-TRUTH): `stageIdx: -13` is a 500** | Negative indices are accepted (`-1`…`-12`), and beyond that an `IndexError` escapes as `internal_error`, not `404`. | `backend/services/content_service.py:40-41` | ran |
| **New finding (not in GROUND-TRUTH): `POST /api/score` can 502** | With a bearer token and Supabase Auth down, `optional_user` propagates `UpstreamError`. The token-free path never calls Supabase. | `backend/core/security.py:38-43` | simulated fault |
| **New finding (not in GROUND-TRUTH): three client fields never round-trip** | `stageSolutions`, `levelsCompleted`, `hasCompletedTutorial` are merged from the server but never sent by `GET /api/progress`. | `frontend/src/state/progressStore.js:119,121,125` vs `backend/services/progress_service.py:44-50` | read |
| **New finding (not in GROUND-TRUTH): `best_score` is not max-guarded on save** | The save route writes the client's number with no comparison, so a lower score overwrites a higher one. | `backend/services/progress_service.py:75-84` | read |
| **New finding (not in GROUND-TRUTH): score-history column conflates guides with hints** | `score_history.hints_used` stores `hints + guides`. | `backend/services/progress_service.py:101` | read |
| **Self-correction: `lru_cache` does not cache the `503`** | My first draft said a `content_unavailable` failure is sticky and needs a restart. A cache-counter probe disproved it: failures retry and self-heal, while successes are cached forever (so later file edits are ignored). Both docs now state the verified behaviour. | `backend/repositories/content_repository.py:34-43` | ran |
| **Self-correction: no "sandbox" in first-party backend code** | My first draft said "no file in `backend/` mentions sandbox". The literal grep hits are inside the vendored `backend/venv/`; the first-party claim holds, and the staging note now says so precisely. | `git ls-files 'backend/*.py' \| xargs grep -l sandbox` → no matches | ran |
| **Self-correction: `Bearer  <token>` (two spaces) is a `502`, not a `401`** | My first draft recorded `401 Invalid session` for this header, because that probe ran with the Supabase client stubbed (the stub mapped an empty token to `None`). Verified live: the empty token makes `httpx` reject the header, so it returns the same `502` as the trailing-space case. Both docs now say `502`, and the contrast with a non-empty wrong token (`401 Invalid session`) is called out. | `backend/core/security.py:24` | ran (stub) → ran (live) |
| **Self-correction: one malformed JSON block** | The `{}`-body `422` envelope quoted in `error-codes.md` was missing its final `}`. Found by parsing every `json` fence in the four deliverables; now 0 invalid fences. | observed body | ran |

## 9. Exact commands used to verify

```bash
# 1. boot the app in-process and hit every route
cd backend
./venv/bin/python -c "
from fastapi.testclient import TestClient
from main import app
c = TestClient(app)
r = c.get('/api/levels'); print(r.status_code, r.text)
"

# 2. the full verification harness used for this ledger (a dot-file created under docs/04-api/,
#    never a deliverable, deleted afterwards): a labelled request/response transcript covering
#    - all 7 endpoints, valid + unknown ids
#    - 6 distinct 422 shapes
#    - 401 with 5 header variants (plus a live bogus-token call)
#    - 404/405 framework errors
#    - content_unavailable 503 (CONTENT_DIR pointed at a missing directory)
#    - upstream_error 502 (httpx.ConnectError injected at the Supabase boundary)
#    - internal_error 500 (RuntimeError injected in a route, raise_server_exceptions=False)
#    - CORS preflight allowed + disallowed + no-Origin
#    - X-Request-ID presence matrix
#    - a cache-counter probe for the lru_cache retry behaviour
#    - an acceptance audit: every ```json fence in the deliverables parsed and matched
#      against a freshly observed response body (40/40 response blocks matched; the
#      remainder are requests, log lines and elided/truncated examples)
PYTHONPATH=$PWD ./venv/bin/python <harness>

# 3. authenticated-path probes with the data layer stubbed
#    (fake Supabase user returned by security.supabase.get_user; repository functions recorded)
```

The harness and its transcripts were scratch artifacts under `docs/04-api/` and were deleted
before completion; no scratch file ships in the documentation suite.

## 10. What remains **unverified**

| Item | Why it could not be verified | How the doc handles it |
|---|---|---|
| A real successful `GET /api/progress` / `POST /api/progress/save` against live Supabase | No real Supabase user credentials were available, and creating one would write to the production project | Stated explicitly in API §3.6 and §3.7; every such body is labelled "observed with the data layer stubbed" |
| Real production `/docs` rendering (the missing Authorize button) | The Swagger UI page was fetched and returned `200`; the absence of the button is inferred from the OpenAPI document, which contains no security scheme | API §2.4 states the evidence precisely: no `securitySchemes`, no per-operation `security` |
| Render/Vercel CORS behaviour end to end | No deployment access | Documented from configuration files only (`render.yaml`, `frontend/vercel.json`) |
| Whether `content/` is present in the deployed Render image | No deployment access | ERR §3.2 lists it as the first thing to check for a `503` |
| `ContentUnavailableError` triggered by invalid JSON (as opposed to a missing file) | Only the missing-file path was exercised | ERR §3.2 describes both triggers from code (`backend/repositories/content_repository.py:24`) and labels the JSON case as code-read |

---

## 11. Remediation round — verifier findings applied

All edits below were made after the independent audit
(`docs/verification-report.md`); no file outside `docs/04-api/API-REFERENCE.md`,
`docs/06-reference/error-codes.md` and the two `_staging` files was touched.

| Finding | Fix applied | Re-verified how |
|---|---|---|
| **M1** — 3 dead anchors in API §(25, 35, 1700) and 15 in ERR §(23-29, 92-98, 363) | Reverted every anchor to the verifier's authoritative `github-slugger@2.0.0` value: `#22-the-one-route-outside-the-envelope-get-`, `#31-get-`, `#31-not_found--404`, `#32-content_unavailable--503`, `#33-upstream_error--502`, `#34-unauthorized--401`, `#35-validation_error--422`, `#36-http_error--404--405--any-framework-status`, `#37-internal_error--500` | ran — three independent checks: the suite gate (0 BADANCH rows name my files), and a direct `github-slugger@2.0.0` pass over every in-page link (API 44/44 OK, ERR 36/36 OK) |
| **M2** — `total` `0–100` and `earnedPoints` `0–5` were false | Range cells now read "0–100 for every non-negative input; **unvalidated** …" / "0–5 for every non-negative input; scales with the unclamped `total`"; request-field rows for `stepsUsed`/`hintsUsed`/`guidesUsed` carry the no-lower-bound warning; added **§8.11** (three observed examples) and a note in API §3.5; added an ERR §3.5 "no value bounds, so no range errors" block and an ERR §8 trap row | ran — reproduced the audit's numbers exactly: `hintsUsed:-99` → `hintIndependence 1020.0, total 1060.0, earnedPoints 53`; `guidesUsed:-10` → `total 170.0`; `stepsUsed:-5` → `total 100.0` (negative steps do *not* inflate) |
| **M3** — "all 40 puzzles ship 3 hints" | Cell now reads "37 of the 40 puzzles ship 3 hints — Tutorial stages 0, 2 and 3 ship 2" | ran — hint-length histogram over all 40 puzzles: `{2 hints: 3, 3 hints: 37}`, the three being level 0 stages 0/2/3 |
| **M5** — OpenAPI components listed 8 schemas | Now names the real **seven** (`Envelope, ErrorBody, ProgressData, SaveProgressRequest, ScoreRequest, ValidationError, HTTPValidationError`) and adds the sentence explaining that `ScoreResponse` is absent because the route declares `response_model=Envelope` and dumps the model into `data` | ran — `GET /openapi.json` → 7 schemas, `ScoreResponse` absent |
| **m5** — four `vite.config.js` citations overshot the 36-line file | `:34-38`→`:29-34` (API §1.1, API §6.4, ERR §4.1), `:35-38`→`:29-34` (API §3.1), `:8,34-38`→`:8,29-34` (ERR §4.1) | ran — `wc -l` = 36; `/api` block read at `:29-34` |
| **m6** — wrong range for the `/api/auth` proxy | `:28-33`→`:24-28` (API §1.3); also fixed the same class at API §2.4 where the Better Auth *comment* was cited as `:28-30` → `:24` (the verifier did not flag this one) | ran — comment at `:24`, block `:25-28` |
| **N3** — `vercel.json` citations overshot the 12-line file | Every citation now points at the rule it describes: the `/api` rewrite is `:3-6` (API §1.1, ERR §4.1 in two spots — the old range straddled both rules) | ran — `/api` rewrite read at `:3-6`, SPA fallback at `:7-10` |
| **ND-4** — two stale `vercel.json` ranges survived here in the ledger | Row "Production is one Render service; the SPA is on Vercel" now cites `:7-10` (the SPA fallback `/(.*)` → `/index.html`, which is the rule that puts the SPA on Vercel); the row "Vercel rewrites `/api/(.*)` to the Render host" cites `:3-6` | ran — a grep for the retired straddling `vercel.json` range returns no matches |
| My own offer — staged path references | All four restored as real relative links: API §8 → `../07-explanation/known-limitations.md`, API Related-reading rows → `known-limitations.md` and `DIAGRAMS.md`, ERR Related-reading → `known-limitations.md`; the "these files did not exist" note replaced with a link-check note | ran — gate reports no broken link for either file |
| **Extra, self-found (not in the audit): one table row was split by unescaped pipes** | API §3.5 `targetLaw` row wrote the set notation `\|required ∩ used\|` with **unescaped** bars, which GitHub reads as cell delimiters and renders as a 9-cell row. Escaped to `\|`. Found by a scan of every table row in my four files for unescaped-pipe count mismatches against its header | ran — detector now reports 0 mismatches in all four files; other `\|` occurrences (e.g. the `int \| float` and `any \| null` unions) were already correct |

### 11.1 Root cause recorded for the anchor class (M1)

My first-pass anchors were derived from the *old* `check-docs.mjs` slug function, which used
`.replace(/\s+/g, '-')` (collapsing runs of whitespace). GitHub's `github-slugger@2.0.0` removes
punctuation **without collapsing the surrounding spaces**, then maps every single space to a
hyphen. Hence:

- `3.1 \`not_found\` — 404` → `31-not_found--404` (the em dash leaves two spaces → `--`),
- `3.1 \`GET /\`` → `31-get-` (the removed `/` leaves a trailing space → trailing `-`).

Rule for future writers: **generate anchors, never type them.**

### 11.2 Disputed at first, now resolved: the gate disagreed with `github-slugger` on `→`

Immediately after my anchor fixes, the gate still reported three BADANCH rows — none in my files.
I checked each against `github-slugger@2.0.0` and found them to be **gate false positives**, not
doc defects:

| Gate row (before) | My verdict |
|---|---|
| `05-guides/how-to/debug-a-failing-step.md:25 -> #6-decision-tree-symptom--cause--fix` | **gate was wrong.** `github-slugger@2.0.0` on `6. Decision tree: symptom → cause → fix` produces exactly `#6-decision-tree-symptom--cause--fix` (verified directly) |
| `06-reference/boolean-laws.md:28 -> #58-demorgan-and--de-morgans-andor` | **gate was wrong** — `github-slugger` has that anchor (verified `true`) |
| `06-reference/boolean-laws.md:29 -> #59-demorgan-or--de-morgans-orand` | same class (heading contains `OR→AND`) |

Root cause of the false positives: the gate's own punctuation class covered only
`U+2000–U+206F` and `U+2E00–U+2E7F`, not the arrows block `U+2190–U+21FF`, so it kept `→` in the
slug. Verified: that two-block class does not match `→` (U+2192). All three headings contain `→`.

**Resolved.** The gate now prefers the real `github-slugger` package when it can resolve it
(`check-docs.mjs:124-142`) and its fallback class has been widened to include `U+2190–U+21FF`
(plus `U+2300–U+23FF`, `U+25A0–U+27BF`, `U+3000–U+303F`) at `check-docs.mjs:150`. Re-run after
that change: **0 BADANCH, 0 BLOCKER, 0 MAJOR, 0 MINOR — `RESULT: PASS` suite-wide.**

### 11.3 Verification state after remediation

| Check | Result |
|---|---|
| Suite gate — BADANCH/BROKEN rows naming my files | **0** (and 0 suite-wide) |
| Suite gate — overall | `BLOCKER 0 · MAJOR 0 · MINOR 0 · NIT 0` → **`RESULT: PASS`** |
| In-page anchors, `github-slugger@2.0.0` | API 44/44, ERR 36/36 resolve |
| `json` fences parsing | 0 invalid (re-run after the M2/M5 edits) |
| Secret scan | clean for the suite (only the frozen `docs/context.md` legacy hits) |
