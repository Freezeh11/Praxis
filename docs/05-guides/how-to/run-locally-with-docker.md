# How to run Praxis locally with Docker

**What this is:** the honest answer to "how do I start Praxis with `docker compose up`?" — namely,
that this repository contains no Docker support at all — followed by the native procedure that does
work, and an optional, clearly-labelled compose file that is **not** part of the repository.

**Who it's for:** a teammate who prefers containers to local virtual environments, or who was told
Docker was the standard way to run this project. Read §1 before you spend time on a `docker build`
that cannot succeed.

## Contents

1. [The short answer](#1-the-short-answer)
2. [Evidence: there is no Docker configuration](#2-evidence-there-is-no-docker-configuration)
3. [Option A (recommended): run it natively](#3-option-a-recommended-run-it-natively)
4. [Option B: a new compose setup, not in this repository](#4-option-b-a-new-compose-setup-not-in-this-repository)
5. [Verifying the compose setup](#5-verifying-the-compose-setup)
6. [Why this is not committed](#6-why-this-is-not-committed)
7. [What production containers would need](#7-what-production-containers-would-need)

---

## 1. The short answer

**There is no Dockerfile, no `docker-compose.yml`, no `.dockerignore` and no container-related script
anywhere in this repository.** Docker is not a supported, tested or documented way to run Praxis. The
project runs as two native processes — `uvicorn` for the FastAPI backend and the Vite dev server for
the React SPA — with a hosted Supabase project providing auth and storage.

If a guide or a teammate tells you to run `docker compose up`, that instruction did not come from this
codebase. Use §3 instead.

---

## 2. Evidence: there is no Docker configuration

A recursive search for every common container filename over the whole checkout (excluding
`node_modules`) returns nothing:

| Pattern | Result |
|---|---|
| `Dockerfile`, `Dockerfile.*`, `*.dockerfile` | none |
| `docker-compose.yml`, `docker-compose.yaml`, `compose.yml`, `compose.yaml` | none |
| `.dockerignore` | none |
| Docker/Compose references in `render.yaml` | none — the service is `env: python` (`render.yaml:4`), a native Render runtime, not a Docker deploy |
| Docker steps in [`README.md`](../../README.md) or [`installation-manual.md`](../../08-devops/installation-manual.md) | none |

The deployment story confirms it: `render.yaml:4` selects Render's Python runtime and
`render.yaml:6-7` install and start the app with `pip install` and `uvicorn`. The frontend is a static
build served by Vercel (`frontend/vercel.json`).

**Do not assume the presence of Docker.** Verify for yourself:

**macOS / Linux:**

```bash
find . -iname 'dockerfile*' -o -iname 'docker-compose*' -o -iname '.dockerignore' | grep -v node_modules
```

**Windows (PowerShell):**

```powershell
Get-ChildItem -Recurse -Force -Include Dockerfile*,docker-compose*,.dockerignore |
  Where-Object { $_.FullName -notmatch 'node_modules' }
```

Both commands print nothing.

---

## 3. Option A (recommended): run it natively

This is the supported path, and it is short. The full version with per-OS fences, expected outputs and
verification steps is in [installation-manual.md](../../08-devops/installation-manual.md); the guided
version is in [getting-started.md](../tutorials/getting-started.md).

### 3.1 The two-minute version

You need Python 3.10+, Node 20.19+ (22.13+ for `npm run lint`) and a Supabase project.

**Terminal 1 — backend:**

```bash
cd backend
python3 -m venv venv                     # Windows: python -m venv venv
source venv/bin/activate                 # Windows PS: .\venv\Scripts\Activate.ps1
                                         # Windows CMD: venv\Scripts\activate.bat
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Terminal 2 — frontend:**

```bash
cd frontend
npm install
npm run dev
```

Then open <http://localhost:5173>.

### 3.2 What you must create first

Two files, both gitignored, both required for a working app:

| File | Contents | Why |
|---|---|---|
| `backend/.env` | `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (required), `FRONTEND_URL` (optional) | `backend/config/settings.py:74-75` builds the settings singleton at **import** time, so the backend will not even import without the two required values |
| `frontend/.env.local` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | read by `frontend/src/services/supabaseClient.js:7-8` |

Use placeholders until you paste your own values: `https://<project-ref>.supabase.co`,
`<service-role-key>`, `<anon-key>`.

### 3.3 Why native is the right answer here

1. **It has zero setup cost.** Two processes, two env files, no images to build.
2. **The dev workflow depends on it.** Vite's dev server proxies `/api` to the backend
   (`frontend/vite.config.js:30-33`) and reads `VITE_API_TARGET` from `process.env`
   (`frontend/vite.config.js:8`); the content directory is aliased from outside the Vite root
   (`frontend/vite.config.js:16`, `:22`). All of that is transparent on the host.
3. **Both deployed environments are native.** Render uses a Python runtime, Vercel builds the SPA from
   `frontend/`. A container locally would test a topology nobody deploys.
4. **A container cannot remove the Supabase dependency.** Auth and progress still come from
   `https://<project-ref>.supabase.co`; containerising the two processes changes nothing about that.

---

## 4. Option B: a new compose setup, not in this repository

> ⚠️ **NEW FILES — NOT PART OF THE REPOSITORY.** Everything in this section is material supplied by
> this document. It does not exist in the repository today, it is not maintained by the project, and
> the Docker deployment is not covered by any test.
>
> **It could not be executed while writing this document**: the authoring environment has no working
> Docker daemon (the `docker` binary is a podman shim and the podman socket is unavailable). Treat the
> files below as a reviewed starting point that a Docker-capable teammate must run and then report on,
> not as verified instructions.

If you want containers anyway, create these files **on a branch**, run them, and only propose them for
merging once they work.

### 4.1 Files to create

**`docker-compose.yml`** (repository root — new file):

```yaml
# NEW — not part of the Praxis repository. Development-only compose setup.
services:
  backend:
    build:
      context: .
      dockerfile: docker/backend.Dockerfile
    env_file:
      - backend/.env          # SUPABASE_URL, SUPABASE_SERVICE_KEY, FRONTEND_URL
    environment:
      # The SPA is served from the host browser, so the deployed-origin value is not used here.
      FRONTEND_URL: http://localhost:5173
    ports:
      - "8000:8000"
    volumes:
      # Live-reload the backend sources.
      - ./backend:/app/backend
      # content/ MUST be mounted one level above backend/: the loader resolves
      # <repo>/content from backend/repositories/content_repository.py:16.
      - ./content:/app/content
    healthcheck:
      test: ["CMD", "python", "-c",
             "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/', timeout=3).status == 200 else 1)"]
      interval: 15s
      timeout: 5s
      retries: 5
      start_period: 10s

  frontend:
    build:
      context: .
      dockerfile: docker/frontend.Dockerfile
    environment:
      # Inside the compose network the API is reachable by service name.
      VITE_API_TARGET: http://backend:8000
      # These are compiled into the bundle; keep them in frontend/.env.local.
      VITE_SUPABASE_URL: ${VITE_SUPABASE_URL:?set VITE_SUPABASE_URL in your shell or an .env file}
      VITE_SUPABASE_PUBLISHABLE_KEY: ${VITE_SUPABASE_PUBLISHABLE_KEY:?set VITE_SUPABASE_PUBLISHABLE_KEY}
    ports:
      - "5173:5173"
    volumes:
      - ./frontend:/app/frontend
      - ./content:/app/content
      # Keep Linux-built node_modules out of the host's frontend/node_modules.
      - frontend_node_modules:/app/frontend/node_modules
    depends_on:
      backend:
        condition: service_healthy

volumes:
  frontend_node_modules:
```

**`docker/backend.Dockerfile`** (new file):

```dockerfile
# NEW — not part of the Praxis repository.
FROM python:3.12-slim

WORKDIR /app/backend

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# The sources are bind-mounted by compose in development; COPY keeps the image
# usable on its own (for example with `docker run`).
COPY backend/ /app/backend/
COPY content/ /app/content/

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

**`docker/frontend.Dockerfile`** (new file):

```dockerfile
# NEW — not part of the Praxis repository.
FROM node:22-slim

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ /app/frontend/
COPY content/ /app/content/

EXPOSE 5173
# --host is required: Vite binds loopback by default, which is unreachable from outside the container.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
```

### 4.2 Run it

```bash
# from the repository root, with your Supabase values exported for the frontend service
export VITE_SUPABASE_URL=https://<project-ref>.supabase.co
export VITE_SUPABASE_PUBLISHABLE_KEY=<anon-key>       # Windows PS: $env:VITE_SUPABASE_URL = '...'

docker compose up --build
```

Then open <http://localhost:5173>.

### 4.3 Compatibility checklist for whoever tests this

These are the specific things that must hold for the compose setup to work; each one is a verified
property of the code, so a failure here is a compose-file bug, not an application bug:

| # | Requirement | Where it comes from |
|---|---|---|
| 1 | `content/` sits one directory **above** `backend/` | `CONTENT_DIR = Path(__file__).resolve().parents[2] / "content"`, `backend/repositories/content_repository.py:16` |
| 2 | The backend sees `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` as real environment variables | `require_env` at import time, `backend/config/settings.py:60-61`, `:74-75`; `load_dotenv(..., override=False)` means env vars win over files |
| 3 | The frontend's proxy target is the backend **service name**, not `127.0.0.1` | `frontend/vite.config.js:8`, `:30-33`; inside a container, `127.0.0.1` is the frontend itself |
| 4 | Vite listens on `0.0.0.0` | Vite's default host is loopback |
| 5 | `node_modules` is a container-side volume | host `node_modules` contains platform-specific binaries |
| 6 | The browser reaches the SPA on `localhost:5173`, so CORS still sees `http://localhost:5173` | that origin is allowed by default, `backend/config/settings.py:23-27` |
| 7 | The `/api/auth` proxy still points at nothing | dead config, `frontend/vite.config.js:24-28` — harmless unless you add `/api/auth/*` routes |

---

## 5. Verifying the compose setup

After `docker compose up --build`, wait for the backend health check to pass
(`docker compose ps` shows `healthy`), then:

**macOS / Linux / Windows (all shells — `curl.exe` on Windows PowerShell):**

```bash
# 1. backend liveness
curl -s http://127.0.0.1:8000/
# expect: {"message":"Praxis API is running","docs":"/docs"}

# 2. content is visible inside the container (proves requirement 1)
curl -s http://127.0.0.1:8000/api/levels | head -c 80
# expect: {"success":true,"data":[{"id":0,...

# 3. the SPA is served
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:5173/
# expect: 200

# 4. the in-container proxy reaches the backend service (proves requirement 3)
curl -s http://127.0.0.1:5173/api/levels | head -c 80
# expect: the same envelope as step 2
```

If step 2 returns `503 content_unavailable`, the `content/` mount path is wrong — the error body names
the exact path the backend tried ([runbooks.md RB-04](../../08-devops/runbooks.md#rb-04-503-content_unavailable)).
If step 4 returns the SPA's HTML, the proxy target is wrong or Vite is still binding loopback.

Inside-container checks:

```bash
docker compose exec backend python -c "from config.settings import settings; print('origins:', settings.cors_origins)"
docker compose exec backend python -c "import os; print('content exists:', os.path.isdir('/app/content'))"
docker compose logs -f backend      # the structured JSON request log
```

---

## 6. Why this is not committed

Three honest reasons, in order of weight:

1. **It is unverified.** No one has run it. A container setup that has never been executed is a
   liability, not a feature — especially when the failure modes (a missing `content/` mount, a Vite
   host binding) are exactly the ones newcomers hit.
2. **It would create a second, divergent setup path.** Every documented instruction would need a
   Docker variant, and the compose file would drift from `render.yaml` and
   `frontend/vercel.json` — the two configurations that actually deploy.
3. **It solves no problem this project has.** Neither target environment uses containers, the app is
   two small processes, and Docker cannot remove the Supabase dependency.

If the team decides containers are wanted, the honest next step is: run §4 on a branch, fix whatever
breaks, add the compose file and both Dockerfiles to the repository, then add a CI job that boots
compose and runs the §5 checks. Until then, treat this section as a proposal.

---

## 7. What production containers would need

Not required for local development, listed here so the gap is explicit:

| Concern | What a real container setup must do |
|---|---|
| Backend image | `pip install -r backend/requirements.txt` at a **pinned** version (the file currently has no pins), copy `backend/` **and** `content/` at the relative paths the loader expects, run `uvicorn main:app --host 0.0.0.0 --port $PORT`, expose `$PORT` |
| Frontend image | `npm ci && npm run build` into `dist/`, then serve statically (nginx or equivalent) with an SPA fallback equivalent to `frontend/vercel.json:7-10` and an `/api/*` proxy equivalent to `frontend/vercel.json:3-6` |
| Secrets | injected at runtime, never baked into an image layer; the anon key is build-time for the SPA, the service key is runtime-only for the backend |
| Health probe | `GET /` (`backend/api/routes/health.py:15-18`); it must stay plain JSON and dependency-free |
| Logs | stdout only — the app writes one JSON object per line (`backend/core/logging.py:61-62`), which is what container log collectors expect |

Related reading: [installation-manual.md](../../08-devops/installation-manual.md) ·
[deployment.md](../../08-devops/deployment.md) · [configuration-guide.md](../../08-devops/configuration-guide.md) ·
[runbooks.md](../../08-devops/runbooks.md).
