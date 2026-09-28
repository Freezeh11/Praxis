# Installation manual — running Praxis on your own machine

**What this is:** the complete, copy-pasteable procedure for going from an empty machine to a
working Praxis development environment — a FastAPI backend, a Vite/React frontend, and a Supabase
project that stores auth and progress.

**Who it's for:** a new teammate (student or engineer) who has never run this repository, on
Windows, macOS or Linux. No prior knowledge of Praxis is assumed; every term is defined on first
use. If you only want the fastest path, read §1–§9 and stop at the first puzzle.

**Prime directive:** every version number, path and command below was verified against the code at
commit `3838343`. Where the older [`README.md`](../../README.md) disagrees with the code, this
manual follows the code and flags the difference (§14).

## Contents

1. [What you are installing](#1-what-you-are-installing)
2. [Prerequisites (verified versions)](#2-prerequisites-verified-versions)
3. [Stage 0 — clone and inspect](#stage-0-clone-and-inspect)
4. [Stage 1 — Supabase project and schema](#stage-1-supabase-project-and-schema)
5. [Stage 2 — `backend/.env` (do this before anything else)](#stage-2-backendenv-do-this-before-anything-else)
6. [Stage 3 — Python virtual environment and dependencies](#stage-3-python-virtual-environment-and-dependencies)
7. [Stage 4 — start the backend and verify it](#stage-4-start-the-backend-and-verify-it)
8. [Stage 5 — `frontend/.env.local`](#stage-5-frontendenvlocal)
9. [Stage 6 — install and start the frontend](#stage-6-install-and-start-the-frontend)
10. [Stage 7 — run the test suites](#stage-7-run-the-test-suites)
11. [Startup order and the gotchas that bite](#11-startup-order-and-the-gotchas-that-bite)
12. [Cleaning up / starting over](#12-cleaning-up-and-starting-over)
13. [Troubleshooting index](#13-troubleshooting-index)
14. [Known discrepancies in other documents](#14-known-discrepancies-in-other-documents)

---

## 1. What you are installing

Praxis is a **two-server development setup** plus a hosted database:

| Piece | What it is | Where it runs | Port |
|---|---|---|---|
| Backend | FastAPI app, `backend/main.py`, started with `uvicorn main:app` | your machine | 8000 |
| Frontend | React 19 SPA built by Vite, `frontend/` | your machine (dev server) | 5173 |
| Auth + progress database | Supabase (hosted Postgres + Auth) | Supabase cloud | 443 |
| Game content | static JSON: `content/laws.json`, `content/levels.json` | read by **both** servers | — |

The content directory is the single source of truth for laws and puzzles: the backend serves it
through `/api/laws` and `/api/levels` (`backend/repositories/content_repository.py:16`), and the
frontend bundles the same files through the `@content` Vite alias
(`frontend/vite.config.js:16`). You never edit two copies.

The **Boolean algebra engine** — the part that parses expressions, applies laws and validates a
derivation step — lives entirely in the browser under `frontend/src/engine/`. The backend does not
re-implement it; it serves content and scores the numbers you send it
(`backend/services/scoring_service.py`). This split is called the *engine contract*.

Two important consequences for setup:

- The backend **cannot start** without Supabase credentials (see §5). That is by design, not a bug.
- The frontend **can** render with only the Vite env vars, but signing in and saving progress need a
  real Supabase project.

---

## 2. Prerequisites (verified versions)

### 2.1 Required software

| Requirement | Minimum that actually works | Recommended | How to check |
|---|---|---|---|
| Python | **3.10** | 3.12 or newer | `python3 --version` / `python --version` |
| Node.js | **20.19** (Vite) / **22.13** (ESLint 10) | 22.13 LTS or 24 | `node --version` |
| npm | ships with Node | — | `npm --version` |
| git | any recent | — | `git --version` |
| Supabase account | free tier is enough | — | <https://supabase.com> |

**Why Python 3.10, not 3.9.** `backend/requirements.txt:1-5` pins **no versions**, so a fresh
install resolves the newest releases. As installed and verified on the development machine:

| Package | Version installed | `Requires-Python` |
|---|---|---|
| fastapi | 0.141.1 | `>=3.10` |
| uvicorn | 0.52.4 | `>=3.10` |
| starlette | 1.6.0 | `>=3.10` |
| python-dotenv | 1.2.3 | `>=3.10` |
| httpx | 0.28.1 | `>=3.8` |

> ⚠️ **Stale prerequisite.** [`README.md`](../../README.md) says "Python 3.9 or higher" and "Node.js
> v18 or higher". With today's unpinned dependency set, Python 3.9 cannot install FastAPI/uvicorn,
> and Node 18 cannot run Vite 8 or ESLint 10. Follow the table above.

**Why Node 20.19/22.13.** Resolved from the lockfile and the installed packages
(`frontend/package-lock.json`, verified with `npm ls`-equivalent reads):

| Package | Installed | Declared `engines.node` |
|---|---|---|
| vite | 8.2.2 | `^20.19.0 \|\| >=22.12.0` |
| @vitejs/plugin-react | 6.0.2 | `^20.19.0 \|\| >=22.12.0` |
| eslint | 10.4.0 | `^20.19.0 \|\| ^22.13.0 \|\| >=24` |
| react-router-dom | 7.18.3 | `>=20.0.0` |
| @supabase/supabase-js | 2.106.1 | `>=20.0.0` |

`npm run dev`, `npm run build` and `npm test` are fine from Node 20.19; `npm run lint` additionally
wants 22.13+ (or 20.19.x). The development machine runs Node **v22.23.1** and Python **3.14.7**,
which is what the "verified" column above was produced with.

### 2.2 Network access

You need outbound HTTPS to:

- your Supabase project (`https://<project-ref>.supabase.co`) — auth and progress storage;
- npm and PyPI registries for the first install.

### 2.3 You do **not** need Docker

There is **no `Dockerfile`, no `docker-compose.yml` and no `.dockerignore` anywhere in this
repository** (verified with a recursive filename search over the checkout). If you were told to
`docker compose up`, see [run-locally-with-docker.md](../05-guides/how-to/run-locally-with-docker.md),
which states that plainly and gives an honest native path plus clearly-labelled new compose files
that are *not* part of the repo.

---

## Stage 0: clone and inspect

### 0.1 Clone

**macOS / Linux (bash):**

```bash
git clone <repository-url> Praxis
cd Praxis
```

**Windows (PowerShell):**

```powershell
git clone <repository-url> Praxis
Set-Location Praxis
```

**Windows (CMD):**

```bat
git clone <repository-url> Praxis
cd Praxis
```

### 0.2 Verify the tree

**macOS / Linux:**

```bash
ls backend frontend content database
```

**Windows (PowerShell):**

```powershell
Get-ChildItem backend, frontend, content, database -Name
```

**✅ Verify Stage 0:** you should see `backend/` (containing `main.py`, `requirements.txt`),
`frontend/` (containing `package.json`, `vite.config.js`), `content/` (containing `laws.json` and
`levels.json`) and `database/` (containing `init.sql`). If `content/` is missing, stop — the backend
will answer every content route with `503 content_unavailable` (see
[runbooks.md](runbooks.md)).

---

## Stage 1: Supabase project and schema

You need one Supabase project. It provides both **Auth** (email/password accounts) and the three
Postgres tables that store progress.

> **Better Auth does not exist here.** `database/init.sql:4` contains a leftover comment claiming
> that "Better Auth tables (user, session, account, verification) are created automatically by
> `npx auth migrate`", and `frontend/vite.config.js:24-28` still proxies `/api/auth` to
> `127.0.0.1:3001` labelled "Better Auth server". **Neither is real.** There is no `auth-server/`
> directory, no port-3001 service, and no `npx auth` step. Auth is **Supabase Auth** through
> `@supabase/supabase-js` (`frontend/src/services/supabaseClient.js:5-10`). Do not run the dead
> proxy: `/api/auth/*` requests are routed to a port where nothing listens.

### 1.1 Create the project

1. Sign in at <https://supabase.com> and choose **New project**.
2. Pick an organisation, a name (for example `praxis-dev`), a strong database password, and the
   region closest to you. Save the database password in your password manager — you do not need it
   for this app, but you cannot recover it later.
3. Wait until the project finishes provisioning.

### 1.2 Run the schema

1. In the Supabase dashboard open **SQL Editor → New query**.
2. Paste the **entire** contents of [`database/init.sql`](../../database/init.sql) and press **Run**.

The script is idempotent (`CREATE TABLE IF NOT EXISTS`), so re-running it is safe. It creates:

| Table | Purpose | Key constraints |
|---|---|---|
| `user_progress` | one row per learner: `points`, `streak`, `best_streak` | PK `user_id` → `auth.users(id)` |
| `stage_progress` | one row per completed stage: `best_score`, `completed` | `UNIQUE(user_id, level_id, stage_idx)` |
| `score_history` | every scored attempt ever submitted | append-only |

It also enables Row Level Security on all three tables with a single policy each, literally named
`"Service role full access"`, defined `FOR ALL USING (true)`
(`database/init.sql:50-58`). Read the honest interpretation in
[configuration-guide.md](configuration-guide.md#7-security-notes): the policy is **not** restricted to
`service_role`, there is no `auth.uid() = user_id` predicate, and the frontend never queries these
tables directly — all access goes through the backend's service key.

### 1.3 Copy the three credentials

Open **Project Settings → API** and note, without sharing them:

| Supabase field | Goes into | Used by |
|---|---|---|
| Project URL (`https://<project-ref>.supabase.co`) | `backend/.env` **and** `frontend/.env.local` | both |
| `service_role` secret key | `backend/.env` only | backend (never the browser) |
| `anon` / publishable key | `frontend/.env.local` only | browser bundle |

> 🔐 **Never commit these values and never paste them into a document.** This manual uses the
> placeholders `https://<project-ref>.supabase.co`, `<service-role-key>` and `<anon-key>`
> throughout. `backend/.env` is ignored by `.gitignore:3` (`.env`) and `frontend/.env.local` by
> `frontend/.gitignore:15` (`*.local`); `git ls-files` lists **no** tracked env file. Keep it that
> way.

### 1.4 Optional but recommended: decide the email-confirmation policy

`frontend/src/pages/RegisterPage.jsx:44-55` calls `supabase.auth.signUp`, then waits for a session
before routing to `/levels`. Supabase's **Confirm email** setting decides what happens next:

- **Confirm email OFF** (fastest for local development): `signUp` returns a session immediately and
  the new learner lands on `/levels`.
- **Confirm email ON** (the Supabase default for new projects): `signUp` returns no session. The
  page shows "Account created successfully! Welcome to Praxis." but the learner stays on
  `/register` until they click the confirmation link in their inbox.

Either is valid. For a demo machine, turning confirmation off removes a step from every test
signup; for anything public, leave it on.

**✅ Verify Stage 1:** in the Supabase **Table Editor** you should see `user_progress`,
`stage_progress` and `score_history` under schema `public`. Then run this in the SQL editor:

```sql
select table_name from information_schema.tables
where table_schema = 'public'
order by table_name;
```

Expected: three rows — `score_history`, `stage_progress`, `user_progress`.

---

## Stage 2: `backend/.env` (do this before anything else)

### 2.1 Why this is Stage 2 and not Stage 5

`backend/config/settings.py:74-75` builds a **module-level singleton at import time**:

```python
# Import-time singleton: a missing credential crashes the boot, as before.
settings = Settings.from_env()
```

and `Settings.from_env` (`backend/config/settings.py:56-63`) calls
`require_env("SUPABASE_URL")` and `require_env("SUPABASE_SERVICE_KEY")`, which raise
`RuntimeError` when the variable is unset (`backend/config/settings.py:30-38`).

Because `supabase_client.py:12` imports that singleton, the app **cannot even import** without
credentials — every route fails, including `GET /api/levels`, which needs no database at all.
Reproduced verbatim on a copy of `backend/` with `.env` removed:

```text
  File "/…/backend/config/settings.py", line 75, in <module>
    settings = Settings.from_env()
  File "/…/backend/config/settings.py", line 60, in from_env
    supabase_url=require_env("SUPABASE_URL"),
RuntimeError: Missing required environment variable: SUPABASE_URL. Set it in backend/.env (local) or in the deployment environment.
```

Create the file **now**, before you create the virtual environment, so your first backend boot is
guaranteed to succeed.

### 2.2 Create `backend/.env`

Create the file `backend/.env` containing exactly these three lines, substituting your Supabase
project values:

```env
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_KEY=<service-role-key>
FRONTEND_URL=http://localhost:5173
```

Notes:

- `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are **required**
  (`backend/config/settings.py:60-61`).
- `FRONTEND_URL` is **optional** (`backend/config/settings.py:62` uses `os.getenv`, not
  `require_env`). It is appended to the CORS allow-list by `build_cors_origins`
  (`backend/config/settings.py:66-71`). `http://localhost:5173` is already allowed by default
  (`backend/config/settings.py:23-27`), so this line is a no-op locally — it matters in deployment,
  where it must be the deployed SPA origin.
- Do not add quotes around the values and do not add trailing spaces.

**Creating the file — macOS / Linux (bash):**

```bash
cat > backend/.env <<'EOF'
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_KEY=<service-role-key>
FRONTEND_URL=http://localhost:5173
EOF
```

**Creating the file — Windows (PowerShell 7+):**

```powershell
@'
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_KEY=<service-role-key>
FRONTEND_URL=http://localhost:5173
'@ | Set-Content -Path backend\.env -Encoding utf8NoBOM
```

**Creating the file — Windows (Windows PowerShell 5.1 or CMD):** create the file with a text editor
(Notepad, VS Code) and save it as `backend\.env`. If you prefer a shell, use `ascii`, because
`-Encoding utf8` in PowerShell 5.1 writes a byte-order mark that older tooling can stumble on:

```powershell
@'
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_KEY=<service-role-key>
FRONTEND_URL=http://localhost:5173
'@ | Set-Content -Path backend\.env -Encoding ascii
```

### 2.3 How the backend finds the file

`backend/config/settings.py:19-20`:

```python
load_dotenv(BACKEND_DIR / ".env", override=False)   # backend/.env, absolute
load_dotenv(override=False)                         # python-dotenv's cwd-relative search
```

- `backend/.env` is loaded **first**, by absolute path, so the app boots correctly no matter which
  directory you launch `uvicorn` from.
- A cwd-relative `.env` is loaded second — a convenience for running from the repo root.
- `override=False` on both calls means **real environment variables always win** over file values.
  That is what lets Render inject `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` without ever shipping a file
  (see [deployment.md](deployment.md)).

**✅ Verify Stage 2:** from `backend/`, with no virtual environment yet (the check only needs
`python-dotenv`, which we install next) — if you get `ModuleNotFoundError: dotenv`, come back after
Stage 3:

**macOS / Linux:**

```bash
cd backend
python3 -c "from config.settings import settings; print('origins:', settings.cors_origins)"
```

**Windows (PowerShell / CMD):**

```powershell
cd backend
python -c "from config.settings import settings; print('origins:', settings.cors_origins)"
```

Expected output when `FRONTEND_URL` is exactly one of the three defaults, or unset (no secret is
printed — only the derived CORS list):

```text
origins: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3001']
```

`build_cors_origins` (`backend/config/settings.py:66-71`) appends `FRONTEND_URL` only when it is not
already in the list. Set it to anything else (say `https://praxis-seven-puce.vercel.app`) and a fourth
entry appears — that is the deployed-SPA case covered in [deployment.md](deployment.md).

> ⚠️ **Trailing-slash trap, observed for real.** On the working checkout, `backend/.env` sets
> `FRONTEND_URL=http://localhost:5173/` — with a trailing slash — so the printed list has **four**
> entries and the last one is `'http://localhost:5173/'`. CORS compares origins as strings, so that
> value never matches the browser's `http://localhost:5173`:
>
> ```text
> origins: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3001', 'http://localhost:5173/']
> ```
>
> It is harmless locally (the Vite proxy makes calls same-origin anyway), but the same mistake in
> production — a trailing slash on the deployed SPA origin — produces a real CORS failure. Write
> `FRONTEND_URL` with **no** trailing slash.

If you instead see `RuntimeError: Missing required environment variable: SUPABASE_URL`, the file is
missing, misnamed, or in the wrong directory. It must be `Praxis/backend/.env`.

---

## Stage 3: Python virtual environment and dependencies

Always use a virtual environment. The repository already ignores `venv/` (`.gitignore:2`), so the
convention is `backend/venv/`.

### 3.1 Create it

**macOS / Linux (bash):**

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
python -m pip install --upgrade pip
```

**Windows (PowerShell):**

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
```

If PowerShell refuses with *"running scripts is disabled on this system"*, allow scripts for this
one shell only — never change the machine-wide policy just to activate a venv:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\venv\Scripts\Activate.ps1
```

**Windows (CMD):**

```bat
cd backend
python -m venv venv
venv\Scripts\activate.bat
python -m pip install --upgrade pip
```

`venv\Scripts\activate` (without the extension) also works in CMD; `activate.bat` is the explicit
form and is what this manual uses. In Git Bash on Windows the path is
`source venv/Scripts/activate` (note `Scripts`, not `bin`).

Your prompt should now start with `(venv)`.

### 3.2 Install the dependencies

**All platforms, with the venv active and `backend/` as the working directory:**

```bash
pip install -r requirements.txt
```

`backend/requirements.txt` is the real list (`fastapi`, `uvicorn[standard]`, `python-multipart`,
`python-dotenv`, `httpx` — five lines, **no version pins**). The repository-root
`requirements.txt` is a one-line shim, `-r backend/requirements.txt`
(root [`requirements.txt`](../../requirements.txt):6), so `pip install -r requirements.txt` from the
repo root also works.

> ⚠️ **Unpinned dependencies.** Because nothing is pinned, two installs months apart can resolve
> different FastAPI/uvicorn versions. If a teammate's build breaks after a fresh `pip install`, that
> is the first suspect. The backend has no lockfile; adding one is a known gap (see
> [known-limitations.md](../07-explanation/known-limitations.md)).

### 3.3 Verify the install

```bash
python -c "import fastapi, uvicorn, httpx, dotenv; print('ok')"
```

Expected:

```text
ok
```

Optional, and useful when you want to know which versions you actually got:

```bash
python -c "import fastapi, uvicorn, httpx, importlib.metadata as m; print('fastapi', fastapi.__version__); print('uvicorn', uvicorn.__version__); print('httpx', httpx.__version__); print('python-dotenv', m.version('python-dotenv'))"
```

Verified sample output on the development machine:

```text
fastapi 0.141.1
uvicorn 0.52.4
httpx 0.28.1
python-dotenv 1.2.3
```

**✅ Verify Stage 3:** `(venv)` appears in your prompt, the `import` check prints `ok`, and
`python --version` reports 3.10 or newer.

---

## Stage 4: start the backend and verify it

### 4.1 Start uvicorn

With the virtual environment active and the working directory set to `backend/`:

```bash
uvicorn main:app --reload --port 8000
```

Expected first lines:

```text
INFO:     Will watch for changes in these directories: ['/…/Praxis/backend']
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [12345] using WatchFiles
INFO:     Started server process [12346]
INFO:     Application startup complete.
```

The app itself also logs structured JSON to stdout — one object per line. The first HTTP request
produces lines like these (exact shape, verified locally):

```json
{"ts": "2026-09-28T05:39:53.501Z", "level": "INFO", "logger": "praxis.request", "message": "request completed", "request_id": "b923a6d9ddfa4ef887b28e12486ecad4", "method": "GET", "path": "/", "status": 200, "duration_ms": 0.75}
```

`--reload` restarts the server on every file save. Drop it if you want a stable process.

> **Note on the host.** `uvicorn main:app` binds `127.0.0.1` (loopback only). Production uses
> `--host 0.0.0.0 --port $PORT` (`render.yaml:7`). If you need to reach your dev server from a phone
> on the same network, add `--host 0.0.0.0` — and remember that this exposes it to your LAN.

### 4.2 Verify with three requests

**macOS / Linux (bash), or any shell with a real `curl`:**

```bash
curl -i http://127.0.0.1:8000/
curl -s http://127.0.0.1:8000/api/levels
curl -s http://127.0.0.1:8000/api/progress
```

**Windows (PowerShell):** `curl` is an *alias* for `Invoke-WebRequest` in Windows PowerShell, so the
flags above do not behave the same. Use `curl.exe` (shipped with Windows 10+) or the native cmdlet:

```powershell
curl.exe -i http://127.0.0.1:8000/
curl.exe -s http://127.0.0.1:8000/api/levels

# Native PowerShell equivalent that prints JSON nicely:
Invoke-RestMethod http://127.0.0.1:8000/api/levels | ConvertTo-Json -Depth 4
```

Expected results, verified against a running server:

| Request | Status | Body |
|---|---|---|
| `GET /` | `200` | `{"message":"Praxis API is running","docs":"/docs"}` |
| `GET /api/levels` | `200` | envelope whose `data` is an array of **4** levels |
| `GET /api/progress` (no token) | `401` | `{"success":false,"data":null,"error":{"code":"unauthorized","message":"Not authenticated","detail":null}}` |

The exact `GET /` response, including the correlation header:

```text
HTTP/1.1 200 OK
date: Mon, 28 Sep 2026 05:39:36 GMT
server: uvicorn
content-length: 50
content-type: application/json
x-request-id: e15778ac9dd946f5b44d85d6197b9d4c

{"message":"Praxis API is running","docs":"/docs"}
```

`GET /api/levels` returns the four levels with their stage counts — Tutorial (id 0) has 4 puzzles and
Levels 1–3 have 12 each, **40 puzzles in total**:

```json
{"success":true,"data":[
 {"id":0,"name":"Tutorial","desc":"Interactive Fundamentals & System Orientation","varCount":2,"puzzleCount":4},
 {"id":1,"name":"Level 1","desc":"Two-variable expressions (SOP & POS Dual Pairs)","varCount":2,"puzzleCount":12},
 {"id":2,"name":"Level 2","desc":"Three-variable expressions (SOP & POS Dual Pairs)","varCount":3,"puzzleCount":12},
 {"id":3,"name":"Level 3 — Boss","desc":"…","varCount":4,"puzzleCount":12}
],"error":null}
```

Two more checks worth running once:

```bash
curl -s http://127.0.0.1:8000/api/levels/999      # expect 404 not_found
curl -s http://127.0.0.1:8000/api/laws | head -c 200   # expect 10 law cards
```

**✅ Verify Stage 4:** `GET /` returns `200` with the plain message, `GET /api/levels` lists 4
levels, and `GET /api/progress` returns the `401 unauthorized` envelope. FastAPI's own interactive
docs are at <http://127.0.0.1:8000/docs>.

> ⚠️ **`/docs` has no Authorize button — that is expected.** Neither `POST /api/score` nor the two
> `/api/progress*` routes declare an OpenAPI security scheme, so `/openapi.json` contains no
> `securitySchemes` and Swagger UI cannot attach a bearer token for you. Confirmed against a live
> server: every operation reports `security = NONE`. To exercise an authenticated route, use `curl`
> with a real Supabase access token (see [runbooks.md](runbooks.md) RB-03).

---

## Stage 5: `frontend/.env.local`

Vite loads `.env` and `.env.local` from the `frontend/` directory. Only variables prefixed with
`VITE_` are exposed to the browser bundle.

Create `frontend/.env.local`:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon-key>
VITE_AUTH_URL=http://localhost:3001
```

- `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are read in
  `frontend/src/services/supabaseClient.js:7-8` and passed straight to `createClient`.
- `VITE_AUTH_URL` is **vestigial**. A recursive search of `frontend/src` finds **no reference** to
  it; it survives from the abandoned Better Auth plan (§1 of this manual, and `docs/context.md`
  §11/D3). You may omit the line entirely; it is shown only so that the file you create looks like
  everyone else's.
- [`README.md`](../../README.md) tells you to create `frontend/.env`; the file that exists in the
  working checkout is `frontend/.env.local`. Both are loaded by Vite (`.env.local` wins), and both
  are gitignored. Pick one and stay consistent.

**Creation commands — macOS / Linux:**

```bash
cat > frontend/.env.local <<'EOF'
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon-key>
EOF
```

**Windows (PowerShell 7+):**

```powershell
@'
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon-key>
'@ | Set-Content -Path frontend\.env.local -Encoding utf8NoBOM
```

> 🔐 The publishable/anon key is designed to be public — it ships in the browser bundle. That does
> **not** make it harmless here: the RLS policies in `database/init.sql:56-58` are
> `FOR ALL USING (true)` for **all** roles, so anyone holding the anon key can read and write the
> three tables through Supabase's REST API. Treat the project as a development project until those
> policies are tightened. The `service_role` key is different: it bypasses RLS and must **never**
> appear in `frontend/`, in a `VITE_` variable, or in a browser bundle.

**✅ Verify Stage 5:** after Stage 6, the browser console must show no `supabaseUrl is required`
error, and sign-up must succeed.

---

## Stage 6: install and start the frontend

### 6.1 Install

**All platforms:**

```bash
cd frontend
npm install
```

`npm ci` also works if you have not modified `package.json`; it installs exactly the versions in
`frontend/package-lock.json` (lockfileVersion 3) and is the more reproducible choice.

### 6.2 Start the dev server

```bash
npm run dev
```

Expected output (Vite 8):

```text
  VITE v8.2.2  ready in 300 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

Scripts available (`frontend/package.json:6-12`):

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server on <http://localhost:5173> |
| `npm run build` | production bundle into `frontend/dist/` |
| `npm run preview` | serves the built bundle locally |
| `npm run lint` | ESLint 10 over the frontend |
| `npm test` | engine unit tests via `node --test src/engine/__tests__/*.test.js` |

### 6.3 How the dev server talks to the backend

`frontend/vite.config.js:8,19-35`:

- `/api/*` is proxied to `http://127.0.0.1:8000` (the default) — **change it without editing the
  file** by exporting `VITE_API_TARGET`, which keeps the SPA free of CORS entirely in development.
- Everything under `/api/auth` is proxied to `http://127.0.0.1:3001` first, because the `/api/auth`
  key precedes the generic `/api` key. **This entry is dead config** — there is no Better Auth
  server and nothing listens on 3001. It only matters if you ever add a route starting with
  `/api/auth`.
- `server.fs.allow` is widened to the repository root (`frontend/vite.config.js:22`) so the dev
  server may read `content/`, which lives outside the Vite root.

Point the SPA at a throwaway backend running on another port:

**macOS / Linux:**

```bash
VITE_API_TARGET=http://127.0.0.1:8001 npm run dev
```

**Windows (PowerShell):**

```powershell
$env:VITE_API_TARGET = 'http://127.0.0.1:8001'; npm run dev
```

**Windows (CMD):**

```bat
set VITE_API_TARGET=http://127.0.0.1:8001 && npm run dev
```

### 6.4 Verify the proxy end to end

With both servers running, request the API **through the dev server** (this is the path the browser
takes):

**macOS / Linux:**

```bash
curl -s http://localhost:5173/api/levels | head -c 120
```

**Windows (PowerShell):**

```powershell
curl.exe -s http://localhost:5173/api/levels
```

Expected: the same envelope you saw in Stage 4. If you get an HTML page or a 404 instead, the proxy
is not reaching the backend — see [runbooks.md](runbooks.md) RB-02.

**✅ Verify Stage 6:** <http://localhost:5173> renders the Praxis landing page, and
`http://localhost:5173/api/levels` returns JSON (not HTML).

---

## Stage 7: run the test suites

### 7.1 Engine unit tests

```bash
cd frontend
npm test
```

Expected tail (verified on the development machine):

```text
# tests 76
# suites 0
# pass 76
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 12984.422607
```

**76 tests, all passing, roughly 9–14 seconds** depending on the machine. These are pure
`node:test` runs of `frontend/src/engine/__tests__/*.test.js` — no browser, no server, no network.

> The proposal in [`docs/context.md`](../context.md) claims "46 unit tests". It is stale; the real
> figure is 76.

### 7.2 Lint and production build

```bash
npm run lint
npm run build
```

Expected build output (verified with `npx vite build`):

```text
vite v8.2.2 building client environment for production...
✓ 596 modules transformed.
dist/index.html                     0.96 kB │ gzip:   0.51 kB
dist/assets/logo-full-*.png        81.32 kB
dist/assets/index-*.css            69.29 kB │ gzip:  12.22 kB
dist/assets/index-*.js            880.23 kB │ gzip: 252.13 kB
✓ built in 1.32s
```

Vite prints a warning that the main chunk exceeds 500 kB. That is expected — there is no
code-splitting configured — and it does not fail the build.

**✅ Verify Stage 7:** `# fail 0`, a clean lint run, and a `frontend/dist/` directory containing
`index.html` plus `assets/`.

---

## 11. Startup order and the gotchas that bite

Run the two servers in **two terminals**, in this order:

| # | Terminal | Command | Why this order |
|---|---|---|---|
| 1 | backend | `uvicorn main:app --reload --port 8000` | The SPA's `/api` proxy needs something on 8000; and the backend fails fast if `.env` is missing. |
| 2 | frontend | `npm run dev` | Talks to the backend through the Vite proxy. |

Ordered by how often they cost a newcomer time:

1. **`backend/.env` must exist before the first boot.** The credential check runs at *import* time
   (`backend/config/settings.py:74-75`), so even `GET /api/levels` fails when it is missing. There is
   no graceful degradation.
2. **`content/` must sit beside `backend/`.** `CONTENT_DIR` is computed as
   `Path(__file__).resolve().parents[2] / "content"` (`backend/repositories/content_repository.py:16`),
   and a missing file raises `ContentUnavailableError` → `503 content_unavailable` with a `detail`
   naming the exact path it tried. Fix the directory, not the code.
3. **`content/` is read once and cached.** `list_laws()` and `list_levels()` are wrapped in
   `functools.lru_cache` (`backend/repositories/content_repository.py:34-43`). Editing
   `content/levels.json` therefore requires a backend restart, even with `--reload` watching only
   Python files.
4. **CORS is a dev-only concern, usually.** The default allow-list is
   `http://localhost:5173`, `http://127.0.0.1:5173` and `http://localhost:3001`
   (`backend/config/settings.py:23-27`). Browsing the SPA on `localhost:5173` while the API is on
   `8000` is fine because the Vite proxy makes the call same-origin. Reproduce a CORS failure by
   serving the SPA on any other origin — a preview build on port 4173, for example.
5. **The `/api/auth` proxy and the Better Auth comment are dead.** §1 above.
6. **`requirements.txt` has no pins.** §3.2 above.
7. **Windows: `curl` is not curl in PowerShell.** Use `curl.exe` or `Invoke-RestMethod`.
8. **Windows: activating a venv needs the right script.** `venv\Scripts\Activate.ps1` (PowerShell,
   may need `-Scope Process -ExecutionPolicy Bypass`), `venv\Scripts\activate.bat` or
   `venv\Scripts\activate` (CMD), `source venv/bin/activate` (macOS/Linux), and
   `source venv/Scripts/activate` in Git Bash.
9. **Auth is Supabase Auth.** If sign-in fails, the problem is `frontend/.env.local` or the Supabase
   dashboard — never a missing `auth-server/`.

---

## 12. Cleaning up and starting over

Stop both servers with `Ctrl+C`. Then, to reset local state **without** touching Supabase:

**macOS / Linux:**

```bash
deactivate                     # leave the venv, if active
rm -rf backend/venv backend/__pycache__
rm -rf frontend/node_modules frontend/dist
```

**Windows (PowerShell):**

```powershell
deactivate
Remove-Item -Recurse -Force backend\venv, backend\__pycache__
Remove-Item -Recurse -Force frontend\node_modules, frontend\dist
```

Your `.env` files are deliberately **not** in that list — keep them, and never let them into git.
To reset a learner's stored progress (browser + Supabase rows), follow
[reset-user-progress.md](../05-guides/how-to/reset-user-progress.md).

---

## 13. Troubleshooting index

| Symptom | Go to |
|---|---|
| `RuntimeError: Missing required environment variable: SUPABASE_URL` | Stage 2; [runbooks.md](runbooks.md) RB-01 |
| `Address already in use` / port 8000 busy | [runbooks.md](runbooks.md) RB-01 |
| Frontend shows "Could not reach the Praxis server." | [runbooks.md](runbooks.md) RB-02 |
| Browser console: CORS policy error | [runbooks.md](runbooks.md) RB-02 |
| `401 unauthorized` on progress routes | [runbooks.md](runbooks.md) RB-03 |
| `503 content_unavailable` | [runbooks.md](runbooks.md) RB-04 |
| `502 upstream_error` (auth or storage) | [runbooks.md](runbooks.md) RB-05, RB-06 |
| Sign-up appears to do nothing | Stage 1.4 (email confirmation) |
| Deployed site is stale compared with the repo | [deployment.md](deployment.md) §8 |

---

## 14. Known discrepancies in other documents

| Document | Claim | Truth (verified) |
|---|---|---|
| [`README.md`](../../README.md#prerequisites) | "Python 3.9 or higher", "Node.js v18 or higher" | FastAPI 0.141/uvicorn 0.52/starlette 1.6 require **Python ≥ 3.10**; Vite 8 and ESLint 10 require **Node ≥ 20.19** (22.13 for lint). See §2.1. |
| [`README.md`](../../README.md#2-environment-variables-configuration) | create `frontend/.env` | The checkout ships `frontend/.env.local`. Both work; Vite gives `.env.local` precedence. |
| [`docs/context.md`](../context.md) §11 | "No `.env` file exists yet" | Both env files exist locally and are correctly gitignored (`.gitignore:3`, `frontend/.gitignore:15`); `git ls-files` lists none of them. |
| [`docs/context.md`](../context.md) §11 | prints a concrete `VITE_SUPABASE_PUBLISHABLE_KEY` value | A real credential value is committed in a tracked document. Never reproduce it; use `<anon-key>`. |
| `database/init.sql:4` | "Better Auth tables … created automatically by `npx auth migrate`" | No Better Auth anywhere in the repo. Auth is Supabase Auth. |
| [`docs/context.md`](../context.md) | "Database … NOT integrated yet"; "Auth: None" | Fully integrated: `backend/supabase_client.py`, `/api/progress*`, Supabase Auth on the frontend. |
| [`docs/context.md`](../context.md) | "3 levels … 6 puzzles each" | 4 levels × {4, 12, 12, 12} = **40 puzzles**. |

Related reading: [deployment.md](deployment.md) · [configuration-guide.md](configuration-guide.md) ·
[runbooks.md](runbooks.md) · [monitoring.md](monitoring.md) ·
[configuration reference](../06-reference/config-reference.md) ·
[getting started tutorial](../05-guides/tutorials/getting-started.md) ·
[architecture](../02-architecture/SAD.md) · [glossary](../10-project/glossary.md).
