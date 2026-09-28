# Runbooks — operating Praxis when something breaks

**What this is:** a set of standard operating procedures (SOPs) for the failures Praxis actually
produces. Each runbook follows the same shape: **symptom → diagnosis → fix → verify**.

**Who it's for:** whoever is on call — including a teammate who has never debugged a deployment.
Commands are given for macOS/Linux (`bash`) and Windows (`powershell`) where they differ. Every
diagnosis step cites the code that decides the behaviour, so you can trust the procedure even when it
is months out of date.

**Prime directive:** change one thing at a time and verify after each change. Every runbook ends with
a check that either passes or tells you the next runbook to read.

## Contents

- [RB-01 · The backend will not start](#rb-01-the-backend-will-not-start)
- [RB-02 · Backend is up, but the frontend's API calls fail](#rb-02-backend-is-up-but-the-frontends-api-calls-fail)
- [RB-03 · `401 unauthorized` on progress routes](#rb-03-401-unauthorized-on-progress-routes)
- [RB-04 · `503 content_unavailable`](#rb-04-503-content_unavailable)
- [RB-05 · `502 upstream_error` from Supabase](#rb-05-502-upstream_error-from-supabase)
- [RB-06 · Database connection pressure and slow saves](#rb-06-database-connection-pressure-and-slow-saves)
- [RB-07 · Roll back a Render deploy](#rb-07-roll-back-a-render-deploy)
- [RB-08 · Back up and restore Supabase data](#rb-08-back-up-and-restore-supabase-data)
- [RB-09 · The deployed API is slow on the first request](#rb-09-the-deployed-api-is-slow-on-the-first-request)
- [RB-10 · Find the cause with structured logs](#rb-10-find-the-cause-with-structured-logs)
- [RB-11 · Roll back a Vercel deploy](#rb-11-roll-back-a-vercel-deploy)
- [RB-12 · Rotate a leaked Supabase key](#rb-12-rotate-a-leaked-supabase-key)
- [Escalation and evidence checklist](#escalation-and-evidence-checklist)

---

## RB-01: The backend will not start

**Severity:** blocks all local development.

### Symptom

`uvicorn main:app` exits immediately, or the process starts and every request fails. The two
distinct messages are:

```text
RuntimeError: Missing required environment variable: SUPABASE_URL. Set it in backend/.env (local) or in the deployment environment.
```

```text
[Errno 98] Address already in use
```

### Diagnosis

**Case A — `RuntimeError: Missing required environment variable`.** This is not a networking problem.
`backend/config/settings.py:74-75` builds the settings singleton at import time, and
`Settings.from_env` calls `require_env` (`backend/config/settings.py:56-63`, `:30-38`). The failure
happens before any route is registered, so even `GET /api/levels` — which reads a local JSON file and
needs no database — cannot answer.

Confirm the file exists and is where the code looks:

**macOS / Linux:**

```bash
ls -l backend/.env
python3 -c "from pathlib import Path; print(Path('backend/.env').resolve())"
```

**Windows (PowerShell):**

```powershell
Get-Item backend\.env
Resolve-Path backend\.env
```

**Case B — port already in use.** Find the process holding port 8000:

**macOS / Linux:**

```bash
lsof -i :8000        # macOS
ss -ltnp | grep :8000  # Linux
```

**Windows (PowerShell):**

```powershell
Get-NetTCPConnection -LocalPort 8000 | Select-Object LocalAddress, OwningProcess
Get-Process -Id (Get-NetTCPConnection -LocalPort 8000).OwningProcess
```

**Case C — a `ModuleNotFoundError`** (`fastapi`, `dotenv`, `httpx`) means the virtual environment is
not active. See [installation-manual.md](installation-manual.md) Stage 3.

### Fix

- **Case A:** create `backend/.env` with `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` —
  [configuration-guide.md](configuration-guide.md) §3, or [installation-manual.md](installation-manual.md)
  Stage 2 for per-OS creation commands. `backend/.env` is loaded by absolute path
  (`backend/config/settings.py:19`), so an env file in the repository root is **not** a substitute.
- **Case B:** stop the other process, or run on another port:
  `uvicorn main:app --reload --port 8001` and point the SPA at it with `VITE_API_TARGET`
  ([configuration-guide.md](configuration-guide.md) §8.2).
- **Case C:** activate the venv (`. .\venv\Scripts\Activate.ps1`, `venv\Scripts\activate.bat`,
  `source venv/bin/activate`) and re-run `pip install -r requirements.txt`.

### Verify

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8000/
```

Expected `200`. Then confirm the body is exactly:

```json
{"message":"Praxis API is running","docs":"/docs"}
```

If the process is up but `GET /api/levels` returns `503`, you have a different problem:
[RB-04](#rb-04-503-content_unavailable).

---

## RB-02: Backend is up, but the frontend's API calls fail

**Severity:** the SPA loads but shows "Could not reach the Praxis server." or empty content.

### Symptom

- The browser shows the app shell, then a toast/error such as
  `Could not reach the Praxis server.` (the exact message comes from
  `frontend/src/services/apiClient.js:70`).
- Or the browser console contains a CORS error mentioning an origin.
- Or `/api/levels` opened directly in the browser tab returns **HTML**, not JSON.

### Diagnosis

Work outward from the browser:

1. **Is the backend answering at all?** In a terminal:

   ```bash
   curl -s http://127.0.0.1:8000/api/levels | head -c 80
   ```

   - JSON envelope → the backend is fine; the problem is between browser and backend.
   - Connection refused → go back to [RB-01](#rb-01-the-backend-will-not-start).

2. **Is the Vite proxy pointing at the right place?** `frontend/vite.config.js:8` reads
   `VITE_API_TARGET` and defaults to `http://127.0.0.1:8000`; the `/api` proxy is defined at
   `frontend/vite.config.js:30-33`. Test the proxy path the browser uses:

   ```bash
   curl -s http://localhost:5173/api/levels | head -c 80
   ```

   - Envelope JSON → the proxy works; the failure is CORS or the frontend's own state.
   - The SPA's HTML → the proxy is not matching, usually because the dev server was started with a
     different `VITE_API_TARGET` or the backend is on another port.
   - HTML for a path starting with `/api/auth/` → you hit the dead Better Auth proxy
     (`frontend/vite.config.js:24-28`, port 3001, nothing listening). Use a path that does not begin
     with `/api/auth`.

3. **Is it CORS?** CORS applies only when browser origin ≠ API origin. With the Vite proxy the call is
   same-origin, so CORS failures usually mean you disabled the proxy, served the SPA on another port
   (`npm run preview` uses 4173), or you are calling the deployed API from a local page. Check the
   allow-list the backend actually built:

   ```bash
   curl -s -D - -o /dev/null -H 'Origin: http://localhost:5173' \
     http://127.0.0.1:8000/api/levels | grep -i access-control-allow-origin
   ```

   Expected: `access-control-allow-origin: http://localhost:5173`. No header means the origin is not
   in `settings.cors_origins` (`backend/config/settings.py:23-27`, `:66-71`).

   In production, check the same thing against the Render host, using the exact browser origin
   (including scheme, and with no trailing slash).

4. **Is the Vercel rewrite intact in production?** `frontend/vercel.json:3-6` proxies `/api/*` to the
   Render host. Verify the live rewrite:

   ```bash
   curl -s -o /dev/null -w '%{http_code} %{content_type}\n' https://praxis-seven-puce.vercel.app/api/levels
   ```

   Expected `200 application/json`. HTML here means the rewrite is missing or pointing at a dead
   host — fix `frontend/vercel.json` and redeploy the SPA.

### Fix

| Cause | Fix |
|---|---|
| Backend not running | [RB-01](#rb-01-the-backend-will-not-start) |
| Wrong `VITE_API_TARGET` | restart `npm run dev` with the correct value (§5.1 of [configuration-guide.md](configuration-guide.md)) |
| Origin missing from CORS | add it to `FRONTEND_URL` (local `backend/.env`, production `render.yaml:11`) and restart/redeploy |
| `/api/auth/*` request | remove the call — that endpoint has never existed |
| Production rewrite broken | edit `frontend/vercel.json:3-6`, redeploy Vercel |

### Verify

1. `curl -s http://localhost:5173/api/levels` returns the envelope.
2. In the browser, hard-reload <http://localhost:5173>, sign in, land on `/levels`, and confirm the
   Network tab shows `200` for `/api/levels`.
3. No red CORS line in the console.

---

## RB-03: `401 unauthorized` on progress routes

**Severity:** learners cannot save or load progress; scoring still works.

### Symptom

`GET /api/progress` or `POST /api/progress/save` returns:

```json
{"success":false,"data":null,"error":{"code":"unauthorized","message":"Not authenticated","detail":null}}
```

or, when a token was supplied but rejected:

```json
{"success":false,"data":null,"error":{"code":"unauthorized","message":"Invalid session","detail":null}}
```

### Diagnosis

Two different messages, two different causes:

| Message | Raised at | Meaning |
|---|---|---|
| `Not authenticated` | `backend/core/security.py:21-22` | No `Authorization: Bearer …` header at all, or malformed. |
| `Invalid session` | `backend/core/security.py:31-32` | Header present, but Supabase's `/auth/v1/user` did not return `200` (`backend/supabase_client.py:96-98`). |

Steps:

1. **Reproduce without the browser** using the shape the SPA sends:

   ```bash
   curl -s http://127.0.0.1:8000/api/progress
   # → 401 Not authenticated (expected with no header; proves the route is alive)
   ```

2. **Check whether the SPA is attaching a token.** `frontend/src/services/apiClient.js:27-31` reads
   `supabase.auth.getSession()` and adds `Authorization: Bearer <access_token>`. If the session is
   missing, no header is sent. In the browser console:

   ```js
   await window.__supabaseDebug?.auth.getSession?.()
   ```

   (There is no debug handle in the app; instead open **DevTools → Application → Local Storage** and
   look for a key starting with `sb-`, or simply sign out and sign in again.)

3. **Test a token directly** — replace `<token>` with a real Supabase access token copied from the
   Network tab of a signed-in browser session:

   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' \
     -H 'Authorization: Bearer <token>' http://127.0.0.1:8000/api/progress
   ```

   `200` → backend and Supabase agree; the SPA is failing to send the token.
   `401` with `Invalid session` → the token is expired, or the backend's Supabase project differs
   from the frontend's. Compare `SUPABASE_URL` (`backend/.env`) with `VITE_SUPABASE_URL`
   (`frontend/.env.local`) — they must be the same project.

4. **Time-based cause:** access tokens expire (Supabase refreshes them automatically while the SPA is
   open and the refresh token is valid). A long-idle tab can hold a stale token; a hard reload usually
   refreshes it. If the learner is signed out entirely, they never get past `ProtectedRoute`
   (`frontend/src/components/ProtectedRoute.jsx:27-29`).

### Fix

| Cause | Fix |
|---|---|
| No token in request | sign in again; if the session cannot be created, see [RB-02](#rb-02-backend-is-up-but-the-frontends-api-calls-fail) and the Supabase env vars |
| Expired token | reload the SPA (Supabase refreshes on demand) |
| Frontend and backend point at different Supabase projects | make `VITE_SUPABASE_URL` and `SUPABASE_URL` identical, then restart both |
| Backend key rotated but not updated | update `SUPABASE_SERVICE_KEY` in `backend/.env` / Render and restart (see [RB-12](#rb-12-rotate-a-leaked-supabase-key)) |
| Token looks valid but rejected | confirm the project is not paused in the Supabase dashboard, then retry |

### Verify

```bash
curl -s -H 'Authorization: Bearer <token>' http://127.0.0.1:8000/api/progress
```

Expected: `200` with a `data` object containing `points`, `streak`, `bestStreak`, `stageProgress`,
`stageScores` (`backend/services/progress_service.py:44-50`).

Then, in the browser: complete one stage and confirm `POST /api/progress/save` returns
`{"success":true,"data":{"status":"ok"},"error":null}`.

---

## RB-04: `503 content_unavailable`

**Severity:** content routes dead; scoring dead; the health probe still answers.

### Symptom

`GET /api/levels`, `GET /api/levels/{id}`, `GET /api/laws` or `POST /api/score` returns:

```json
{"success":false,"data":null,"error":{"code":"content_unavailable","message":"Game content is unavailable","detail":"Game content is missing or unreadable: /…/content/levels.json. The content/ directory must be shipped alongside the backend."}}
```

Meanwhile `GET /` still returns `200` — verified by deleting `content/` from a test copy and probing
both routes.

### Diagnosis

The `detail` field contains the **exact absolute path** the process tried to open. Read it:

```
…/Praxis/content/levels.json       → the repo-level content/ directory is missing or empty
…/backend/content/levels.json      → you deployed only backend/ (see below)
```

The path comes from `backend/repositories/content_repository.py:16`:

```python
CONTENT_DIR = Path(__file__).resolve().parents[2] / "content"
```

`parents[2]` from `backend/repositories/content_repository.py` is the **repository root**. So the rule
is: `<repo>/content/{laws.json,levels.json}` must exist next to `backend/`.

Check it:

**macOS / Linux:**

```bash
ls -l content/laws.json content/levels.json
```

**Windows (PowerShell):**

```powershell
Get-Item content\laws.json, content\levels.json
```

On the deployed service, the same failure happens if the deploy uploaded only the `backend` directory
— Render's `rootDir: backend` (`render.yaml:8`) changes the working directory, **not** the clone: the
whole repository is present, so `content/` resolves normally. A managed deploy that copies only
`backend/` will 503 on every content route.

### Fix

- **Missing directory:** restore it from git — `git checkout -- content/` (or `git restore content/`).
- **Truncated/corrupt JSON:** the loader catches `json.JSONDecodeError` too
  (`backend/repositories/content_repository.py:24`), so a broken file surfaces as the same 503.
  Validate it:

  ```bash
  python -c "import json; d=json.load(open('content/levels.json')); print([(l['id'], len(l['puzzles'])) for l in d])"
  ```

  Expected: `[(0, 4), (1, 12), (2, 12), (3, 12)]`.
- **Deployment missing content:** fix the deploy to include the repository root, then restart.

**Restart the backend afterwards.** Both loaders are cached — `functools.lru_cache`
(`backend/repositories/content_repository.py:34-43`) — so a fixed file is not re-read by a running
process even with `--reload` (which watches Python files, not JSON).

### Verify

```bash
curl -s http://127.0.0.1:8000/api/levels | head -c 60
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8000/api/laws
```

Expected: the envelope starting `{"success":true,"data":[{"id":0,…` and `200`.

---

## RB-05: `502 upstream_error` from Supabase

**Severity:** auth and progress broken; content and scoring still work.

### Symptom

```json
{"success":false,"data":null,"error":{"code":"upstream_error","message":"Authentication service is unavailable","detail":"…"}}
```

or `"Progress storage is unavailable"`, always with HTTP `502`.

### Diagnosis

`upstream_error` is raised in exactly two places, both from an `httpx` transport failure:

| Message | Raised at | Called from |
|---|---|---|
| `Authentication service is unavailable` | `backend/core/security.py:28-29` | `GET/POST /api/progress*`, and `POST /api/score` when a token is present |
| `Progress storage is unavailable` | `backend/repositories/progress_repository.py:25-26` | every Supabase PostgREST call |

The `detail` field carries the httpx exception text (`str(exc)`), which tells you whether it was DNS,
a connect timeout, or TLS.

Check, in order:

1. **Is the Supabase URL reachable from the machine that runs the backend?**

   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' https://<project-ref>.supabase.co/auth/v1/health
   ```

   Anything other than a connection error means the network is fine.

2. **Is the project paused?** Supabase pauses inactive free projects after a period of inactivity.
   The dashboard shows a "Paused"/"Restore" state for the project. Confirm there rather than
   inferring from the API.
3. **Is the key still valid?** A revoked service key yields `401` from Supabase, which
   `response.raise_for_status()` (`backend/supabase_client.py:80`) turns into an `httpx.HTTPStatusError`
   — also an `httpx.HTTPError`, therefore also a `502 upstream_error`. Check the dashboard key value
   against `backend/.env`.
4. **Is it a DNS/IPv6 issue?** Classic on some hosts: the URL resolves over IPv6 that the container
   cannot route. Compare `curl -4` and `curl -6` against the project host.

### Fix

| Cause | Fix |
|---|---|
| Project paused | restore it in the Supabase dashboard |
| Key revoked/rotated | update `SUPABASE_SERVICE_KEY` (`backend/.env`, Render dashboard) and restart/redeploy — [RB-12](#rb-12-rotate-a-leaked-supabase-key) |
| Supabase outage | check Supabase status; nothing to fix locally — the backend is behaving correctly by returning 502 |
| Network/DNS | fix egress (firewall, IPv6); for a self-hosted environment allow `https://<project-ref>.supabase.co:443` |

### Verify

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8000/api/progress
```

Expected `401` (not `502`) — that proves the backend reached Supabase and rejected the missing token
for the right reason. Then repeat RB-03's token check for a full pass.

---

## RB-06: Database connection pressure and slow saves

**Severity:** latency, not correctness.

### Symptom

- Requests to `/api/progress/save` or `POST /api/score` take seconds and the whole service feels slow
  (all routes, not just progress).
- Render logs show `duration_ms` climbing from single digits into the thousands
  (`backend/core/middleware.py:47-57`).
- Supabase logs show a burst of PostgREST requests per learner action.

### Diagnosis

Understand the access pattern before blaming Postgres:

1. **Every query is a new HTTP client.** `SupabaseRESTClient.QueryBuilder.execute()` opens a fresh
   synchronous `httpx.Client()` per call (`backend/supabase_client.py:69`) and the repository issues
   one request per operation (`backend/repositories/progress_repository.py:29-73`).
2. **That synchronous I/O runs inside `async def` routes.** The route functions are `async`
   (`backend/api/routes/progress.py:21`, `:27`) but call synchronous code, so a slow Supabase response
   **blocks the event loop** — that is why *all* routes slow down together, not just progress.
3. **One save can be dozens of round trips.** `save_progress` performs one upsert for the totals row
   and then **one upsert per completed stage**, sequentially
   (`backend/services/progress_service.py:63-84`). With all 40 stages complete, that is up to 41
   blocking round trips for a single save.
4. **`POST /api/score` writes twice more**: one insert into `score_history`, plus a `get_best_score`
   read and possibly a `stage_progress` upsert, all inside the background task
   (`backend/services/progress_service.py:87-127`).

Count the evidence rather than guessing. In the backend log, look at `duration_ms` for
`/api/progress/save`; multiply by the round trips above and compare with your measured Supabase
latency:

```bash
curl -s -o /dev/null -w 'supabase rtt: %{time_total}s\n' https://<project-ref>.supabase.co/auth/v1/health
```

A 300 ms round trip × 41 requests ≈ 12 s — and every other learner waits behind it.

### Fix

Short term (operational):

- Reduce the fan-out: the debounce in the SPA already coalesces saves
  (`frontend/src/config/gameRules.js:67-68`, `TIMING.progressSaveDebounceMs = 500`); do not lower it.
- If Supabase is slow, treat it as the incident ([RB-05](#rb-05-502-upstream_error-from-supabase))
  and consider temporarily raising the Render instance above the free plan so slow requests at least
  do not queue behind a sleeping instance.
- On the Supabase side, check the project's connection/pooler metrics in the dashboard. PostgREST
  handles connectivity; there is no local pool to tune in this codebase.

Structural fixes (require code changes, listed here so the runbook is honest about root cause):

- Batch `save_progress` into one upsert per table instead of one per stage.
- Move the synchronous Supabase calls off the event loop (`anyio.to_thread.run_sync` or an async
  client).
- The current cost of these is documented as a known limitation in
  [known-limitations.md](../07-explanation/known-limitations.md).

### Verify

After any change, compare before/after medians from the logs (see
[RB-10](#rb-10-find-the-cause-with-structured-logs)):

```bash
# local: count slow requests
grep '"path": "/api/progress/save"' backend.log | python3 -c "
import sys, json
d=[json.loads(l)['duration_ms'] for l in sys.stdin if l.strip()]
d.sort()
print('n=',len(d),'median=',d[len(d)//2] if d else None,'max=',d[-1] if d else None)
"
```

Success criterion: `POST /api/progress/save` median `duration_ms` under ~500 ms locally against a
healthy Supabase, and no visible slowdown of unrelated routes while a save is in flight.

---

## RB-07: Roll back a Render deploy

**Severity:** release incident.

### Symptom

A freshly deployed backend is broken: `5xx` responses, failed boot, missing data, or responses that
contradict the repository (see [deployment.md](deployment.md) §8).

### Diagnosis

1. Confirm the failure is deploy-related, not environmental: if `GET /` fails, the service is not
   running at all; if only Supabase-backed routes fail, read [RB-05](#rb-05-502-upstream_error-from-supabase)
   first — rolling back will not fix a paused project.
2. Identify the last good revision in the Render dashboard: **service → Events** lists every deploy
   with its commit SHA, timestamps and status, and **Logs** shows the boot sequence for each.
3. Capture evidence before you change anything: the failing response body, the `x-request-id` header,
   and the matching log line ([RB-10](#rb-10-find-the-cause-with-structured-logs)).

### Fix

1. Render dashboard → your service → **Events** (or **Deploys**).
2. Find the last known-good deploy.
3. Use **Redeploy** (rebuilds that commit) or **Rollback** if offered for that entry, and confirm.
4. Wait for `==> Your service is live 🎉` and `Application startup complete.` in the logs.

Note: a rollback reverts **code**, not environment variables. If the incident was caused by a changed
`SUPABASE_URL`/`SUPABASE_SERVICE_KEY`, fix the variable instead — rolling back the code will not help.
Likewise, a content regression is not fixed by a backend rollback unless the content files are part
of that rolled-back commit; and because content is cached per process
(`backend/repositories/content_repository.py:34-43`), a restart is always required.

### Verify

```bash
API=https://praxis-backend-5302.onrender.com
curl -s "$API/"
curl -s "$API/api/levels" | head -c 60
curl -s -o /dev/null -w '404: %{http_code}\n' "$API/api/levels/999"
curl -s -o /dev/null -w '401: %{http_code}\n' "$API/api/progress"
```

Expected: the plain health message, the content envelope, `404`, `401`. Then run the full checklist in
[deployment.md](deployment.md) §6.

---

## RB-08: Back up and restore Supabase data

**Severity:** data-loss prevention / recovery.

### What is at risk

Only three tables hold learner state (`database/init.sql`):

| Table | Holds | Loss impact |
|---|---|---|
| `user_progress` | points, streak, best streak | learner sees points reset to 0 |
| `stage_progress` | per-stage completion and best score | level gates re-lock; stars disappear |
| `score_history` | the append-only score log | history lost; current best scores survive in `stage_progress` |

Everything else — laws, levels, puzzles, the engine, the UI — is code or JSON in git and needs no
backup.

### Diagnosis (know what your plan gives you)

Open the Supabase dashboard → **Database → Backups**. What you see there (daily backups, point-in-time
recovery, retention window) depends entirely on the project's plan; **verify it in the dashboard
rather than assuming**, because this repository contains no backup configuration.

A second, plan-independent fact matters for recovery: `stage_progress` has a `UNIQUE(user_id, level_id,
stage_idx)` constraint and the app upserts on exactly those columns
(`backend/repositories/progress_repository.py:18`, `:62-68`), so re-creating the tables never
duplicates a row.

### Fix

**Option A — restore from a dashboard backup (preferred if available).** Dashboard → **Database →
Backups** → choose the backup → restore. This restores the whole database, including `auth.users`.
Coordinate first: restoring rewinds *all* learners to that point.

**Option B — logical export of the three tables.** In **SQL Editor**, export to CSV via the Table
Editor's download button, or capture SQL:

```sql
-- Run per table; copy the result to a file you keep outside the project.
select * from user_progress order by user_id;
select * from stage_progress order by user_id, level_id, stage_idx;
select * from score_history order by created_at desc limit 1000;
```

**Option C — rebuild from scratch.** `database/init.sql` is idempotent
(`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`), so running it again is always safe:
it recreates anything missing and never drops a table. Use it after an accidental `DROP`, then restore
rows from an export.

**Option D — restore a single learner.** Find the user id, then re-insert only their rows:

```sql
select id, email, created_at from auth.users where email = '<learner-email>';
```

Then delete and re-play their stages (see
[reset-user-progress.md](../05-guides/how-to/reset-user-progress.md) for the delete SQL and the
important warning about the frontend's merge rule).

> ⚠️ **The client merges, it does not overwrite.** `mergeServerProgress` takes the **maximum** of
> local and server `points`/`bestStreak` and unions completed stages
> (`frontend/src/state/progressStore.js:96-130`). Clearing the database alone will therefore *not*
> reset a learner whose browser still holds the local snapshot — and clearing the browser alone will
> not reset them either, because the next hydration pulls the server values back. Reset both layers,
> as described in [reset-user-progress.md](../05-guides/how-to/reset-user-progress.md).

### Verify

```sql
select
  (select count(*) from user_progress)  as users,
  (select count(*) from stage_progress) as stage_rows,
  (select count(*) from score_history)  as attempts;
```

Then, in the browser, sign in as one learner and confirm the points chip and unlocked levels match
what you restored. Finally run [deployment.md](deployment.md) §6's `401`/`200` checks.

---

## RB-09: The deployed API is slow on the first request

**Severity:** cosmetic until it looks like an outage.

### Symptom

The first request to the Render URL after a quiet period takes tens of seconds; the next ones are
fast. Measured on the live service: **22.08 s** for the first `GET /`, then sub-second responses.

### Diagnosis

`render.yaml:5` sets `plan: free`. Free instances sleep when idle and cold-start on the next request.
There is nothing wrong with the application:

- `GET /` returns `200` with the expected plain body (`backend/api/routes/health.py:15-18`).
- The delay happens before any application log line for that request appears — check Render's logs;
  the `praxis.request` line for the request shows a normal `duration_ms` once the process is up.

To distinguish "asleep" from "broken":

```bash
curl -s -m 60 -o /dev/null -w 'first:  %{http_code} in %{time_total}s\n' https://praxis-backend-5302.onrender.com/
curl -s -m 10 -o /dev/null -w 'second: %{http_code} in %{time_total}s\n' https://praxis-backend-5302.onrender.com/
```

A cold start shows a large first time and a small second time. A real outage shows a connection error
or a `5xx` that persists on retry.

### Fix

- Accept it for a demo environment.
- Or warm the service before a demo: hit `GET /` a minute beforehand.
- Or upgrade the Render plan to keep the instance running.
- Or add an external uptime monitor pinging `GET /` every 5–10 minutes — see
  [monitoring.md](monitoring.md) for the recommended criteria (and note that a pinger is also the
  cheapest cold-start mitigation).

**Do not** "fix" this by pointing the SPA somewhere else, and do not add retries inside the SPA: the
fetch path is deliberately single-shot (`frontend/src/services/apiClient.js:56-74`), and the UI already
degrades gracefully (`silent: true` on progress calls).

### Verify

Two consecutive requests, as above: the second should complete in well under a second and return
`200`.

---

## RB-10: Find the cause with structured logs

**Severity:** diagnostic technique — use it inside every other runbook.

### What the logs look like

The backend configures one JSON object per line on **stdout** (`backend/core/logging.py:34-66`). Keys
are fixed plus merged request fields:

| Key | Source | Example |
|---|---|---|
| `ts` | `backend/core/logging.py:39-41` | `2026-09-28T05:39:53.501Z` |
| `level` | `logging.LogRecord.levelname` | `INFO`, `ERROR` |
| `logger` | module name | `praxis.request`, `praxis.api` |
| `message` | the log call | `request completed` |
| `request_id` | context variable | `e15778ac9dd946f5b44d85d6197b9d4c` |
| merged fields | `log_fields(...)` | `method`, `path`, `status`, `duration_ms`, `code` |
| `exception` | present only on tracebacks | multi-line traceback string |

A real access-log line, exactly as emitted:

```json
{"ts": "2026-09-28T05:39:53.501Z", "level": "INFO", "logger": "praxis.request", "message": "request completed", "request_id": "b923a6d9ddfa4ef887b28e12486ecad4", "method": "GET", "path": "/", "status": 200, "duration_ms": 0.75}
```

An application error line, from a `503` (`backend/main.py:39-47`):

```json
{"ts": "2026-09-28T05:39:53.504Z", "level": "ERROR", "logger": "praxis.api", "message": "application error", "request_id": "b2d7ef5a130e48c88c18ce2b6c4465d2", "code": "content_unavailable", "status": 503, "path": "/api/levels"}
```

### Correlating a request

`RequestContextMiddleware` echoes `X-Request-ID` when the caller supplies one, otherwise generates a
`uuid4().hex` (`backend/core/middleware.py:27`), binds it to the request context so every log line of
that request carries it, and returns it in the response header
(`backend/core/middleware.py:61`).

So: capture the header, then search the logs for the same value.

```bash
# 1. Make a request and capture its id
curl -s -D - -o /dev/null http://127.0.0.1:8000/api/levels | grep -i x-request-id

# 2. Find every line for that request in a local log file
grep '<request-id>' backend.log
```

**Windows (PowerShell):**

```powershell
curl.exe -s -D - -o NUL http://127.0.0.1:8000/api/levels | Select-String -Pattern 'x-request-id'
Select-String -Path backend.log -Pattern '<request-id>'
```

In the **Render dashboard**, paste the request id into the log search box; Render filters stdout lines,
so the id finds the whole request in one query.

### Useful local queries with `jq`

```bash
# every 5xx, newest last
jq -c 'select(.status >= 500)' backend.log

# name the slowest routes
jq -c 'select(.duration_ms > 1000) | {path, duration_ms}' backend.log

# count failures by error code
jq -r 'select(.code != null) | .code' backend.log | sort | uniq -c | sort -rn

# everything from the background persistence task
grep 'failed to save score to database' backend.log
```

Without `jq`, use Python (available wherever the backend runs):

```bash
python -c "
import json, sys, collections
c = collections.Counter()
for line in open('backend.log'):
    try: r = json.loads(line)
    except Exception: continue
    if r.get('status', 0) >= 500: c[(r.get('path'), r.get('status'))] += 1
print(c.most_common(10))
"
```

### Where to capture logs

- **Local:** the terminal running `uvicorn`. To keep them:
  `uvicorn main:app --port 8000 2>&1 | tee backend.log` (macOS/Linux);
  `uvicorn main:app --port 8000 *>&1 | Tee-Object backend.log` (PowerShell).
- **Render:** dashboard → service → **Logs** (the same JSON lines). See
  [monitoring.md](monitoring.md) for what to watch.
- **Supabase:** dashboard → **Logs** for PostgREST and Auth activity, independent of the backend's
  view.

### Verify

Pick any failing request you have a response body for, and confirm you can find its log line by
`request_id`. If you cannot, you are not looking at the right stream (stdout, not stderr, and not the
platform's build log).

---

## RB-11: Roll back a Vercel deploy

**Severity:** release incident (frontend only).

### Symptom

The deployed SPA is broken — blank page, `Failed to fetch` for a chunk, broken routing on deep links,
or a UI that disagrees with the deployed API.

### Diagnosis

1. Check whether the failure is routing: open a deep link directly
   (`https://praxis-seven-puce.vercel.app/levels`). A 404 means the SPA fallback rewrite
   (`frontend/vercel.json:7-10`) is missing.
2. Check whether the API rewrite works:
   `curl -s -o /dev/null -w '%{http_code}\n' https://praxis-seven-puce.vercel.app/api/levels` — `200`
   means `frontend/vercel.json:3-6` is intact.
3. Confirm the bad deploy in the Vercel dashboard under **Deployments** (each entry shows the commit
   and build log).

### Fix

1. Vercel dashboard → **Deployments**.
2. Find the last good deployment → **⋯ → Promote to Production** (or **Redeploy**).
3. Wait for the alias to update — Vercel serves the previous build instantly until the promotion
   completes.

Environment variables are **not** rolled back by this. If `VITE_SUPABASE_URL` or
`VITE_SUPABASE_PUBLISHABLE_KEY` changed, fix the variable and redeploy: Vite inlines them at build
time, so an existing deployment cannot pick up a new value.

### Verify

```bash
curl -s -o /dev/null -w 'SPA: %{http_code}\n' https://praxis-seven-puce.vercel.app/
curl -s https://praxis-seven-puce.vercel.app/api/levels | head -c 40
```

Expected `200` and the JSON envelope. Then load the SPA in a browser, sign in and open `/levels`.

---

## RB-12: Rotate a leaked Supabase key

**Severity:** security incident. Assume the leaked key has already been used.

### Symptom

`SUPABASE_SERVICE_KEY` (or the anon key) appeared in a commit, a screenshot, a chat log, a CI log or a
document. Note that `docs/context.md` §11 already contains a real publishable-key value in a tracked
file — treat that as known and do not reproduce it anywhere else.

### Diagnosis

1. Identify which key leaked. The two have very different blast radii:
   - **`service_role`** bypasses Row Level Security on every table in the project. Assume full
     read/write compromise. Rotate immediately.
   - **anon/publishable** is public by design — but with the current permissive policies
     (`database/init.sql:56-58`, `FOR ALL USING (true)`) it still grants read/write on the three
     application tables. Rotate as well, and understand that anon-key rotation breaks the deployed
     SPA until it is rebuilt.
2. Find every place the key is used before you rotate, or you will cause a self-inflicted outage:

   ```bash
   grep -rn "SUPABASE_SERVICE_KEY" --include='*.env' --include='*.yaml' --include='*.py' . | grep -v node_modules
   ```

   | Key | Places to update |
   |---|---|
   | `service_role` | `backend/.env`, Render dashboard (`SUPABASE_SERVICE_KEY`, `sync: false`) |
   | anon/publishable | `frontend/.env.local`, Vercel project env vars, then **rebuild** the SPA |

3. If the leak happened in a commit, remember that a history rewrite does not un-leak a key — rotation
   is the only real fix.

### Fix

1. Supabase dashboard → **Project Settings → API** → regenerate the affected key.
2. Update the places from the table above.
3. Restart the backend locally and redeploy it on Render; redeploy (not just re-promote) the SPA on
   Vercel so the new anon key is inlined.
4. Purge the value from documents in the repository (replace with `<service-role-key>` /
   `<anon-key>` placeholders) so the documentation gate stops flagging it.

### Verify

```bash
# 1. backend uses the new key and can reach Supabase:
curl -s -o /dev/null -w 'progress (expect 401): %{http_code}\n' \
  https://praxis-backend-5302.onrender.com/api/progress

# 2. the SPA can still sign in: load the site, sign in, confirm /api/progress returns 200
```

Then confirm the retired key no longer works:

```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  -H 'apikey: <old-key>' -H 'Authorization: Bearer <old-key>' \
  https://<project-ref>.supabase.co/rest/v1/user_progress?select=user_id&limit=1
```

Expected: `401`.

---

## Escalation and evidence checklist

Before escalating, collect:

1. **What changed** — last commit, last deploy (Render and Vercel), last environment-variable edit.
2. **The failing request** — method, path, status, and its `X-Request-ID` response header.
3. **The matching log line** — from the backend stdout stream ([RB-10](#rb-10-find-the-cause-with-structured-logs)).
4. **The response body** — the `{success,data,error}` envelope names the machine code
   (`not_found`, `content_unavailable`, `upstream_error`, `unauthorized`, `validation_error`,
   `http_error`, `internal_error` — `backend/core/errors.py:11-20`).
5. **Whether production matches the repo** — [deployment.md](deployment.md) §8.

Never paste a `SUPABASE_SERVICE_KEY`, an anon key, a JWT or a database password into a ticket. If a
response body contains one, redact it before sharing.

Related reading: [monitoring.md](monitoring.md) · [deployment.md](deployment.md) ·
[configuration-guide.md](configuration-guide.md) · [installation-manual.md](installation-manual.md) ·
[error codes reference](../06-reference/error-codes.md) ·
[reset-user-progress.md](../05-guides/how-to/reset-user-progress.md).
