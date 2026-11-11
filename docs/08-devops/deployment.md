# Deployment — how Praxis ships to production

**What this is:** the deployment reference for Praxis. It documents the *actual* two-platform
topology — a FastAPI service on Render and a static React SPA on Vercel, both talking to one hosted
Supabase project — plus the environment variables, the post-deploy verification checklist and the
drift checks that tell you production matches the repository.

**Who it's for:** the person who has to ship, verify or roll back a release. It assumes you have read
[installation-manual.md](installation-manual.md) (or already run the app locally) and that you have
access to the Render and Vercel dashboards.

**Read the truth, not the proposal.** [`docs/context.md`](../context.md) describes "Deploy — Render
(`render.yaml`)" as if one platform hosts everything. It does not: `render.yaml` contains **one**
service, the backend. See §1 and §10.

## Contents

1. [The deployed topology](#1-the-deployed-topology)
2. [What `render.yaml` actually declares](#2-what-renderyaml-actually-declares)
3. [Environment variables in production](#3-environment-variables-in-production)
4. [Deploying the backend to Render](#4-deploying-the-backend-to-render)
5. [Deploying the frontend to Vercel](#5-deploying-the-frontend-to-vercel)
6. [Post-deploy verification checklist](#6-post-deploy-verification-checklist)
7. [CORS in production](#7-cors-in-production)
8. [Drift check: is production the same code as the repo?](#8-drift-check-is-production-the-same-code-as-the-repo)
9. [Rollback](#9-rollback)
10. [Known discrepancies](#10-known-discrepancies)

---

## 1. The deployed topology

```
learner's browser
   │
   │  https://praxis-seven-puce.vercel.app          (static SPA, Vercel)
   ├───────────────► Vercel edge  ── rewrite /api/* ──► https://praxis-backend-5302.onrender.com
   │                                                       (FastAPI, Render, plan: free)
   │                                                            │
   └───────────────► https://<project-ref>.supabase.co           │ service_role key
                     Supabase Auth (sign-up / sign-in / JWT)     ▼
                     Supabase Postgres (user_progress,     Supabase REST  /rest/v1/*
                      stage_progress, score_history)       Supabase Auth  /auth/v1/user
```

Three facts that follow from this picture:

1. **The frontend is not deployed by Render.** `render.yaml` declares a single web service named
   `praxis-backend` (`render.yaml:2-8`). Nothing in that file builds or hosts the SPA.
2. **The SPA reaches the API through a Vercel rewrite**, `frontend/vercel.json:3-6`, which proxies
   `/api/(.*)` to `https://praxis-backend-5302.onrender.com/api/$1`. In production the browser calls
   its own origin, so the request is same-origin and no CORS preflight is involved (§7).
3. **Auth is Supabase Auth, end to end.** The SPA obtains a JWT directly from Supabase
   (`frontend/src/services/supabaseClient.js:5-10`); the backend validates it by calling Supabase's
   `/auth/v1/user` with the service key (`backend/supabase_client.py:87-98`,
   `backend/core/security.py:17-35`). There is no self-hosted auth service to deploy.

Colors and grey boxes for this diagram are supplied as Mermaid in the diagrams staging file
(`docs/_staging/diagram-input-devops-ops.md`); the published picture lives in
[DIAGRAMS.md](../09-diagrams/DIAGRAMS.md).

---

## 2. What `render.yaml` actually declares

The complete file (16 lines, quoted verbatim):

```yaml
services:
  - type: web
    name: praxis-backend
    env: python
    plan: free
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn main:app --host 0.0.0.0 --port $PORT
    rootDir: backend
    envVars:
      - key: FRONTEND_URL
        value: https://praxis-seven-puce.vercel.app
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_SERVICE_KEY
        sync: false
```

Field by field:

| Line | Field | Value | What it means |
|---|---|---|---|
| `render.yaml:2` | `type` | `web` | A public HTTP service (also what makes the free plan's spin-down behaviour apply). |
| `render.yaml:3` | `name` | `praxis-backend` | The Render service name; it determines the default `*.onrender.com` host. |
| `render.yaml:4` | `env` | `python` | Render's native Python runtime — no Docker image. |
| `render.yaml:5` | `plan` | `free` | Free instance: it sleeps when idle and cold-starts on the next request. |
| `render.yaml:6` | `buildCommand` | `pip install -r requirements.txt` | Runs **inside `rootDir`**, i.e. `backend/requirements.txt` — the real five-line dependency list. |
| `render.yaml:7` | `startCommand` | `uvicorn main:app --host 0.0.0.0 --port $PORT` | Binds all interfaces on the port Render injects as `$PORT`. |
| `render.yaml:8` | `rootDir` | `backend` | Build and start run from `backend/`, which is why `main:app` resolves. |
| `render.yaml:10-11` | `FRONTEND_URL` | literal `https://praxis-seven-puce.vercel.app` | Committed in git on purpose: it is a public origin, not a secret. |
| `render.yaml:12-13` | `SUPABASE_URL` | `sync: false` | Value supplied in the Render dashboard; never in git. |
| `render.yaml:14-15` | `SUPABASE_SERVICE_KEY` | `sync: false` | Same, but a secret that bypasses RLS. Treat it as the most sensitive value in the system. |

Two omissions that matter operationally:

- **No `healthCheckPath`.** `render.yaml` does not declare a health-check path, so Render's
  zero-downtime deploy behaviour is not tied to `GET /`. The endpoint exists and is described in
  code as the probe — `backend/api/routes/health.py:1-3` says "The `/` health probe — plain JSON,
  deliberately outside the envelope. Render reads this body verbatim" — but to make Render actually
  use it, add one line under `render.yaml:8`:

  ```yaml
      healthCheckPath: /
  ```

  Use `/`, never `/api/levels`. `/` is cheap, needs no database and no `content/` directory: verified
  with `content/` removed, `GET /` still answers `200` while `/api/levels` answers `503`.
- **No Python version pin.** The build uses Render's default Python. If you ever need to pin it, set
  a `PYTHON_VERSION` environment variable in the dashboard (see Render's native-runtime docs); the
  app itself needs **Python ≥ 3.10** because of the resolved FastAPI/uvicorn/starlette versions
  (see [installation-manual.md](installation-manual.md#21-required-software)).

The `rootDir: backend` line has one non-obvious consequence: `content/` is resolved from the
repository root, not from `backend/` — `CONTENT_DIR = Path(__file__).resolve().parents[2] / "content"`
(`backend/repositories/content_repository.py:16`). Render clones the whole repository and only
*executes* in `backend/`, so `<repo>/content/` is present and everything works. If you ever deploy
`backend/` as a standalone directory, every content route returns
`503 content_unavailable` ([runbooks.md](runbooks.md) RB-04).

---

## 3. Environment variables in production

| Variable | Where it is set | Value type | Consequence if wrong |
|---|---|---|---|
| `FRONTEND_URL` | `render.yaml:10-11` (in git) | public URL | The deployed SPA origin is missing from the CORS allow-list → cross-origin browser calls fail. It does **not** affect the Vercel rewrite path (§7). |
| `SUPABASE_URL` | Render dashboard (`sync: false`) | public URL | Backend cannot boot: `require_env` raises at import (`backend/config/settings.py:60`, `:74-75`). |
| `SUPABASE_SERVICE_KEY` | Render dashboard (`sync: false`) | **secret** | Same: boot failure. If it is a stale/revoked key, the app boots but every authenticated request 401s or 502s. |
| `PORT` | injected by Render | number | Do **not** set it by hand; `render.yaml:7` interpolates `$PORT`. |
| `PYTHON_VERSION` | optional, dashboard | e.g. `3.12.6` | Only needed if the default runtime is too old. |

Vercel side (see §5): `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. `VITE_API_TARGET` is a
**dev-server only** variable and has no effect on a Vercel build — production routing is decided by
`frontend/vercel.json`.

Full per-variable detail, including where to obtain each value and which file reads it, is in
[configuration-guide.md](configuration-guide.md).

> 🔐 `SUPABASE_SERVICE_KEY` bypasses Row Level Security. It belongs in exactly two places: your local
> `backend/.env` and the Render dashboard. Never in `render.yaml`, never in a `VITE_*` variable,
> never in a document or a screenshot.

---

## 4. Deploying the backend to Render

### 4.1 First-time setup from the blueprint

1. Push the repository to GitHub (the service name in `render.yaml` is `praxis-backend`).
2. In the Render dashboard choose **New → Blueprint**, select the repository, and confirm.
3. Render reads `render.yaml` and creates the single service.
4. Fill in the two `sync: false` variables — `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` — from your
   Supabase project's **Project Settings → API** page.
5. Trigger the first deploy and wait for `Application startup complete.` in the logs.

`FRONTEND_URL` needs no action: it is committed as a literal.

### 4.2 Creating the service by hand instead

If you cannot use a blueprint, replicate the same five settings exactly:

| Render field | Value |
|---|---|
| Environment | Python |
| Root Directory | `backend` |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| Instance type | Free |
| Environment variables | `FRONTEND_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (as above) |

### 4.3 Subsequent deploys

Render redeploys on every push to the tracked branch, using the same build and start commands. The
sequence visible in the log is:

```text
==> Cloning from https://github.com/<owner>/<repo>
==> Running build command 'pip install -r requirements.txt'...
Successfully installed fastapi-… uvicorn-… httpx-… python-dotenv-… python-multipart-…
==> Running 'uvicorn main:app --host 0.0.0.0 --port $PORT'
INFO:     Started server process [1]
INFO:     Application startup complete.
==> Your service is live 🎉
```

Because `backend/requirements.txt` has **no version pins**, the `pip install` line is the one place
where a no-code-change deploy can still alter behaviour: a newer FastAPI can be pulled in by a
rebuild. When comparing a "it broke by itself" incident, read the installed versions off that log
line first — see [monitoring.md](monitoring.md).

### 4.4 What a successful boot proves — and what it does not

The import-time singleton means a boot that reaches `Application startup complete.` proves that
`SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are both present and non-empty
(`backend/config/settings.py:74-75`). It proves nothing about whether they are *correct*, whether the
tables exist, or whether `content/` is present. Those need §6.

---

## 5. Deploying the frontend to Vercel

The frontend is deployed separately. The evidence in the repository:

- `frontend/vercel.json` exists (Vercel project config);
- `render.yaml:11` sets `FRONTEND_URL: https://praxis-seven-puce.vercel.app`, i.e. the backend's
  documented frontend origin is a Vercel domain;
- §1 fact 1: `render.yaml` has no frontend service.

### 5.1 `frontend/vercel.json`, line by line

```json
{
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "https://praxis-backend-5302.onrender.com/api/$1"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

| Lines | Rule | Why it exists |
|---|---|---|
| `frontend/vercel.json:3-6` | `/api/*` → the Render host | The SPA calls relative `/api/...` paths (`frontend/src/services/apiClient.js:56-67`), so the edge proxies them to the backend. No CORS preflight, and the backend host is never hardcoded in JavaScript. |
| `frontend/vercel.json:7-10` | everything else → `/index.html` | SPA fallback. React Router owns `/levels`, `/sandbox/play`, … (`frontend/src/App.jsx:30-57`); without this rewrite a hard refresh on a deep link would 404. |

Because the destination is hardcoded, **renaming or moving the Render service breaks production
routing**, and the fix is a one-line edit here plus a Vercel redeploy.

### 5.2 Project settings (dashboard, not in the repository)

These are Vercel project settings. They are not stored in this repository, so treat them as
configuration to confirm rather than facts you can read from the code:

| Setting | Expected value | Reason |
|---|---|---|
| Root Directory | `frontend` | `package.json`, `vercel.json` and `index.html` all live there. |
| Framework preset | Vite | Produces the build/output defaults below. |
| Build Command | `npm run build` | `frontend/package.json:8`. |
| Output Directory | `dist` | Vite's default; the local build writes `dist/index.html` plus `dist/assets/*`. |
| Install Command | `npm install` (or `npm ci`) | Lockfile v3 is committed. |
| Environment variables | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Read at build time by `frontend/src/services/supabaseClient.js:7-8`. |

> **Vite variables are baked in at build time.** Changing `VITE_SUPABASE_URL` in the Vercel dashboard
> does nothing until the project is redeployed; and because only `VITE_`-prefixed variables reach the
> bundle, a variable named `SUPABASE_URL` would be silently invisible to the SPA.

The Vite build must also be able to read `<repo>/content/` at build time: `frontend/vite.config.js:16`
aliases `@content` to `../content`, and `frontend/vite.config.js:22` widens `server.fs.allow` to the
repository root. On Vercel, Root Directory `frontend` still sits inside the full clone, so the parent
`content/` directory is present — do not "clean up" the deployment by uploading only `frontend/`.

---

## 6. Post-deploy verification checklist

Run these in order after every backend or frontend deploy. Replace `$API` with your Render URL and
`$WEB` with your Vercel URL.

**macOS / Linux (bash):**

```bash
API=https://praxis-backend-5302.onrender.com
WEB=https://praxis-seven-puce.vercel.app

# 1. liveness — plain JSON, no envelope
curl -s -o /dev/null -w '%{http_code} %{time_total}s\n' "$API/"
curl -s "$API/"

# 2. content routes — must be the {success,data,error} envelope
curl -s "$API/api/levels" | head -c 200
curl -s "$API/api/laws" | head -c 200

# 3. error envelope + status codes
curl -s -o /dev/null -w '404 check: %{http_code}\n' "$API/api/levels/999"
curl -s -o /dev/null -w '401 check: %{http_code}\n' "$API/api/progress"

# 4. scoring works signed-out and needs no database write
curl -s -X POST "$API/api/score" -H 'Content-Type: application/json' \
  -d '{"levelId":1,"stageIdx":0,"stepsUsed":1,"lawsUsed":["absorption"],"hintsUsed":0}' \
  | head -c 300

# 5. the SPA is served and its API rewrite reaches the backend
curl -s -o /dev/null -w 'SPA: %{http_code}\n' "$WEB/"
curl -s "$WEB/api/levels" | head -c 120
```

**Windows (PowerShell):**

```powershell
$API = 'https://praxis-backend-5302.onrender.com'
$WEB = 'https://praxis-seven-puce.vercel.app'

# 1. liveness
curl.exe -s "$API/"

# 2. content routes
curl.exe -s "$API/api/levels" | Select-Object -First 1

# 3. status codes
curl.exe -s -o NUL -w "404 check: %{http_code}`n" "$API/api/levels/999"
curl.exe -s -o NUL -w "401 check: %{http_code}`n" "$API/api/progress"

# 4. scoring (signed-out)
curl.exe -s -X POST "$API/api/score" -H "Content-Type: application/json" -d '{\"levelId\":1,\"stageIdx\":0,\"stepsUsed\":1,\"lawsUsed\":[\"absorption\"],\"hintsUsed\":0}'

# 5. SPA + rewrite
curl.exe -s -o NUL -w "SPA: %{http_code}`n" "$WEB/"
curl.exe -s "$WEB/api/levels" | Select-Object -First 1
```

| # | Check | Pass criterion | Verified sample |
|---|---|---|---|
| 1 | `GET /` | `200`, body exactly `{"message":"Praxis API is running","docs":"/docs"}`, header `x-request-id` present | measured `200` in 22.08 s on the first request after idle |
| 2 | `GET /api/levels` | `200` and `data` is an array of **4** levels (Tutorial 4 puzzles, Levels 1–3 with 12 each = 40) | matches local output |
| 2 | `GET /api/laws` | `200` and `data` is **10** law cards | matches local output |
| 3 | `GET /api/levels/999` | `404` with `error.code = "not_found"` | matches local output |
| 3 | `GET /api/progress` (no token) | `401` with `error.code = "unauthorized"` | matches local output |
| 4 | `POST /api/score` | `200` with `data.total = 100.0` and `data.earnedPoints = 5` for the body above | matches local output |
| 5 | `GET /` on the Vercel URL | `200` and HTML containing `<title>Praxis — Interactive Boolean Simplifier</title>` | observed |
| 5 | `GET /api/levels` on the Vercel URL | JSON, not HTML — proves the `vercel.json` rewrite is live | — |

### 6.1 `/docs` is not a deployment check

Open <https://praxis-backend-5302.onrender.com/docs> and you will find Swagger UI **without an
Authorize button**. That is not a broken deploy: none of the routes declare an OpenAPI security
scheme, so `/openapi.json` has no `securitySchemes` and Swagger cannot attach a bearer token.
Verified against a live server — every operation reports `security = NONE`, including
`POST /api/progress/save`. An integrator cannot exercise the authenticated routes from the browser
UI; use `curl` with a Supabase access token instead ([runbooks.md](runbooks.md) RB-03).

### 6.2 Free-plan cold starts

`plan: free` (`render.yaml:5`) means the instance sleeps when idle. The first request after a quiet
period pays the cold start; the same checklist therefore passes fastest when you probe `/` first and
then immediately run the rest. Observed on the live service: **22.08 s** for the first `GET /`, with
subsequent calls in the normal range. Do not treat a slow first response as an outage — see
[runbooks.md](runbooks.md) RB-09.

---

## 7. CORS in production

The CORS middleware is configured from `settings.cors_origins` (`backend/main.py:30-36`), which is
`build_cors_origins(FRONTEND_URL)` (`backend/config/settings.py:54`, `:66-71`):

```
http://localhost:5173, http://127.0.0.1:5173, http://localhost:3001, https://praxis-seven-puce.vercel.app
```

(Order as built: the three dev defaults from `backend/config/settings.py:23-27`, then the deployed
SPA origin from `render.yaml:11`.)

- With the Vercel rewrite in place, production traffic is **same-origin from the browser's point of
  view** and CORS is never exercised. Keep the rewrite.
- CORS matters when something else calls the API cross-origin: a preview deployment on a
  `*.vercel.app` URL you have not added, a local `npm run preview` on port 4173, a script running in
  a browser context. In those cases the origin must be in the list.
- `allow_credentials=True` with an explicit origin list (never `*`) is correct here; the SPA sends
  `Authorization: Bearer …` rather than cookies, but credentialed CORS is harmless.
- Adding a preview origin means editing `render.yaml:9-11` (or the dashboard) and redeploying. There
  is no wildcard-subdomain support in the code.

---

## 8. Drift check: is production the same code as the repo?

Platforms deploy what you push; they do not tell you when you have forgotten to push. A five-second
check of the response *shape* distinguishes the current code from older revisions, because the
response envelope is recent:

| Probe | Current code (this commit) | Pre-envelope build |
|---|---|---|
| `GET /api/levels` | `{"success":true,"data":[…],"error":null}` | `[{"id":0,…}]` — a bare array |
| `GET /api/progress` without a token | `{"success":false,"data":null,"error":{"code":"unauthorized",…}}` | `{"detail":"Not authenticated"}` |

**Observed on 2026-09-28:** the live service at `https://praxis-backend-5302.onrender.com` returned
the **pre-envelope** shapes (bare array for `/api/levels`, `{"detail":…}` for `/api/progress`), while
the same requests against a locally started `uvicorn main:app` returned the envelope. In other words,
the deployed backend was running an **older revision than this repository**; the route list
(`/api/levels`, `/api/levels/{level_id}`, `/api/laws`, `/api/score`, `/api/progress`,
`/api/progress/save`, `/`) matched, so it was behind, not ancient.

Re-run the check after any deploy:

```bash
curl -s https://praxis-backend-5302.onrender.com/api/levels | head -c 40
# expect: {"success":true,"data":[{"id":0,...
```

The frontend tolerates both shapes deliberately — `frontend/src/services/apiClient.js:33-45` unwraps
the envelope when it sees `success`, and passes a legacy plain body straight through, with a comment
about "the pre-envelope plain-JSON shape" for independent deploys. That tolerance is exactly why the
drift is invisible in the UI, and why this check has to be run by hand.

---

## 9. Rollback

| Situation | Action | Detail |
|---|---|---|
| Bad backend deploy | Render dashboard → the service → **Events / Deploys** → the last good deploy → **Redeploy** (or **Rollback**) | See [runbooks.md](runbooks.md) RB-07 for the full procedure and how to confirm the rolled-back revision. |
| Bad frontend deploy | Vercel dashboard → **Deployments** → the previous deployment → **Promote to Production** | Instant; no rebuild. |
| Bad content change | Revert the commit that touched `content/*.json` | The backend caches content with `functools.lru_cache` (`backend/repositories/content_repository.py:34-43`), so a backend restart/redeploy is required for the change to take effect in either direction. |
| Bad schema change | Restore the Supabase database | [runbooks.md](runbooks.md) RB-08. `database/init.sql` is idempotent, so re-running it is always safe. |

There is no staging environment in this repository. Both platforms deploy straight from the branch
you track.

---

## 10. Known discrepancies

| ID | Document says | Verified truth |
|---|---|---|
| D19 | [`docs/context.md`](../context.md): deploy = "Render (render.yaml)" for the whole app | `render.yaml` defines **one** service, `praxis-backend` (`render.yaml:2-8`). The SPA is deployed to Vercel (§1, §5). |
| — | [`docs/context.md`](../context.md) and [`README.md`](../../README.md) do not mention the backend's production host | The host is hardcoded in `frontend/vercel.json:5` as `https://praxis-backend-5302.onrender.com`. |
| D22 | (not previously documented) | The API exposes no OpenAPI security scheme, so `/docs` has no Authorize button (§6.1). |
| — | `README.md` implies one `.env` file per directory | Correct, but the backend's is load-bearing at import time and the frontend's file in the working checkout is `.env.local` — see [installation-manual.md](installation-manual.md). |

Related reading: [installation-manual.md](installation-manual.md) ·
[configuration-guide.md](configuration-guide.md) · [runbooks.md](runbooks.md) ·
[monitoring.md](monitoring.md) · [configuration reference](../06-reference/config-reference.md) ·
[API reference](../04-api/API-REFERENCE.md) · [diagrams hub](../09-diagrams/DIAGRAMS.md).
